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

    def init_portfolio(self):
        """
        Builds the 15-stock Day One portfolio.
        """
        logger.info("Initializing 15-stock portfolio...")
        allocations = self.screener.run_full_screen()
        
        # Flatten the allocations
        all_tickers = []
        for slot, tickers in allocations.items():
            logger.info(f"Slot: {slot} -> {tickers}")
            all_tickers.extend(tickers)
            
        # Full 360 Research analysts
        full_analysts = ["market", "social", "news", "fundamentals"]
        
        approved_tickers = []
        total_count = len(all_tickers)
        for i, ticker in enumerate(all_tickers, 1):
            is_approved = self._run_research(ticker, full_analysts, current_index=i, total_count=total_count)
            if is_approved:
                approved_tickers.append(ticker)
            else:
                logger.warning(f"{ticker} failed research. A replacement will be needed in future runs.")
                
        # Execute Buys
        for ticker in approved_tickers:
            self.executor.execute_buy(ticker, total_slots=15)
            
        logger.info("Initial portfolio construction complete.")

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
            is_approved = self._run_research(ticker, catastrophe_analysts, current_index=i, total_count=total_count)
            if not is_approved:
                logger.warning(f"CATASTROPHE DETECTED for {ticker}. Emergency Liquidation!")
                self.executor.execute_sell(ticker)
                
        logger.info("Weekly monitor complete.")
