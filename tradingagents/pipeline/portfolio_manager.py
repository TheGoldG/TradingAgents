import logging
from typing import List

try:
    from alpaca.trading.client import TradingClient
except ImportError:
    TradingClient = None

import os

logger = logging.getLogger(__name__)

class PortfolioManager:
    def __init__(self, paper: bool = True):
        self.api_key = os.environ.get("ALPACA_API_KEY", "")
        self.secret_key = os.environ.get("ALPACA_SECRET_KEY", "")
        self.paper = paper
        
        if not self.api_key or not self.secret_key:
            logger.warning("Alpaca API keys not found in environment. Portfolio manager will use simulation data.")
            self.client = None
        elif TradingClient:
            self.client = TradingClient(self.api_key, self.secret_key, paper=self.paper)
        else:
            self.client = None

    def get_current_holdings(self) -> List[str]:
        """
        Retrieves a list of ticker symbols currently held in the portfolio.
        """
        if not self.client:
            # Return dummy simulation data if no API keys
            return ["AAPL", "JNJ", "JPM", "CAT", "CRWD"]
            
        try:
            positions = self.client.get_all_positions()
            tickers = [p.symbol for p in positions]
            logger.info(f"Retrieved {len(tickers)} current holdings.")
            return tickers
        except Exception as e:
            logger.error(f"Failed to fetch holdings from Alpaca: {e}")
            return []
