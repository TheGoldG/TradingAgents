import React, { useState } from 'react';
import LiveResearch from './components/LiveResearch';
import Portfolio from './components/Portfolio';
import { Play, ShieldAlert, CalendarClock } from 'lucide-react';

function App() {
  const [loading, setLoading] = useState(false);

  const triggerPipeline = async (operation) => {
    setLoading(true);
    try {
      await fetch(`http://localhost:8000/api/pipeline/${operation}?paper=true`, { method: 'POST' });
    } catch (e) {
      console.error("Failed to start pipeline", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>TradingAgents GUI</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Multi-Agent Autonomous Trading System</p>
      </header>

      <div className="flex-row" style={{ justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => triggerPipeline('init')} disabled={loading}>
          <Play size={18} /> Initialize Portfolio
        </button>
        <button className="btn btn-secondary" onClick={() => triggerPipeline('quarterly')} disabled={loading}>
          <CalendarClock size={18} /> Quarterly Review
        </button>
        <button className="btn btn-secondary" onClick={() => triggerPipeline('weekly')} disabled={loading}>
          <ShieldAlert size={18} /> Weekly Monitor
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', alignItems: 'flex-start' }}>
        <LiveResearch />
        <Portfolio />
      </div>
    </div>
  );
}

export default App;
