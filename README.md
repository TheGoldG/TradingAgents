# TradingAgents: Multi-Agent AI Financial Trading & Research Platform

TradingAgents is a state-of-the-art multi-agent financial framework that mirrors the operations of a real-world quantitative trading firm. Driven by specialized LLM agents coordinated via LangGraph, the platform automatically screens, researches, debates, and executes trading decisions in a simulated environment.

The system features a **premium web-based dashboard** (React + FastAPI) that allows users to interact with, control, and visualize the multi-agent pipeline in real-time.

---

## Key Features

### 1. Multi-Agent Analysis Pipeline
Under the hood, TradingAgents deploys specialized AI agents to analyze a stock from all angles:
* **Fundamentals Analyst:** Scrutinizes company balance sheets, income statements, and cash flows to evaluate financial health.
* **Technical Analyst:** Computes and interprets technical indicators (e.g., MACD, RSI, stockstats) to detect price patterns.
* **Sentiment Analyst:** Scrapes social channels (Reddit, StockTwits) and headlines to gauge short-term market mood.
* **News & Macro Analyst:** Monitors global macroeconomic news and geopolitical risks.
* **Research Team (Bull vs. Bear Debate):** Simulates a structured debate between optimistic and skeptical viewpoints to balance risk and reward.
* **Trader Agent & Risk Management:** Formulates trade proposals, which are approved/rejected by a final **Portfolio Manager** node.

### 2. Interactive Moat & Market Screener
* **Full Market Scan:** Toggle on to scan the entire S&P 500 index.
* **Custom Stock Screening:** Toggle off to focus analysis on a custom set of stock tickers.
* **Moat Recommendations:** Instantly check if a scanned stock is *"Recommended by Moat"* or *"Not Recommended by Moat"* based on agent analysis.
* **Custom Slot Selection:** Manually append newly researched tickers using a tag-based input UI, complete with duplicate checks.

### 3. Live Research Executor
* Run weekly monitoring or quarterly review pipelines.
* Watch the live output streams, see which tool is currently running, monitor current step badges, and read reports dynamically as they complete.
* View agent-by-agent status in real-time.

### 4. Historical Reports Browser
* Retrieve, filter, and inspect previously generated multi-agent research reports.
* Features integrated external links (Yahoo Finance icons) for easy, direct charting and market data lookup.

### 5. Multi-Model Support
* Run pipelines using **Google Gemini**, **OpenAI GPT**, **Anthropic Claude**, **DeepSeek**, **Qwen**, **GLM**, **MiniMax**, or local models via **Ollama**.

---

## Project Structure

```
TradingAgents/
├── api/                  # FastAPI backend server
│   └── server.py         # REST & SSE stream endpoints
├── frontend/             # Vite + React dashboard client
│   ├── src/              # React components & CSS styling
│   └── dist/             # Compiled production build
├── tradingagents/        # Core multi-agent logic
│   ├── agents/           # Specialized agent definitions
│   ├── dataflows/        # Financial data fetching & indicators
│   ├── graph/            # LangGraph state chart configuration
│   └── pipeline/         # High-level pipeline flows (screener, live review)
├── cli/                  # Command-line interface version
└── tests/                # Automated testing suites
```

---

## Installation & Setup

### Prerequisites
* **Python 3.10+** (Conda recommended)
* **Node.js** (v18+) & **npm**

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/TauricResearch/TradingAgents.git
cd TradingAgents
```

### Step 2: Configure Environment Variables
Copy the `.env.example` file to `.env` and enter your API keys:
```bash
cp .env.example .env
```
Ensure you provide at least one LLM API key (e.g., `GOOGLE_API_KEY` for Gemini or `OPENAI_API_KEY` for GPT):
```env
GOOGLE_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
```

---

### Step 3: Run the Python Backend
Activate your Python/Conda environment and install the dependencies:
```bash
conda activate tradingagents
pip install -e .
```
Start the FastAPI server:
```bash
python -m uvicorn api.server:app --reload
```
The backend will run locally at `http://localhost:8000`.

---

### Step 4: Run the React Frontend
Open a new terminal, navigate to the `frontend` folder, and start the development server:
```bash
cd frontend
npm install
npm run dev
```
Open your browser and navigate to the address shown (usually `http://localhost:5173`).

---

## Caches and State Persistence
* **Checkpoints & Logs:** Persistent agent state databases are saved under `~/.tradingagents/cache/checkpoints/`.
* **Trading Memory:** Realized returns and past decisions are appended to the Markdown decision log under `~/.tradingagents/memory/trading_memory.md` to guide future Portfolio Manager choices.
