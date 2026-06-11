import React, { useState, useEffect } from 'react';
import LiveResearch from './components/LiveResearch';
import Portfolio from './components/Portfolio';
import HistoricalReports from './components/HistoricalReports';
import { Play, ShieldAlert, CalendarClock, LayoutDashboard, History } from 'lucide-react';

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
      deep: ['gemini-3.1-pro', 'gemini-3.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash']
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
    }
  };

  const [pipelineState, setPipelineState] = useState({ is_running: false, operation: null });
  const [activeTab, setActiveTab] = useState('live');
  const [llmProvider, setLlmProvider] = useState('google');
  const [quickModel, setQuickModel] = useState(MODELS['google'].quick[0]);
  const [deepModel, setDeepModel] = useState(MODELS['google'].deep[0]);

  // Handle provider change to update default models
  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    setLlmProvider(newProvider);
    setQuickModel(MODELS[newProvider].quick[0]);
    setDeepModel(MODELS[newProvider].deep[0]);
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

  const triggerPipeline = async (operation) => {
    setPipelineState({ is_running: true, operation });
    setActiveTab('live');
    try {
      await fetch(`http://localhost:8000/api/pipeline/${operation}?paper=true`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          llm_provider: llmProvider, 
          quick_model: quickModel,
          deep_model: deepModel
        })
      });
    } catch (e) {
      console.error("Failed to start pipeline", e);
    }
  };

  const isRunning = pipelineState.is_running;

  return (
    <div className="app-container">
      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1>TradingAgents GUI</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Multi-Agent Autonomous Trading System</p>
      </header>

      {/* Main Control Panel */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="flex-row">
            <button 
              className={`btn ${activeTab !== 'live' ? 'btn-secondary' : ''}`}
              onClick={() => setActiveTab('live')}
              style={{ borderRadius: '99px' }}
            >
              <LayoutDashboard size={18} /> Live Dashboard
            </button>
            <button 
              className={`btn ${activeTab !== 'history' ? 'btn-secondary' : ''}`}
              onClick={() => setActiveTab('history')}
              style={{ borderRadius: '99px' }}
            >
              <History size={18} /> Historical Reports
            </button>
          </div>

          <div className="flex-row" style={{ alignItems: 'center', gap: '1rem' }}>
            <button className="btn" onClick={() => triggerPipeline('init')} disabled={isRunning}>
              <Play size={18} /> {isRunning && pipelineState.operation === 'init' ? 'Running...' : 'Initialize'}
            </button>
            <button className="btn btn-secondary" onClick={() => triggerPipeline('quarterly')} disabled={isRunning}>
              <CalendarClock size={18} /> Quarterly
            </button>
            <button className="btn btn-secondary" onClick={() => triggerPipeline('weekly')} disabled={isRunning}>
              <ShieldAlert size={18} /> Weekly
            </button>
          </div>
        </div>

        {/* LLM Configuration Row */}
        <div style={{ display: 'flex', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Provider</label>
            <select 
              value={llmProvider} 
              onChange={handleProviderChange} 
              disabled={isRunning}
              style={{ background: '#1a1a2e', color: '#ffffff', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.25rem 0.5rem', minWidth: '150px' }}
            >
              {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Quick Thinking Model</label>
            <select 
              value={quickModel} 
              onChange={e => setQuickModel(e.target.value)}
              disabled={isRunning}
              style={{ background: '#1a1a2e', color: '#ffffff', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.25rem 0.5rem', minWidth: '200px' }}
            >
              {MODELS[llmProvider].quick.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Deep Thinking Model</label>
            <select 
              value={deepModel} 
              onChange={e => setDeepModel(e.target.value)}
              disabled={isRunning}
              style={{ background: '#1a1a2e', color: '#ffffff', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.25rem 0.5rem', minWidth: '200px' }}
            >
              {MODELS[llmProvider].deep.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {activeTab === 'live' && (
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          <LiveResearch pipelineState={pipelineState} />
          <Portfolio />
        </div>
      )}

      {activeTab === 'history' && (
        <HistoricalReports />
      )}
    </div>
  );
}

export default App;
