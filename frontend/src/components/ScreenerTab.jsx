import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Search, Loader2 } from 'lucide-react';

function ScreenerTab({ llmProvider, quickModel, deepModel, stocksPerCategory }) {
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [customTickers, setCustomTickers] = useState("");

  useEffect(() => {
    // Attempt to load the latest screener report from today
    const fetchTodayReport = async () => {
      const today = new Date().toISOString().split('T')[0];
      try {
        const res = await fetch(`http://localhost:8000/api/reports/SCREENER_REPORT/${today}`);
        const data = await res.json();
        if (data && !data.error) {
          setReport(data);
        }
      } catch (e) {
        console.error("Failed to load today's screener report", e);
      }
    };
    fetchTodayReport();
  }, []);

  const runScreener = async () => {
    setIsRunning(true);
    setReport(null);
    try {
      const res = await fetch('http://localhost:8000/api/screener/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_provider: llmProvider,
          quick_model: quickModel,
          deep_model: deepModel,
          stocks_per_category: stocksPerCategory,
          custom_tickers: customTickers
        })
      });
      const data = await res.json();
      setReport(data.report);
    } catch (e) {
      console.error("Failed to run screener", e);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Search size={24} color="var(--accent)" />
            AI Screener Report
          </h2>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>
            Manually trigger the quantitative and qualitative moat scan before committing to a full portfolio run.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Custom Tickers
            </label>
            <input 
              type="text" 
              placeholder="e.g. AAPL, TSLA"
              value={customTickers} 
              onChange={(e) => setCustomTickers(e.target.value)}
              disabled={isRunning}
              style={{ width: '150px', padding: '0.5rem', fontWeight: 500 }}
              title="Override the S&P 500 scan and only check these specific tickers"
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Stocks Per Category
            </label>
            <input 
              type="number" 
              min="1" max="10" 
              value={stocksPerCategory} 
              onChange={(e) => setStocksPerCategory(e.target.value)}
              disabled={isRunning}
              style={{ width: '80px', padding: '0.5rem', fontWeight: 500 }}
              title={`Stocks per category (Total Portfolio: ${stocksPerCategory * 5})`}
            />
          </div>
          <button 
            className="btn" 
            onClick={runScreener} 
            disabled={isRunning}
            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
          >
          {isRunning ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Loader2 className="spinner" size={18} /> Scanning Market...
            </span>
          ) : (
            'Run Screener Now'
          )}
        </button>
      </div>
      </div>

      {report && (
        <div className="glass-panel" style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '70vh' }}>
          <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--accent)' }}>
            Screener Thought Process
          </h3>
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <ReactMarkdown>{report.reasoning}</ReactMarkdown>
          </div>
          
          <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', color: 'var(--accent)', marginTop: '2rem' }}>
            Final Selections
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            {Object.entries(report.selections || {}).map(([slot, tickers]) => (
              <div key={slot} style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: '8px', flex: '1 1 250px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>{slot}</h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {tickers.map(t => (
                    <span key={t} style={{ background: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ScreenerTab;
