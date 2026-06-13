import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Cpu, ShieldCheck, Activity, TrendingUp, Zap, HelpCircle, ArrowRight, RefreshCw } from 'lucide-react';
import TagInput from './TagInput';

export default function Screener({ 
  llmProvider, 
  screenerModel,
  setScreenerModel,
  MODELS,
  quickModel, 
  deepModel, 
  stocksPerCategory, 
  onProceedToResearch,
  pipelineState 
}) {
  const [screenerReport, setScreenerReport] = useState(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [customTickers, setCustomTickers] = useState([]);
  const [stocksPerCat, setStocksPerCat] = useState(stocksPerCategory);

  const fetchLatestReport = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/screener/latest');
      const data = await res.json();
      if (data && !data.error) {
        setScreenerReport(data);
      }
    } catch (e) {
      console.error("Failed to fetch latest screener report", e);
    } finally {
      setLoadingLatest(false);
    }
  };

  useEffect(() => {
    fetchLatestReport();
  }, []);

  // Poll when screener finishes running
  useEffect(() => {
    if (pipelineState && !pipelineState.is_running && pipelineState.operation === null) {
      fetchLatestReport();
    }
  }, [pipelineState]);

  const handleRunScreener = async () => {
    setScreenerReport(null);
    try {
      await fetch('http://localhost:8000/api/screener/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_provider: llmProvider,
          screener_model: screenerModel,
          quick_model: quickModel,
          deep_model: deepModel,
          stocks_per_category: parseInt(stocksPerCat),
          custom_tickers: customTickers.length > 0 ? customTickers.join(',') : null
        })
      });
    } catch (e) {
      console.error("Failed to run screener", e);
    }
  };

  const isScreenerRunning = pipelineState?.is_running && pipelineState?.operation === 'screener';

  // Get flat list of all tickers from the latest report
  const getSelectionsList = () => {
    if (!screenerReport?.report?.selections) return [];
    const flat = [];
    Object.values(screenerReport.report.selections).forEach(tickers => {
      if (Array.isArray(tickers)) {
        flat.push(...tickers);
      }
    });
    return [...new Set(flat)]; // Deduplicate
  };

  const selectedTickers = getSelectionsList();

  const getCategoryIcon = (category) => {
    const cat = category.toLowerCase();
    if (cat.includes('secular') || cat.includes('tech') || cat.includes('ai')) return <Cpu size={16} className="text-accent-color" />;
    if (cat.includes('defensive') || cat.includes('cash') || cat.includes('health')) return <ShieldCheck size={16} style={{ color: 'var(--success)' }} />;
    if (cat.includes('financial') || cat.includes('infrastructure') || cat.includes('lifeline')) return <Zap size={16} style={{ color: 'var(--warning)' }} />;
    if (cat.includes('cyclical') || cat.includes('industrial') || cat.includes('engine')) return <TrendingUp size={16} style={{ color: 'var(--accent)' }} />;
    return <HelpCircle size={16} style={{ color: 'var(--text-secondary)' }} />;
  };

  return (
    <div className="flex-col" style={{ width: '100%' }}>
      {/* Configuration Panel */}
      <div className="data-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.25rem' }}>Step 1: Market & Moat Screener</h2>
            <p className="text-sm" style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Filters the S&P 500 and Nasdaq 100 quantitatively, then runs an LLM-based qualitative moat filter.
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Screener Model</label>
            <select 
              value={screenerModel} 
              onChange={e => setScreenerModel(e.target.value)} 
              disabled={isScreenerRunning} 
              className="modern-select"
            >
              {Array.from(new Set([...MODELS[llmProvider].quick, ...MODELS[llmProvider].deep])).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-row" style={{ flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '250px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Custom Tickers (Optional - Press Enter)
            </label>
            <TagInput 
              tags={customTickers} 
              setTags={setCustomTickers} 
              disabled={isScreenerRunning}
              placeholder="e.g. AAPL, MSFT"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', opacity: customTickers.length > 0 ? 0.4 : 1, transition: 'opacity 0.2s' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Stocks Per Category
            </label>
            <input 
              type="number" 
              min="1" max="10"
              value={stocksPerCat} 
              onChange={(e) => setStocksPerCat(e.target.value)}
              disabled={isScreenerRunning || customTickers.length > 0}
              style={{ width: '100px' }}
            />
          </div>

          <button 
            className="btn" 
            onClick={handleRunScreener} 
            disabled={isScreenerRunning}
            style={{ height: 'fit-content', background: 'var(--accent-color)', color: 'var(--accent-text)', border: 'none' }}
          >
            {isScreenerRunning ? (
              <>
                <RefreshCw size={16} className="pulse" /> Screening Market...
              </>
            ) : (
              'Run Screener'
            )}
          </button>
        </div>
      </div>

      {/* Screener Output */}
      {isScreenerRunning && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Activity size={48} className="pulse text-accent-color" style={{ marginBottom: '1rem' }} />
          <h3>Quantitative & Moat Scanning in Progress</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', marginTop: '0.5rem' }}>
            Fetching financial statements, evaluating PEG/ROE/Debt-to-Equity, and executing LLM Buffett Moat analysis. This may take 15-30 seconds.
          </p>
        </div>
      )}

      {!isScreenerRunning && screenerReport && !screenerReport.error && (
        <div className="flex-col">
          {/* Selections Grid */}
          <div className="glass-panel">
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Moat Filter Selections ({screenerReport.date})
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.5rem' }}>
              {Object.entries(screenerReport.report.selections || {}).map(([category, tickers]) => (
                <div key={category} className="data-card">
                  <div className="flex-row" style={{ gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <div style={{ color: 'var(--accent-color)' }}>
                      {getCategoryIcon(category)}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {category}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {tickers.map(ticker => (
                      <span key={ticker} className="badge pending" style={{ background: 'var(--bg-surface)' }}>
                        {ticker}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                onClick={() => onProceedToResearch(selectedTickers)}
                style={{ background: 'var(--success)', color: '#ffffff' }}
              >
                Proceed to Research ({selectedTickers.length} Stocks) <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Reasoning Report */}
          <div className="glass-panel">
            <h3 style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              Qualitative Moat Analysis & Reasoning
            </h3>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <ReactMarkdown>{screenerReport.report.reasoning}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {!isScreenerRunning && !screenerReport && !loadingLatest && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
          <p>No screening report found. Click "Run Screener" to scan the market.</p>
        </div>
      )}
    </div>
  );
}
