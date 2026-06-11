import os
import logging
from typing import List

try:
    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import MarketOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce
except ImportError:
    TradingClient = None

logger = logging.getLogger(__name__)

class AlpacaExecutorAgent:
    def __init__(self, paper: bool = True):
        self.api_key = os.environ.get("ALPACA_API_KEY", "")
        self.secret_key = os.environ.get("ALPACA_SECRET_KEY", "")
        self.paper = paper
        
        if not self.api_key or not self.secret_key:
            logger.warning("Alpaca API keys not found in environment. Execution will be simulated.")
            self.client = None
        elif TradingClient:
            self.client = TradingClient(self.api_key, self.secret_key, paper=self.paper)
        else:
            logger.warning("alpaca-py not installed. Execution will be simulated.")
            self.client = None

    def execute_buy(self, ticker: str, total_slots: int = 15):
        """
        Calculates the 1/15th allocation and executes a buy order.
        """
        logger.info(f"Executing equal-weight BUY for {ticker} (1/{total_slots} of portfolio)")
        
        if not self.client:
            logger.info(f"[SIMULATION] Bought ~{100/total_slots:.2f}% allocation of {ticker}")
            return
            
        try:
            account = self.client.get_account()
            equity = float(account.equity)
            
            # Target 1/15th of the entire portfolio equity
            target_allocation = equity / total_slots
            
            # Submit a notional (fractional) market order if supported, 
            # otherwise we'd need to fetch current price and calculate qty.
            # Alpaca supports notional orders for market buys.
            order_data = MarketOrderRequest(
                symbol=ticker,
                notional=target_allocation,
                side=OrderSide.BUY,
                time_in_force=TimeInForce.DAY
            )
            
            order = self.client.submit_order(order_data)
            logger.info(f"Successfully submitted order for {ticker}: {order.id}")
        except Exception as e:
            logger.error(f"Failed to execute buy for {ticker}: {e}")

    def execute_sell(self, ticker: str):
        """
        Liquidates the entire position for a ticker.
        """
        logger.info(f"Executing full liquidation SELL for {ticker}")
        
        if not self.client:
            logger.info(f"[SIMULATION] Sold all holdings of {ticker}")
            return
            
        try:
            self.client.close_position(ticker)
            logger.info(f"Successfully closed position for {ticker}")
        except Exception as e:
            logger.error(f"Failed to close position for {ticker}: {e}")
