import logging
import yfinance as yf
from typing import List, Dict, Any, Optional
import json

from tradingagents.llm_clients import create_llm_client
from tradingagents.default_config import DEFAULT_CONFIG

logger = logging.getLogger(__name__)

# A baseline universe of stocks to scan to avoid hitting yfinance rate limits
# while scanning the entire 5000+ US equities.
BASELINE_UNIVERSE = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL", "CRM",  # Tech/AI
    "JNJ", "UNH", "PG", "KO", "PEP", "ABBV", "PFE", "MRK", "TMO", "MDT",             # Health/Consumer
    "V", "MA", "JPM", "BAC", "AXP", "BLK", "GS", "MS", "C", "SPGI",                  # Financials/Infrastructure
    "CAT", "DE", "HON", "GE", "LMT", "RTX", "BA", "UNP", "UPS", "FDX",               # Cyclicals/Industrials
    "CRWD", "PLTR", "SNOW", "DDOG", "NET", "MDB", "SQ", "SHOP", "ROKU", "COIN"       # High Beta/Moonshots
]

class ScreenerAgent:
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or DEFAULT_CONFIG
        # Use deep thinker for the moat analysis
        llm_client = create_llm_client(
            provider=self.config["llm_provider"],
            model=self.config["deep_think_llm"],
            base_url=self.config.get("backend_url"),
        )
        self.llm = llm_client.get_llm()

    def run_quantitative_scan(self, universe: List[str] = BASELINE_UNIVERSE) -> List[Dict[str, Any]]:
        """Filters stocks based on quantitative metrics: ROE, D/E, FCF, PEG."""
        passed_stocks = []
        logger.info(f"Running quantitative scan on {len(universe)} stocks...")
        
        for ticker in universe:
            try:
                stock = yf.Ticker(ticker)
                info = stock.info
                
                # Fetch metrics safely
                roe = info.get("returnOnEquity", 0) or 0
                de = info.get("debtToEquity", 0) or 0
                fcf = info.get("freeCashflow", 0) or 0
                peg = info.get("pegRatio", 0) or 0
                
                # Debt to Equity is often returned as percentage (e.g. 150 for 1.5) by yfinance
                de_ratio = de / 100.0 if de > 10 else de
                
                # Filters: ROE > 15%, D/E < 1.0 (relaxing slightly to 1.5 for sectors), FCF > 0, PEG < 2.5
                if roe > 0.15 and de_ratio < 1.5 and fcf > 0 and 0 < peg < 2.5:
                    passed_stocks.append({
                        "ticker": ticker,
                        "name": info.get("shortName", ticker),
                        "roe": roe,
                        "de": de_ratio,
                        "fcf": fcf,
                        "peg": peg,
                        "sector": info.get("sector", "Unknown"),
                        "industry": info.get("industry", "Unknown"),
                        "summary": info.get("longBusinessSummary", "")[:500]
                    })
            except Exception as e:
                logger.warning(f"Failed to fetch data for {ticker}: {e}")
                
        logger.info(f"Quantitative scan complete. {len(passed_stocks)} stocks passed.")
        return passed_stocks

    def run_qualitative_filter(self, candidates: List[Dict[str, Any]], slot: Optional[str] = None) -> Dict[str, List[str]]:
        """
        Uses an LLM to evaluate the Moat (High Switching Costs, Network Effects, Pricing Power)
        and categorizes them into the 5 pillars. If slot is provided, it only searches for that slot.
        """
        prompt = (
            "You are a master value investor performing Buffett-style moat analysis.\n"
            "Evaluate the following list of companies based on:\n"
            "1. High Switching Costs\n"
            "2. Network Effects\n"
            "3. Pricing Power\n\n"
            "I need you to select exactly 3 stocks for EACH of the following 5 categories "
            "(if a specific slot is requested, only pick 3 for that slot). "
            "You must ONLY pick from the provided list of candidates.\n\n"
            "Categories:\n"
            "Slot 1: Secular Compounder (Big Tech/AI)\n"
            "Slot 2: Defensive Cash Cow (Consumer/Health)\n"
            "Slot 3: Financial/Infrastructure Lifeline\n"
            "Slot 4: Cyclical/Industrial Value Engine\n"
            "Slot 5: Asymmetric Moonshot (High Beta)\n\n"
            "Return the output STRICTLY as a JSON object where keys are the Slot names "
            "and values are lists of 3 ticker strings.\n\n"
        )
        
        candidates_text = "\n".join([f"- {c['ticker']} ({c['name']}): Sector={c['sector']}, ROE={c['roe']:.2f}, PEG={c['peg']}" for c in candidates])
        
        if slot:
            prompt += f"REQUIRED SLOT: Only find 3 candidates for '{slot}'.\n"
            
        prompt += f"CANDIDATES:\n{candidates_text}\n\nJSON Output:"
        
        # Simple string-based parsing since some models don't support structured outputs flawlessly
        response = self.llm.invoke(prompt).content
        
        # Clean up JSON formatting if LLM wrapped in code block
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            response = response.split("```")[1].split("```")[0]
            
        try:
            allocations = json.loads(response.strip())
            return allocations
        except json.JSONDecodeError:
            logger.error(f"Failed to parse LLM output: {response}")
            return {}

    def run_full_screen(self, target_slot: Optional[str] = None) -> Dict[str, List[str]]:
        """Runs the quantitative and qualitative screens and returns the 15 stocks (or 3 for a slot)."""
        candidates = self.run_quantitative_scan()
        # Fallback to the universe if too strict (just for resilience in demo/testing)
        if len(candidates) < 15:
            logger.warning("Too few candidates passed quant screen. Falling back to broader universe.")
            candidates = [{"ticker": t, "name": t, "sector": "", "roe": 0, "peg": 0} for t in BASELINE_UNIVERSE]
            
        allocations = self.run_qualitative_filter(candidates, slot=target_slot)
        return allocations
