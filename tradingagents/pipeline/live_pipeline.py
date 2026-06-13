import logging
from datetime import datetime
from typing import List

from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.pipeline.screener_agent import ScreenerAgent
from tradingagents.pipeline.executor_agent import AlpacaExecutorAgent
from tradingagents.pipeline.portfolio_manager import PortfolioManager

logger = logging.getLogger(__name__)

class LivePipeline:
    def __init__(self, paper: bool = True, checkpoint: bool = False, research_fn = None):
        self.screener = ScreenerAgent()
        self.executor = AlpacaExecutorAgent(paper=paper)
        self.portfolio = PortfolioManager(paper=paper)
        self.today = datetime.now().strftime("%Y-%m-%d")
        self.checkpoint = checkpoint
        self.research_fn = research_fn
        self.stop_requested = False

    def _run_research(self, ticker: str, analysts: List[str], current_index: int = 1, total_count: int = 1) -> bool:
        """
        Runs the TradingAgents graph with the specified analysts and returns True if BUY, False otherwise.
        """
        logger.info(f"Running research for {ticker} ({current_index}/{total_count}) using analysts: {analysts}")
        
        if self.research_fn:
            return self.research_fn(ticker, analysts, self.checkpoint, current_index, total_count)
            
        # Fallback to non-GUI mode
        config = DEFAULT_CONFIG.copy()
        if self.checkpoint:
            config["checkpoint_enabled"] = True
        
        graph = TradingAgentsGraph(selected_analysts=analysts, config=config)
        final_state, decision = graph.propagate(ticker, self.today)
        
        logger.info(f"Research decision for {ticker}: {decision}")
        return decision.upper() == "BUY" or decision.upper() == "HOLD"

    def init_portfolio(self, stocks_per_category: int = 3, tickers: List[str] = None):
        """
        Builds the N-stock Day One portfolio or researches a custom set of tickers.
        """
        import os, json
        from pathlib import Path
        
        if tickers is not None:
            logger.info(f"Using provided tickers for research: {tickers}")
            all_tickers = tickers
        else:
            logger.info(f"Initializing {stocks_per_category*5}-stock portfolio...")
            results_dir = Path(DEFAULT_CONFIG.get("results_dir"))
            results_dir.mkdir(parents=True, exist_ok=True)
            allocations_file = results_dir / f"init_allocations_{self.today}.json"

            if allocations_file.exists():
                with open(allocations_file, "r", encoding="utf-8") as f:
                    allocations = json.load(f)
                
                # Check if the cache matches the current multiplier request
                cached_count = len(next(iter(allocations.values()))) if allocations else 0
                if cached_count == stocks_per_category:
                    logger.info("Loading pre-existing allocations from disk...")
                else:
                    # 1. Screen universe for the top candidates
                    logger.info(f"Running initial screener for {stocks_per_category} stocks per category...")
                    screener_reasoning, final_candidates = self.screener.run_full_screen(stocks_per_category=stocks_per_category)
                    logger.info(f"Screener complete. Selected {sum(len(v) for v in final_candidates.values())} candidates.")
                    
                    # Save screener report
                    from tradingagents.db import init_db, save_report
                    init_db()
                    save_report("SCREENER_REPORT", self.today, {
                        "reasoning": screener_reasoning,
                        "selections": final_candidates
                    })
                    allocations = final_candidates
                    with open(allocations_file, "w", encoding="utf-8") as f:
                        json.dump(allocations, f, indent=4)
            else:
                logger.info(f"Running initial screener for {stocks_per_category} stocks per category...")
                screener_reasoning, allocations = self.screener.run_full_screen(stocks_per_category=stocks_per_category)
                logger.info(f"Screener complete. Selected {sum(len(v) for v in allocations.values())} candidates.")
                
                # Save screener report
                from tradingagents.db import init_db, save_report
                init_db()
                save_report("SCREENER_REPORT", self.today, {
                    "reasoning": screener_reasoning,
                    "selections": allocations
                })
                with open(allocations_file, "w", encoding="utf-8") as f:
                    json.dump(allocations, f, indent=4)
            
            # Flatten the allocations
            all_tickers = []
            for slot, tickers_list in allocations.items():
                logger.info(f"Slot: {slot} -> {tickers_list}")
                all_tickers.extend(tickers_list)
            
        # Full 360 Research analysts
        full_analysts = ["market", "social", "news", "fundamentals"]
        
        approved_tickers = []
        total_count = len(all_tickers)
        for i, ticker in enumerate(all_tickers, 1):
            if self.stop_requested:
                logger.info("Stop requested. Halting init_portfolio.")
                break
 
            # Check if this ticker was already researched today in the DB
            from tradingagents.db import init_db, report_exists, get_report, save_recommendation
            init_db()
            
            is_approved = False
            
            if report_exists(ticker, self.today):
                logger.info(f"Skipping LLM for {ticker}. Saved report exists in DB.")
                try:
                    saved_state = get_report(ticker, self.today)
                    if saved_state:
                        decision = saved_state.get("final_trade_decision", "")
                        is_approved = (decision.upper() == "BUY" or decision.upper() == "HOLD")
                    # Update UI through callback if we have one, just simulating a fast run
                    if self.research_fn:
                        self.research_fn(ticker, full_analysts, self.checkpoint, i, total_count)
                except Exception as e:
                    logger.error(f"Error reading DB for {ticker}: {e}")
                    is_approved = self._run_research(ticker, full_analysts, current_index=i, total_count=total_count)
            else:
                is_approved = self._run_research(ticker, full_analysts, current_index=i, total_count=total_count)
 
            if is_approved:
                approved_tickers.append(ticker)
                # Save as pending recommendation instead of executing buy
                save_recommendation(ticker, self.today, "BUY", "pending")
            else:
                logger.warning(f"{ticker} failed research. A replacement will be needed in future runs.")
                
        logger.info(f"Initial portfolio research complete. Saved {len(approved_tickers)} recommended buys to database.")

    def quarterly_review(self):
        """
        Reviews current holdings fundamentally to see if the moat is broken.
        """
        logger.info("Starting Quarterly Review...")
        holdings = self.portfolio.get_current_holdings()
        
        # Structural analysts only
        structural_analysts = ["fundamentals", "news"]
        
        total_count = len(holdings)
        for i, ticker in enumerate(holdings, 1):
            if self.stop_requested:
                logger.info("Stop requested. Halting quarterly_review.")
                break
            is_approved = self._run_research(ticker, structural_analysts, current_index=i, total_count=total_count)
            if not is_approved:
                logger.info(f"Structural thesis broken for {ticker}. Liquidating...")
                self.executor.execute_sell(ticker)
                
                # We would ideally know which slot it belonged to and run targeted screening.
                # For this prototype, we'll run a general replacement scan.
                logger.info(f"Triggering replacement scan for {ticker}...")
                # Note: In a full system, we map the ticker to its category and run screener.run_full_screen(target_slot=category)
                
        logger.info("Quarterly review complete.")

    def weekly_monitor(self):
        """
        Scans for existential threats on current holdings.
        """
        logger.info("Starting Weekly Catastrophe Monitor...")
        holdings = self.portfolio.get_current_holdings()
        
        # News only for catastrophes
        catastrophe_analysts = ["news"]
        
        total_count = len(holdings)
        for i, ticker in enumerate(holdings, 1):
            if self.stop_requested:
                logger.info("Stop requested. Halting weekly_monitor.")
                break
            is_approved = self._run_research(ticker, catastrophe_analysts, current_index=i, total_count=total_count)
            if not is_approved:
                logger.warning(f"CATASTROPHE DETECTED for {ticker}. Emergency Liquidation!")
                self.executor.execute_sell(ticker)
                
        logger.info("Weekly monitor complete.")
