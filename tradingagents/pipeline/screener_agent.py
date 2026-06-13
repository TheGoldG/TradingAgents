import logging
import yfinance as yf
from typing import List, Dict, Any, Optional
import json
import pandas as pd
import concurrent.futures
import time
import random
import os
from datetime import datetime

from tradingagents.llm_clients import create_llm_client
from tradingagents.default_config import DEFAULT_CONFIG

logger = logging.getLogger(__name__)

def get_dynamic_universe() -> List[str]:
    """Fetches and deduplicates S&P 500 and Nasdaq 100 tickers from Wikipedia, with local caching."""
    cache_file = "universe_cache.json"
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # Load from cache if valid
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                cache_data = json.load(f)
                if cache_data.get("date") == today_str:
                    logger.info("Loaded dynamic universe from local cache.")
                    return cache_data.get("tickers", [])
        except Exception as e:
            logger.warning(f"Failed to load universe cache: {e}")

    import requests
    import io
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    logger.info("Fetching S&P 500 and Nasdaq 100 tickers from Wikipedia...")
    try:
        # Fetch S&P 500
        sp500_response = requests.get('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies', headers=headers)
        sp500_table = pd.read_html(io.StringIO(sp500_response.text))[0]
        sp500_tickers = sp500_table['Symbol'].tolist()
        
        # Fetch Nasdaq 100
        nasdaq_response = requests.get('https://en.wikipedia.org/wiki/Nasdaq-100', headers=headers)
        tables = pd.read_html(io.StringIO(nasdaq_response.text))
        nasdaq_tickers = []
        for t in tables:
            if 'Ticker' in t.columns:
                nasdaq_tickers = t['Ticker'].tolist()
                break
            elif 'Symbol' in t.columns:
                nasdaq_tickers = t['Symbol'].tolist()
                break
                
        # Deduplicate and clean up (e.g. BRK.B -> BRK-B for yfinance)
        combined = set(sp500_tickers + nasdaq_tickers)
        clean_tickers = [t.replace('.', '-') for t in combined if isinstance(t, str)]
        
        # Save to cache
        with open(cache_file, "w") as f:
            json.dump({"date": today_str, "tickers": clean_tickers}, f)
            
        return clean_tickers
    except Exception as e:
        import traceback
        logger.error(f"Failed to fetch dynamic universe: {e}")
        traceback.print_exc()
        # Fallback to a hard-coded list if Wikipedia fails
        return ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "PLTR", "CRWD", "SNOW", "DDOG"]

class ScreenerAgent:
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or DEFAULT_CONFIG
        # Use screener LLM for the moat analysis to save time and cost,
        # reserving the deep thinker for the actual research agents.
        llm_client = create_llm_client(
            provider=self.config["llm_provider"],
            model=self.config.get("screener_llm", self.config.get("quick_think_llm")),
            base_url=self.config.get("backend_url"),
        )
        self.llm = llm_client.get_llm()
        self.universe = get_dynamic_universe()

    def _evaluate_single_stock(self, ticker: str) -> Optional[Dict[str, Any]]:
        """Worker function for threading"""
        try:
            # Micro-delay to avoid API rate limits
            time.sleep(random.uniform(0.1, 0.5))
            stock = yf.Ticker(ticker)
            info = stock.info
            
            roe = info.get("returnOnEquity", 0) or 0
            de = info.get("debtToEquity", 0) or 0
            fcf = info.get("freeCashflow", 0) or 0
            peg = info.get("pegRatio", 0) or 0
            
            de_ratio = de / 100.0 if de > 10 else de
            
            if roe > 0.15 and de_ratio < 1.5 and fcf > 0 and 0 < peg < 2.5:
                return {
                    "ticker": ticker,
                    "name": info.get("shortName", ticker),
                    "roe": roe,
                    "de": de_ratio,
                    "fcf": fcf,
                    "peg": peg,
                    "sector": info.get("sector", "Unknown"),
                    "industry": info.get("industry", "Unknown"),
                    "summary": info.get("longBusinessSummary", "")[:500]
                }
        except Exception as e:
            # Silently ignore to avoid log spam, yfinance will throw 404s/429s occasionally
            pass
        return None

    def run_quantitative_scan(self) -> List[Dict[str, Any]]:
        """Filters stocks based on quantitative metrics: ROE, D/E, FCF, PEG using multithreading."""
        passed_stocks = []
        logger.info(f"Running multithreaded quantitative scan on {len(self.universe)} stocks...")
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
            # Submit all tasks
            future_to_ticker = {executor.submit(self._evaluate_single_stock, t): t for t in self.universe}
            
            for future in concurrent.futures.as_completed(future_to_ticker):
                result = future.result()
                if result:
                    passed_stocks.append(result)
                
        logger.info(f"Quantitative scan complete. {len(passed_stocks)} stocks passed.")
        return passed_stocks

    def _llm_moat_filter(self, candidates: List[Dict[str, Any]], slot: Optional[str] = None, stocks_per_category: int = 3) -> tuple[str, Dict[str, List[str]]]:
        """
        Uses an LLM to evaluate the Moat (High Switching Costs, Network Effects, Pricing Power)
        and categorizes them into the 5 pillars. If slot is provided, it only searches for that slot.
        Returns a tuple of (reasoning_markdown, allocations_dict).
        """
        prompt = (
            "You are a master value investor performing Buffett-style moat analysis.\n"
            "Evaluate the following list of companies based on:\n"
            "1. High Switching Costs\n"
            "2. Network Effects\n"
            "3. Pricing Power\n\n"
            f"I need you to select exactly {stocks_per_category} stocks for EACH of the following 5 categories "
            f"(if a specific slot is requested, only pick {stocks_per_category} for that slot). "
            "You must ONLY pick from the provided list of candidates.\n\n"
            "Categories:\n"
            "Slot 1: Secular Compounder (Big Tech/AI)\n"
            "Slot 2: Defensive Cash Cow (Consumer/Health)\n"
            "Slot 3: Financial/Infrastructure Lifeline\n"
            "Slot 4: Cyclical/Industrial Value Engine\n"
            "Slot 5: Asymmetric Moonshot (High Beta)\n\n"
            f"Return the output STRICTLY as a JSON object with two keys:\n"
            f"1. \"reasoning\": A detailed Markdown report explaining your thought process for every stock chosen, why it fits the slot, and its moat.\n"
            f"2. \"selections\": An object where keys are the Slot names and values are lists of {stocks_per_category} ticker strings.\n\n"
        )
        
        candidates_text = "\n".join([f"- {c['ticker']} ({c['name']}): Sector={c['sector']}, ROE={c['roe']:.2f}, PEG={c['peg']}" for c in candidates])
        
        if slot:
            prompt += f"REQUIRED SLOT: Only find {stocks_per_category} candidates for '{slot}'.\n"
            
        prompt += f"CANDIDATES:\n{candidates_text}\n\nJSON Output:"
        
        # Simple string-based parsing since some models don't support structured outputs flawlessly
        response = self.llm.invoke(prompt).content
        
        # Clean up JSON formatting if LLM wrapped in code block
        if "```json" in response:
            response = response.split("```json")[1].split("```")[0]
        elif "```" in response:
            response = response.split("```")[1].split("```")[0]
            
        try:
            parsed = json.loads(response.strip())
            reasoning = parsed.get("reasoning", "No reasoning provided.")
            allocations = parsed.get("selections", {})
            return reasoning, allocations
        except json.JSONDecodeError:
            logger.error(f"Failed to parse LLM output: {response}")
            return "Error parsing reasoning.", {}

    def run_full_screen(self, stocks_per_category: int = 3) -> tuple[str, Dict[str, List[str]]]:
        """
        Executes the entire screening pipeline: 
        1. Quantitative Scan (ROE, D/E, FCF)
        2. Qualitative Moat Filter via LLM
        Returns (reasoning, dictionary mapping slots to list of tickers).
        """
        quant_passed = self.run_quantitative_scan()
        if len(quant_passed) < stocks_per_category * 5:
            logger.warning("Too few candidates passed quant screen. Falling back to broader universe.")
            quant_passed = [{"ticker": t, "name": t, "sector": "", "roe": 0, "peg": 0} for t in self.universe]
            
        reasoning, final_allocations = self._llm_moat_filter(quant_passed, stocks_per_category=stocks_per_category)
        return reasoning, final_allocations
