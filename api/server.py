import asyncio
import json
import logging
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, BackgroundTasks, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from tradingagents.pipeline.live_pipeline import LivePipeline
from tradingagents.pipeline.portfolio_manager import PortfolioManager
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph
from cli.main import classify_message_type

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="TradingAgents API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

event_queue = asyncio.Queue()
loop = None

from pydantic import BaseModel

class PipelineRequest(BaseModel):
    llm_provider: str = "google"
    paper: bool = True
    screener_model: Optional[str] = None
    quick_model: Optional[str] = None
    deep_model: Optional[str] = None
    execution_model: Optional[str] = None
    stocks_per_category: int = 3
    custom_tickers: Optional[str] = None
    scan_entire_market: bool = True

# Global state for frontend polling
live_state = {
    "is_running": False,
    "operation": None,
    "ticker": None,
    "current": 0,
    "total": 0,
    "progress": "",
    "agent_status": {}, # e.g. {"market": "in_progress", "social": "pending"}
    "reports": {},
    "llm_provider": None,
    "screener_model": None,
    "quick_model": None,
    "deep_model": None,
    "execution_model": None,
    "error": None,
}

CURRENT_PIPELINE = [None]

def emit_event(event_type: str, data: Any):
    try:
        payload = {"event": event_type, "data": json.dumps(data)}
        asyncio.run_coroutine_threadsafe(
            event_queue.put(json.dumps(payload)),
            loop
        )
    except Exception as e:
        logger.error(f"Failed to emit event: {e}")

@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()

def api_research_callback(ticker: str, analysts: List[str], checkpoint: bool, current_idx: int, total: int):
    op_name = live_state["operation"] or "Live Pipeline"
    
    live_state["ticker"] = ticker
    live_state["current"] = current_idx
    live_state["total"] = total
    live_state["progress"] = f"({current_idx}/{total})"
    live_state["analysts"] = analysts
    live_state["agent_status"] = {a: "pending" for a in analysts}
    live_state["reports"] = {}
    
    emit_event("pipeline_status", {"ticker": ticker, "current": current_idx, "total": total, "operation": op_name})
    
    config = DEFAULT_CONFIG.copy()
    config["checkpoint_enabled"] = checkpoint
    if live_state.get("llm_provider"):
        config["llm_provider"] = live_state["llm_provider"]
    if live_state.get("quick_model"):
        config["quick_think_llm"] = live_state["quick_model"]
    if live_state.get("deep_model"):
        config["deep_think_llm"] = live_state["deep_model"]
    if live_state.get("execution_model"):
        config["execution_llm"] = live_state["execution_model"]

    graph = TradingAgentsGraph(selected_analysts=analysts, config=config)
    instrument_context = graph.resolve_instrument_context(ticker, "stock")
    init_agent_state = graph.propagator.create_initial_state(
        ticker,
        datetime.now().strftime("%Y-%m-%d"),
        asset_type="stock",
        instrument_context=instrument_context,
    )
    args = graph.propagator.get_graph_args()

    trace = []
    processed_msg_ids = set()
    
    emit_event("research_start", {"ticker": ticker, "analysts": analysts})

    for chunk in graph.graph.stream(init_agent_state, **args):
        for message in chunk.get("messages", []):
            msg_id = getattr(message, "id", None)
            if msg_id is not None:
                if msg_id in processed_msg_ids:
                    continue
                processed_msg_ids.add(msg_id)

            msg_type, content = classify_message_type(message)
            if content and content.strip():
                atype = msg_type.lower()
                if atype in live_state["agent_status"] and live_state["agent_status"][atype] != "completed":
                    live_state["agent_status"][atype] = "in_progress"
                emit_event("agent_message", {"type": msg_type, "content": content})

            if hasattr(message, "tool_calls") and message.tool_calls:
                for tool_call in message.tool_calls:
                    name = tool_call["name"] if isinstance(tool_call, dict) else tool_call.name
                    t_args = tool_call["args"] if isinstance(tool_call, dict) else tool_call.args
                    emit_event("tool_call", {"name": name, "args": t_args})

        reports = {}
        for key in ["market_report", "sentiment_report", "news_report", "fundamentals_report", "investment_plan", "trader_investment_plan", "final_trade_decision"]:
            if key in chunk and chunk[key]:
                reports[key] = chunk[key]
                
        if chunk.get("investment_debate_state"):
            debate_state = chunk["investment_debate_state"]
            reports["debate"] = {
                "bull": debate_state.get("bull_history", "").strip(),
                "bear": debate_state.get("bear_history", "").strip(),
                "judge": debate_state.get("judge_decision", "").strip()
            }
            
        if chunk.get("risk_debate_state"):
            risk_state = chunk["risk_debate_state"]
            reports["risk_debate"] = {
                "aggressive": risk_state.get("aggressive_history", "").strip(),
                "conservative": risk_state.get("conservative_history", "").strip(),
                "neutral": risk_state.get("neutral_history", "").strip(),
                "judge": risk_state.get("judge_decision", "").strip()
            }
            
        if reports:
            live_state["reports"].update(reports)
            if reports.get("market_report"): live_state["agent_status"]["market"] = "completed"
            if reports.get("sentiment_report"): live_state["agent_status"]["social"] = "completed"
            if reports.get("news_report"): live_state["agent_status"]["news"] = "completed"
            if reports.get("fundamentals_report"): live_state["agent_status"]["fundamentals"] = "completed"
            emit_event("report_update", reports)

        trace.append(chunk)

    for k in live_state["agent_status"]:
        live_state["agent_status"][k] = "completed"

    final_state = {}
    for chunk in trace:
        final_state.update(chunk)
    decision = graph.process_signal(final_state["final_trade_decision"])
    
    emit_event("research_complete", {"ticker": ticker, "decision": decision})

    graph.ticker = ticker
    
    # Do not save mock runs to historical reports
    if live_state.get("llm_provider") != "mock":
        graph._log_state(datetime.now().strftime("%Y-%m-%d"), final_state)

    return decision.upper() == "BUY" or decision.upper() == "HOLD"

def run_pipeline_task(operation: str, req: PipelineRequest):
    live_state["is_running"] = True
    live_state["error"] = None
    live_state["operation"] = operation
    live_state["llm_provider"] = req.llm_provider
    live_state["quick_model"] = req.quick_model
    live_state["deep_model"] = req.deep_model
    
    global CURRENT_PIPELINE
    pipeline = LivePipeline(paper=req.paper, checkpoint=False, research_fn=api_research_callback)
    CURRENT_PIPELINE[0] = pipeline
    
    try:
        if operation == "init":
            tickers = None
            if req.custom_tickers:
                tickers = [t.strip().upper() for t in req.custom_tickers.split(",") if t.strip()]
            pipeline.init_portfolio(stocks_per_category=req.stocks_per_category, tickers=tickers)
        elif operation == "quarterly":
            pipeline.quarterly_review()
        elif operation == "weekly":
            pipeline.weekly_monitor()
        emit_event("pipeline_complete", {"operation": operation, "status": "success"})
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        live_state["error"] = str(e)
        emit_event("pipeline_error", {"operation": operation, "error": str(e)})
    finally:
        live_state["is_running"] = False
        live_state["operation"] = None
        CURRENT_PIPELINE[0] = None

@app.get("/api/pipeline/status")
async def get_pipeline_status():
    return live_state

def run_screener_task(req: PipelineRequest):
    live_state["is_running"] = True
    live_state["error"] = None
    live_state["operation"] = "screener"
    live_state["ticker"] = "Screening Universe..."
    live_state["progress"] = "in_progress"
    
    emit_event("pipeline_status", {"ticker": "Screening Market...", "current": 0, "total": 0, "operation": "screener"})
    
    try:
        from tradingagents.pipeline.screener_agent import ScreenerAgent
        from tradingagents.db import init_db, save_report
        from datetime import datetime
        from tradingagents.default_config import DEFAULT_CONFIG
        
        screener = ScreenerAgent(config={
            "llm_provider": req.llm_provider,
            "screener_llm": req.screener_model or req.quick_model,
            "backend_url": DEFAULT_CONFIG.get("backend_url")
        })
        
        if not req.scan_entire_market and req.custom_tickers:
            screener.universe = [t.strip().upper() for t in req.custom_tickers.split(",") if t.strip()]
            
        stocks_per_cat = int(req.stocks_per_category)
        reasoning, allocations = screener.run_full_screen(stocks_per_category=stocks_per_cat, scan_entire_market=req.scan_entire_market)
        
        # Save the manual screener run to DB
        init_db()
        today = datetime.now().strftime("%Y-%m-%d")
        report_payload = {
            "reasoning": reasoning,
            "selections": allocations
        }
        save_report("SCREENER_REPORT", today, report_payload)
        
        emit_event("screener_complete", report_payload)
    except Exception as e:
        logger.error(f"Screener failed: {e}")
        live_state["error"] = str(e)
        emit_event("pipeline_error", {"operation": "screener", "error": str(e)})
    finally:
        live_state["is_running"] = False
        live_state["operation"] = None

@app.post("/api/screener/run")
async def run_screener(req: PipelineRequest, background_tasks: BackgroundTasks):
    """Run the Screener asynchronously to generate a report."""
    if live_state["is_running"]:
        raise HTTPException(status_code=400, detail="Pipeline is already running")
    background_tasks.add_task(asyncio.to_thread, run_screener_task, req)
    return {"status": "started", "operation": "screener"}

@app.get("/api/screener/latest")
async def get_latest_screener():
    from tradingagents.db import init_db, list_reports, get_report
    init_db()
    reports = list_reports()
    dates = reports.get("SCREENER_REPORT", [])
    if not dates:
        return {"error": "No screener report found"}
    latest_date = dates[0]
    data = get_report("SCREENER_REPORT", latest_date)
    return {"date": latest_date, "report": data}

@app.post("/api/pipeline/{operation}")
async def start_pipeline(operation: str, req: PipelineRequest, background_tasks: BackgroundTasks):
    if live_state["is_running"]:
        raise HTTPException(status_code=400, detail="Pipeline is already running")
    if operation not in ["init", "quarterly", "weekly"]:
        raise HTTPException(status_code=400, detail="Invalid operation")
    background_tasks.add_task(asyncio.to_thread, run_pipeline_task, operation, req)
    return {"status": "started", "operation": operation}

@app.post("/api/pipeline/stop")
async def stop_pipeline():
    if not live_state["is_running"] or not CURRENT_PIPELINE[0]:
        raise HTTPException(status_code=400, detail="Pipeline is not running")
    CURRENT_PIPELINE[0].stop_requested = True
    return {"status": "stop_requested"}

@app.get("/api/portfolio")
async def get_portfolio(paper: bool = True):
    manager = PortfolioManager(paper=paper)
    holdings = manager.get_current_holdings()
    return {"holdings": holdings}

@app.get("/api/reports")
async def list_reports():
    from tradingagents.db import init_db, list_reports
    init_db()
    reports = list_reports()
    return {"reports": reports}

@app.get("/api/reports/{ticker}/{date}")
async def get_report(ticker: str, date: str):
    from tradingagents.db import init_db, get_report
    init_db()
    report_data = get_report(ticker, date)
    if report_data:
        return report_data
    return {"error": "Report not found"}

@app.get("/api/recommendations")
async def get_recommendations_api():
    from tradingagents.db import init_db, get_pending_recommendations
    init_db()
    recs = get_pending_recommendations()
    return {"recommendations": recs}

class BuyRequest(BaseModel):
    ticker: str
    paper: bool = True

@app.post("/api/executor/buy")
async def execute_buy_api(req: BuyRequest):
    from tradingagents.pipeline.executor_agent import AlpacaExecutorAgent
    from tradingagents.db import init_db, update_recommendation_status
    try:
        executor = AlpacaExecutorAgent(paper=req.paper)
        executor.execute_buy(req.ticker.upper(), total_slots=15)
        init_db()
        update_recommendation_status(req.ticker.upper(), "executed")
        return {"status": "success", "message": f"Successfully executed buy for {req.ticker}"}
    except Exception as e:
        logger.error(f"Buy execution failed for {req.ticker}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class BuyAllRequest(BaseModel):
    paper: bool = True

@app.post("/api/executor/buy_all")
async def execute_buy_all_api(req: BuyAllRequest):
    from tradingagents.db import init_db, get_pending_recommendations, update_recommendation_status
    from tradingagents.pipeline.executor_agent import AlpacaExecutorAgent
    init_db()
    recs = get_pending_recommendations()
    if not recs:
        return {"status": "success", "message": "No pending recommendations to buy"}
    
    executor = AlpacaExecutorAgent(paper=req.paper)
    success_tickers = []
    failed_tickers = []
    
    for r in recs:
        ticker = r["ticker"]
        try:
            executor.execute_buy(ticker, total_slots=15)
            update_recommendation_status(ticker, "executed")
            success_tickers.append(ticker)
        except Exception as e:
            logger.error(f"Buy all execution failed for {ticker}: {e}")
            failed_tickers.append(ticker)
            
    return {
        "status": "success" if not failed_tickers else "partial_failure",
        "executed": success_tickers,
        "failed": failed_tickers
    }

@app.post("/api/recommendations/clear")
async def clear_recommendations_api():
    from tradingagents.db import init_db, clear_recommendations
    init_db()
    clear_recommendations()
    return {"status": "success", "message": "Cleared all pending recommendations"}

@app.get("/api/ticker/verify")
async def verify_ticker_api(ticker: str):
    import yfinance as yf
    try:
        t = yf.Ticker(ticker.upper())
        # Checking fast_info is much quicker than full info()
        price = t.fast_info.get("lastPrice") or t.fast_info.get("previousClose")
        if not price:
            raise Exception("No price data found")
        return {"status": "success", "ticker": ticker.upper(), "valid": True}
    except Exception as e:
        logger.error(f"Ticker verification failed for {ticker}: {e}")
        raise HTTPException(status_code=400, detail="Invalid ticker")

@app.get("/api/stream")
async def stream_events(request: Request):
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            try:
                event_data = await asyncio.wait_for(event_queue.get(), timeout=1.0)
                yield event_data
            except asyncio.TimeoutError:
                yield json.dumps({"event": "ping", "data": ""})
    
    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
