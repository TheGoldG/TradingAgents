import React, { useState, useEffect } from 'react';
import { ShoppingCart, CheckCircle, RefreshCw, Trash2, ShieldAlert, ExternalLink } from 'lucide-react';

export default function Executor({ llmProvider, executionModel, setExecutionModel, MODELS }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState({}); // mapping ticker -> boolean
  const [executingAll, setExecutingAll] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchRecommendations = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/recommendations');
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (e) {
      console.error("Failed to fetch recommendations", e);
      setError("Failed to load recommended stocks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
    // Poll every 5 seconds to stay updated
    const interval = setInterval(fetchRecommendations, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBuySingle = async (ticker) => {
    setExecuting(prev => ({ ...prev, [ticker]: true }));
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('http://localhost:8000/api/executor/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, paper: true })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Successfully executed order for ${ticker}!`);
        // Refresh portfolio immediately in parent (well, it polls, but let's refresh our recommendations list)
        fetchRecommendations();
      } else {
        setError(data.detail || `Failed to buy ${ticker}`);
      }
    } catch (e) {
      setError(`Failed to execute buy order: ${e.message}`);
    } finally {
      setExecuting(prev => ({ ...prev, [ticker]: false }));
    }
  };

  const handleBuyAll = async () => {
    setExecutingAll(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('http://localhost:8000/api/executor/buy_all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper: true })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.failed && data.failed.length > 0) {
          setError(`Executed: ${data.executed.join(', ')}. Failed: ${data.failed.join(', ')}`);
        } else {
          setMessage(`Successfully executed orders for all recommended stocks: ${data.executed.join(', ')}`);
        }
        fetchRecommendations();
      } else {
        setError(data.detail || "Failed to execute bulk buy.");
      }
    } catch (e) {
      setError(`Failed to execute bulk buy: ${e.message}`);
    } finally {
      setExecutingAll(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Are you sure you want to clear all pending recommendations?")) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('http://localhost:8000/api/recommendations/clear', { method: 'POST' });
      if (res.ok) {
        setMessage("Recommendations cleared.");
        setRecommendations([]);
      }
    } catch (e) {
      setError("Failed to clear recommendations.");
    }
  };

  return (
    <div className="flex-col" style={{ width: '100%' }}>
      <div className="data-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.25rem' }}>Step 3: Portfolio Execution</h2>
            <p className="text-sm" style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Execute buys manually. These recommended stocks passed both the quantitative screen and qualitative multi-agent research. Buying splits your target allocation equally.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Execution Model</label>
              <select 
                value={executionModel} 
                onChange={e => setExecutionModel(e.target.value)} 
                disabled={executingAll} 
                className="modern-select"
              >
                {Array.from(new Set([...MODELS[llmProvider].quick, ...MODELS[llmProvider].deep])).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          
            {recommendations.length > 0 && (
              <div className="flex-row" style={{ gap: '0.5rem' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleClear}
                  style={{ gap: '0.25rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                >
                  <Trash2 size={14} /> Clear List
                </button>
                <button 
                  className="btn" 
                  onClick={handleBuyAll}
                  disabled={executingAll}
                  style={{ background: 'var(--success)', color: '#ffffff', gap: '0.25rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', border: 'none' }}
                >
                  {executingAll ? (
                    <RefreshCw size={14} className="pulse" />
                  ) : (
                    <ShoppingCart size={14} />
                  )}
                  Buy All ({recommendations.length})
                </button>
              </div>
            )}
          </div>
        </div>


        {message && (
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: '8px', padding: '1rem', color: 'var(--success)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <CheckCircle size={18} />
            {message}
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '1rem', color: 'var(--danger)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <ShieldAlert size={18} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm">Loading recommendations...</div>
        ) : recommendations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
            <ShoppingCart size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Pending Recommendations</h4>
            <p className="text-sm">Run Step 1 (Screener) and Step 2 (Live Research) to find high-conviction buy options.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem' }}>Ticker</th>
                  <th style={{ padding: '0.75rem' }}>Moat Review</th>
                  <th style={{ padding: '0.75rem' }}>Date Generated</th>
                  <th style={{ padding: '0.75rem' }}>Signal</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((rec) => {
                  const isSingleExecuting = executing[rec.ticker];
                  return (
                    <tr 
                      key={rec.ticker} 
                      style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{rec.ticker}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <a 
                          href={`https://finance.yahoo.com/quote/${rec.ticker}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-row"
                          style={{ color: 'var(--text-secondary)', textDecoration: 'none', gap: '0.25rem', fontSize: '0.85rem' }}
                        >
                          Yahoo Finance <ExternalLink size={12} />
                        </a>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{rec.date}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge completed" style={{ fontSize: '0.75rem' }}>{rec.decision}</span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button
                          className="btn"
                          onClick={() => handleBuySingle(rec.ticker)}
                          disabled={isSingleExecuting || executingAll}
                          style={{ 
                            background: 'var(--bg-surface-hover)', 
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            padding: '0.3rem 0.75rem',
                            fontSize: '0.8rem',
                            gap: '0.25rem'
                          }}
                        >
                          {isSingleExecuting ? (
                            <RefreshCw size={12} className="pulse" />
                          ) : (
                            <ShoppingCart size={12} />
                          )}
                          Buy
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
