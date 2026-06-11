import asyncio
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, BackgroundTasks, Request
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

# Enable CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global queue for SSE events
event_queue = asyncio.Queue()

# We need to bridge synchronous LangGraph calls with the async SSE stream.
# We'll run the pipeline in a background thread using asyncio.to_thread.

def emit_event(event_type: str, data: Any):
    """Utility to put an event into the queue for SSE."""
    try:
        # Put it in the queue wrapped as a standard data payload
        payload = {"event": event_type, "data": json.dumps(data)}
        asyncio.run_coroutine_threadsafe(
            event_queue.put(json.dumps(payload)),
            loop
        )
    except Exception as e:
        logger.error(f"Failed to emit event: {e}")

# This will hold the main event loop
loop = None

@app.on_event("startup")
async def startup_event():
    global loop
    loop = asyncio.get_running_loop()


# Custom research function to inject into LivePipeline to capture stream events
def api_research_callback(ticker: str, analysts: List[str], checkpoint: bool, current_idx: int, total: int):
    op_name = "Live Pipeline"
    emit_event("pipeline_status", {"ticker": ticker, "current": current_idx, "total": total, "operation": op_name})
    
    config = DEFAULT_CONFIG.copy()
    config["checkpoint_enabled"] = checkpoint

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
                emit_event("agent_message", {"type": msg_type, "content": content})

            if hasattr(message, "tool_calls") and message.tool_calls:
                for tool_call in message.tool_calls:
                    name = tool_call["name"] if isinstance(tool_call, dict) else tool_call.name
                    t_args = tool_call["args"] if isinstance(tool_call, dict) else tool_call.args
                    emit_event("tool_call", {"name": name, "args": t_args})

        # Process report sections for debate/reports
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
            emit_event("report_update", reports)

        trace.append(chunk)

    final_state = {}
    for chunk in trace:
        final_state.update(chunk)
    decision = graph.process_signal(final_state["final_trade_decision"])
    
    emit_event("research_complete", {"ticker": ticker, "decision": decision})

    graph.ticker = ticker
    graph._log_state(datetime.now().strftime("%Y-%m-%d"), final_state)

    return decision.upper() == "BUY" or decision.upper() == "HOLD"


def run_pipeline_task(operation: str, paper: bool = True):
    pipeline = LivePipeline(paper=paper, checkpoint=False, research_fn=api_research_callback)
    try:
        if operation == "init":
            pipeline.init_portfolio()
        elif operation == "quarterly":
            pipeline.quarterly_review()
        elif operation == "weekly":
            pipeline.weekly_monitor()
        emit_event("pipeline_complete", {"operation": operation, "status": "success"})
    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        emit_event("pipeline_error", {"operation": operation, "error": str(e)})


@app.post("/api/pipeline/{operation}")
async def start_pipeline(operation: str, background_tasks: BackgroundTasks, paper: bool = True):
    if operation not in ["init", "quarterly", "weekly"]:
        return {"error": "Invalid operation"}
    background_tasks.add_task(asyncio.to_thread, run_pipeline_task, operation, paper)
    return {"status": "started", "operation": operation}


@app.get("/api/portfolio")
async def get_portfolio(paper: bool = True):
    manager = PortfolioManager(paper=paper)
    holdings = manager.get_current_holdings()
    return {"holdings": holdings}


@app.get("/api/stream")
async def stream_events(request: Request):
    async def event_generator():
        while True:
            if await request.is_disconnected():
                break
            try:
                # Wait for an event with a timeout so we can check disconnects
                event_data = await asyncio.wait_for(event_queue.get(), timeout=1.0)
                yield event_data
            except asyncio.TimeoutError:
                yield json.dumps({"event": "ping", "data": ""})
    
    return EventSourceResponse(event_generator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
