import React, { useState, useEffect } from 'react';
import LiveResearch from './components/LiveResearch';
import Portfolio from './components/Portfolio';
import HistoricalReports from './components/HistoricalReports';
import Screener from './components/Screener';
import Executor from './components/Executor';
import { Play, ShieldAlert, ShieldCheck, LayoutDashboard, History, Sun, Moon, LineChart, Search, Activity, ArrowRight } from 'lucide-react';

function App() {
  const PROVIDERS = [
    { id: 'openai', label: 'OpenAI (GPT)' },
    { id: 'google', label: 'Google (Gemini)' },
    { id: 'anthropic', label: 'Anthropic (Claude)' },
    { id: 'xai', label: 'xAI (Grok)' },
    { id: 'deepseek', label: 'DeepSeek' },
    { id: 'qwen', label: 'Qwen' },
    { id: 'glm', label: 'GLM' },
    { id: 'minimax', label: 'MiniMax' },
    { id: 'ollama', label: 'Ollama (Local)' },
    { id: 'mock', label: 'Mock (Free Testing)' }
  ];

  const MODELS = {
    openai: {
      quick: ['gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.5', 'gpt-4.1'],
      deep: ['gpt-5.5', 'gpt-5.4', 'gpt-5.2', 'gpt-5.5-pro']
    },
    anthropic: {
      quick: ['claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-sonnet-4-5'],
      deep: ['claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6']
    },
    google: {
      quick: ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
      deep: ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash']
    },
    xai: {
      quick: ['grok-4.3', 'grok-build-0.1', 'grok-4-fast-non-reasoning'],
      deep: ['grok-4.3', 'grok-4.20-0309-reasoning', 'grok-4-fast-reasoning', 'grok-4-0709']
    },
    deepseek: {
      quick: ['deepseek-v4-flash', 'deepseek-chat', 'custom'],
      deep: ['deepseek-v4-pro', 'deepseek-reasoner', 'deepseek-chat', 'custom']
    },
    qwen: {
      quick: ['qwen3.6-flash', 'qwen3.5-flash', 'custom'],
      deep: ['qwen3.7-max', 'qwen3.6-plus', 'qwen3.5-plus', 'custom']
    },
    glm: {
      quick: ['glm-5-turbo', 'glm-4.7', 'glm-4.5-air', 'custom'],
      deep: ['glm-5.1', 'glm-5', 'glm-4.7', 'custom']
    },
    minimax: {
      quick: ['MiniMax-M2.7-highspeed', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1-highspeed', 'custom'],
      deep: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.1', 'MiniMax-M2', 'custom']
    },
    ollama: {
      quick: ['qwen3:latest', 'gpt-oss:latest', 'glm-4.7-flash:latest', 'custom'],
      deep: ['glm-4.7-flash:latest', 'gpt-oss:latest', 'qwen3:latest', 'custom']
    },
    mock: {
      quick: ['mock-quick-1.0'],
      deep: ['mock-deep-1.0']
    }
  };

  const [pipelineState, setPipelineState] = useState({ is_running: false, operation: null });

  const getInitialTab = () => {
    const path = window.location.pathname;
    if (path === '/' || path === '') return 'landing';
    if (path.includes('/maintenance')) return 'maintenance';
    if (path.includes('/reports')) return 'history';
    if (path.includes('/research')) return 'live';
    return 'landing';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [step, setStep] = useState('screener');

  // Synchronize activeTab state to URL path
  useEffect(() => {
    let path = '/';
    if (activeTab === 'live') {
      path = '/research';
    } else if (activeTab === 'maintenance') {
      path = '/maintenance';
    } else if (activeTab === 'history') {
      path = '/reports';
    }
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, [activeTab]);

  // Support back/forward navigation in the browser
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/' || path === '') {
        setActiveTab('landing');
      } else if (path.includes('/maintenance')) {
        setActiveTab('maintenance');
      } else if (path.includes('/reports')) {
        setActiveTab('history');
      } else if (path.includes('/research')) {
        setActiveTab('live');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [screenerTickers, setScreenerTickers] = useState([]);
  
  const [llmProvider, setLlmProvider] = useState('google');
  const [screenerModel, setScreenerModel] = useState(MODELS['google'].quick[0]);
  const [quickModel, setQuickModel] = useState(MODELS['google'].quick[0]);
  const [deepModel, setDeepModel] = useState(MODELS['google'].deep[0]);
  const [executionModel, setExecutionModel] = useState(MODELS['google'].deep[0]);

  const [theme, setTheme] = useState('dark');
  const [runType, setRunType] = useState('init');
  const [stocksPerCategory, setStocksPerCategory] = useState(3);

  // Handle dark/light mode toggle
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  // Handle provider change to update default models
  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setLlmProvider(newProvider);
    setScreenerModel(MODELS[newProvider].quick[0]);
    setQuickModel(MODELS[newProvider].quick[0]);
    setDeepModel(MODELS[newProvider].deep[0]);
    setExecutionModel(MODELS[newProvider].deep[0]);
  };

  // Poll backend for pipeline status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/pipeline/status');
        const data = await res.json();
        setPipelineState(data);
      } catch (e) {
        // ignore
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerPipeline = async (operation, tickers = null) => {
    setPipelineState({ is_running: true, operation });
    setActiveTab('live');
    
    // Automatically redirect maintenance operations to research step
    if (operation === 'quarterly' || operation === 'weekly') {
      setStep('research');
    }
    
    try {
      const body = { 
        llm_provider: llmProvider, 
        screener_model: screenerModel,
        quick_model: quickModel,
        deep_model: deepModel,
        execution_model: executionModel,
        stocks_per_category: parseInt(stocksPerCategory)
      };
      if (tickers) {
        body.custom_tickers = tickers.join(',');
      }
      
      await fetch(`http://localhost:8000/api/pipeline/${operation}?paper=true`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.error("Failed to start pipeline", e);
    }
  };

  const stopPipeline = async () => {
    try {
      await fetch('http://localhost:8000/api/pipeline/stop', { method: 'POST' });
    } catch (e) {
      console.error("Failed to stop pipeline", e);
    }
  };

  const isRunning = pipelineState.is_running;

  if (activeTab === 'landing') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        width: '100vw', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        fontFamily: 'Inter, sans-serif',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}>
        {/* Top Navbar */}
        <header style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '1.25rem 2.5rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-surface)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <LineChart size={24} color="var(--accent-color)" strokeWidth={2.5} />
            <span style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>TradingAgents</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '6px' }}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                {theme === 'dark' ? 'Light' : 'Dark'}
              </span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-surface-hover)', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>System Active</span>
            </div>
          </div>
        </header>

        {/* Hero & Main Content */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '4rem 2rem',
          maxWidth: '1000px',
          margin: '0 auto',
          width: '90%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              color: 'var(--accent-color)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.2em',
              marginBottom: '1rem',
              display: 'block'
            }}>
              Autonomous Investment Engine
            </span>
            <h1 style={{ 
              fontSize: '3.25rem', 
              fontWeight: 800, 
              fontFamily: 'Outfit, sans-serif',
              margin: '0 0 1.25rem 0',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              lineHeight: '1.15'
            }}>
              Supercharge your research workflow.
            </h1>
            <p style={{ 
              fontSize: '1.1rem', 
              color: 'var(--text-secondary)', 
              maxWidth: '650px', 
              margin: '0 auto 2.5rem', 
              lineHeight: '1.6' 
            }}>
              Autonomous qualitative research, quantitative economic moat screening, and execution agent universe.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => setActiveTab('live')}
              style={{ 
                padding: '0.8rem 2.5rem', 
                fontSize: '1.05rem', 
                fontWeight: 600, 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                background: 'var(--accent-color)',
                color: 'var(--accent-text)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              Enter Terminal <ArrowRight size={18} />
            </button>
          </div>

          {/* Steps Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '1.5rem', 
            width: '100%' 
          }}>
            <div className="data-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '6px', color: 'var(--accent-color)', display: 'flex' }}>
                  <Search size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>1. Moat Screener</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Filter the market quantitatively on PEG, ROE, and Debt-to-Equity, then execute qualitative economic moat evaluations using LLMs.
              </p>
            </div>

            <div className="data-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '6px', color: 'var(--accent-color)', display: 'flex' }}>
                  <Activity size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>2. Moat Research</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Run multi-agent debates between bulls and bears to test moats, analyze business risks, and extract granular investment findings.
              </p>
            </div>

            <div className="data-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.5rem', borderRadius: '6px', color: 'var(--accent-color)', display: 'flex' }}>
                  <ShieldCheck size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>3. Trade Execution</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Submit recommendation orders, track portfolio performance, and review positions inside the auto-rebalancing executor terminal.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
          <LineChart size={28} color="var(--accent-color)" strokeWidth={2.5} />
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontFamily: 'Outfit, sans-serif' }}>TradingAgents</h1>
        </div>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            className={`btn ${activeTab !== 'live' ? 'btn-secondary' : ''}`}
            onClick={() => setActiveTab('live')}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
          >
            <LayoutDashboard size={18} /> Research
          </button>
          <button 
            className={`btn ${activeTab !== 'maintenance' ? 'btn-secondary' : ''}`}
            onClick={() => setActiveTab('maintenance')}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
          >
            <ShieldCheck size={18} /> Risk & Maintenance
          </button>
          <button 
            className={`btn ${activeTab !== 'history' ? 'btn-secondary' : ''}`}
            onClick={() => setActiveTab('history')}
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
          >
            <History size={18} /> Historical Reports
          </button>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {theme === 'dark' ? <><Sun size={18} /> Light Mode</> : <><Moon size={18} /> Dark Mode</>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Configuration Bar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Provider</label>
              <select value={llmProvider} onChange={handleProviderChange} disabled={isRunning} className="modern-select">
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </header>

        <div className="content-area">
          {activeTab === 'live' && (
            <>


              <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  {/* Stepper Header */}
                  <div className="data-card" style={{ padding: '0 1.5rem' }}>
                    <div className="stepper-container">
                      <div 
                        className={`step ${step === 'screener' || step === 'research' || step === 'executor' ? 'active' : ''}`}
                        onClick={() => setStep('screener')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="step-circle">1</div>
                        <div className="step-label">Screener</div>
                      </div>
                      <div className="step-line" style={{ background: step === 'research' || step === 'executor' ? 'var(--accent-color)' : 'var(--border-color)' }}></div>
                      <div 
                        className={`step ${step === 'research' || step === 'executor' ? 'active' : ''}`}
                        onClick={() => setStep('research')}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="step-circle">2</div>
                        <div className="step-label">Research</div>
                      </div>
                      <div className="step-line" style={{ background: step === 'executor' ? 'var(--accent-color)' : 'var(--border-color)' }}></div>
                      <div 
                        className={`step ${step === 'executor' ? 'active' : ''}`}
                        onClick={() => {
                          if (pipelineState.reports && Object.keys(pipelineState.reports).length > 0) {
                            setStep('executor');
                          }
                        }}
                        style={{ 
                          cursor: pipelineState.reports && Object.keys(pipelineState.reports).length > 0 ? 'pointer' : 'not-allowed', 
                          opacity: pipelineState.reports && Object.keys(pipelineState.reports).length > 0 ? 1 : 0.5 
                        }}
                      >
                        <div className="step-circle">3</div>
                        <div className="step-label">Execution</div>
                      </div>
                    </div>
                  </div>

                  {/* Wizard Steps */}
                  {step === 'screener' && (
                    <Screener 
                      llmProvider={llmProvider}
                      screenerModel={screenerModel}
                      setScreenerModel={setScreenerModel}
                      MODELS={MODELS}
                      quickModel={quickModel}
                      deepModel={deepModel}
                      stocksPerCategory={stocksPerCategory}
                      onProceedToResearch={(tickers) => {
                        setScreenerTickers(tickers);
                        setStep('research');
                      }}
                      pipelineState={pipelineState}
                    />
                  )}

                  {step === 'research' && (
                    <LiveResearch 
                      llmProvider={llmProvider}
                      quickModel={quickModel}
                      setQuickModel={setQuickModel}
                      deepModel={deepModel}
                      setDeepModel={setDeepModel}
                      MODELS={MODELS}
                      pipelineState={pipelineState}
                      screenerTickers={screenerTickers}
                      onRunResearch={(tickers) => triggerPipeline('init', tickers)}
                      onProceedToExecutor={() => setStep('executor')}
                    />
                  )}

                  {step === 'executor' && (
                    <Executor 
                      llmProvider={llmProvider}
                      executionModel={executionModel}
                      setExecutionModel={setExecutionModel}
                      MODELS={MODELS}
                    />
                  )}
                </div>
                
                <Portfolio />
              </div>
            </>
          )}

          {activeTab === 'maintenance' && (
            <div className="flex-col" style={{ gap: '1.5rem', width: '100%', maxWidth: '800px' }}>
              <div className="data-card">
                <h2 style={{ fontSize: '1.25rem', margin: 0, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Risk & Maintenance</h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                  Run scheduled maintenance scans across your existing portfolio.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  <div style={{ padding: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)' }}>
                      <Activity size={20} />
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Quarterly Review</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Deep fundamental review of all existing holdings. Assesses earnings reports, management changes, and long-term moat trajectory.
                    </p>
                    <button className="btn" onClick={() => triggerPipeline('quarterly')} disabled={isRunning} style={{ marginTop: 'auto', background: 'var(--success)', color: '#ffffff', border: 'none' }}>
                      {isRunning && runType === 'quarterly' ? 'Running...' : 'Run Quarterly Review'}
                    </button>
                  </div>

                  <div style={{ padding: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                      <ShieldCheck size={20} />
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Weekly Risk Monitor</h3>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Urgent risk scan focusing on recent news, short-term price action, and macroeconomic alerts.
                    </p>
                    <button className="btn" onClick={() => triggerPipeline('weekly')} disabled={isRunning} style={{ marginTop: 'auto', background: 'var(--danger)', color: '#ffffff', border: 'none' }}>
                      {isRunning && runType === 'weekly' ? 'Running...' : 'Run Weekly Monitor'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <HistoricalReports />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
