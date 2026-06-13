import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Cpu, ShieldCheck, ShieldAlert, Activity, TrendingUp, Zap, HelpCircle, ArrowRight, RefreshCw, Check, Plus, ExternalLink } from 'lucide-react';
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
  const [checkedTickers, setCheckedTickers] = useState([]);
  const [initializedReportDate, setInitializedReportDate] = useState(null);
  const [scanEntireMarket, setScanEntireMarket] = useState(true);
  const [pastReportDates, setPastReportDates] = useState([]);
  // Keeps user_added data alive across "Load Past Report" actions
  const [currentUserAdded, setCurrentUserAdded] = useState(null);
  const [isNewReport, setIsNewReport] = useState(true);
  const isNewReportRef = useRef(true);
  isNewReportRef.current = isNewReport;

  // Initialize checkedTickers when screenerReport changes (only once per report)
  useEffect(() => {
    if (screenerReport?.report?.selections && screenerReport.date !== initializedReportDate) {
      const flat = [];
      Object.values(screenerReport.report.selections).forEach(tickers => {
        if (Array.isArray(tickers)) flat.push(...tickers);
      });
      // Also auto-check user_added recommended tickers
      const ua = screenerReport.report.user_added || currentUserAdded;
      if (ua?.selections) {
        const recommended = ua.selections["Recommended by Moat"] || [];
        flat.push(...recommended);
      }
      setCheckedTickers([...new Set(flat)]);
      setInitializedReportDate(screenerReport.date);
    }
  }, [screenerReport, initializedReportDate, currentUserAdded]);

  // When a new screener report loads, capture user_added
  useEffect(() => {
    if (screenerReport?.report?.user_added) {
      setCurrentUserAdded(screenerReport.report.user_added);
    }
  }, [screenerReport]);

  const toggleTicker = (ticker) => {
    setCheckedTickers(prev => 
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
    );
  };

  const mergeIncomingReport = (currentReport, incomingReport) => {
    if (!incomingReport || incomingReport.error) return currentReport;

    const incomingSelections = incomingReport.report?.selections || {};
    const isFullScan = Object.keys(incomingSelections).some(key => 
      key.toLowerCase().includes('slot')
    );

    // Extract user_added from incoming report
    let incomingUserAdded = null;
    if (incomingReport.report?.user_added) {
      incomingUserAdded = incomingReport.report.user_added;
    } else if (!isFullScan) {
      // Custom-only run, selections represent user_added
      incomingUserAdded = {
        reasoning: incomingReport.report?.reasoning || '',
        selections: incomingSelections
      };
    }

    // If we don't have a current report, initialize one
    if (!currentReport) {
      if (isFullScan) {
        return incomingReport;
      } else {
        return {
          date: incomingReport.date,
          report: {
            selections: {},
            reasoning: '',
            user_added: incomingUserAdded
          }
        };
      }
    }

    // If we do have a current report:
    const mergedReport = { ...currentReport.report };

    if (isFullScan) {
      // Update main slots and reasoning
      mergedReport.selections = incomingSelections;
      mergedReport.reasoning = incomingReport.report?.reasoning || '';
    }

    // Merge user_added
    if (incomingUserAdded) {
      const existingUserAdded = mergedReport.user_added || { selections: {}, reasoning: '' };
      const mergedUASelections = { ...existingUserAdded.selections };

      const incomingRec = incomingUserAdded.selections?.["Recommended by Moat"] || [];
      const existingRec = existingUserAdded.selections?.["Recommended by Moat"] || [];
      mergedUASelections["Recommended by Moat"] = [...new Set([...existingRec, ...incomingRec])];

      const incomingNotRec = incomingUserAdded.selections?.["Not Recommended by Moat"] || [];
      const existingNotRec = existingUserAdded.selections?.["Not Recommended by Moat"] || [];
      mergedUASelections["Not Recommended by Moat"] = [...new Set([...existingNotRec, ...incomingNotRec])];

      let mergedUAReasoning = existingUserAdded.reasoning || '';
      if (incomingUserAdded.reasoning) {
        if (mergedUAReasoning) {
          mergedUAReasoning += "\n\n" + incomingUserAdded.reasoning;
        } else {
          mergedUAReasoning = incomingUserAdded.reasoning;
        }
      }

      mergedReport.user_added = {
        selections: mergedUASelections,
        reasoning: mergedUAReasoning
      };
    }

    return {
      date: isFullScan ? incomingReport.date : currentReport.date,
      report: mergedReport
    };
  };

  const fetchLatestReport = async () => {
    if (isNewReportRef.current) return;
    try {
      const res = await fetch('http://localhost:8000/api/screener/latest');
      const data = await res.json();
      if (data && !data.error) {
        setScreenerReport(prev => {
          const merged = mergeIncomingReport(prev, data);
          
          // Also automatically check any newly recommended tickers from the incoming report
          const incomingSelections = data.report?.selections || {};
          const isFullScan = Object.keys(incomingSelections).some(key => 
            key.toLowerCase().includes('slot')
          );
          let newRecommended = [];
          if (!isFullScan) {
            newRecommended = incomingSelections["Recommended by Moat"] || [];
          }
          if (data.report?.user_added?.selections) {
            newRecommended = [...newRecommended, ...(data.report.user_added.selections["Recommended by Moat"] || [])];
          }
          if (newRecommended.length > 0) {
            setCheckedTickers(prevChecked => [...new Set([...prevChecked, ...newRecommended])]);
          }
          
          return merged;
        });
      }
    } catch (e) {
      console.error("Failed to fetch latest screener report", e);
    } finally {
      setLoadingLatest(false);
    }
  };

  const fetchPastReportDates = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/reports');
      const data = await res.json();
      if (data && data.reports && data.reports.SCREENER_REPORT) {
        setPastReportDates(data.reports.SCREENER_REPORT);
      }
    } catch (e) {
      console.error("Failed to fetch past screener report dates", e);
    }
  };

  const handleLoadPastReport = async (date) => {
    if (!date) return;
    setLoadingLatest(true);
    setIsNewReport(false);
    isNewReportRef.current = false;
    
    // Empty everything first (user load -> empty everything -> load)
    setScreenerReport(null);
    setCurrentUserAdded(null);
    setCheckedTickers([]);
    setInitializedReportDate(null);
    
    try {
      const res = await fetch(`http://localhost:8000/api/reports/SCREENER_REPORT/${date}`);
      const reportData = await res.json();
      if (reportData && !reportData.error) {
        // Preserve current user_added across report loads
        setScreenerReport({ date, report: reportData });
      }
    } catch (e) {
      console.error("Failed to load past screener report", e);
    } finally {
      setLoadingLatest(false);
    }
  };

  useEffect(() => {
    fetchPastReportDates();
  }, []);

  // Poll when screener finishes running
  const [wasScreenerRunning, setWasScreenerRunning] = useState(false);
  useEffect(() => {
    if (pipelineState?.is_running && pipelineState?.operation === 'screener') {
      setWasScreenerRunning(true);
    } else if (wasScreenerRunning && !pipelineState?.is_running) {
      setIsNewReport(false);
      isNewReportRef.current = false;
      fetchLatestReport();
      fetchPastReportDates();
      setWasScreenerRunning(false);
    }
  }, [pipelineState, wasScreenerRunning]);

  const handleRunScreener = async () => {
    setIsNewReport(false);
    isNewReportRef.current = false;
    setWasScreenerRunning(true);
    // Only reset user_added if doing a full scan (new custom results will come from the backend)
    if (scanEntireMarket) {
      if (customTickers.length === 0) {
        setCurrentUserAdded(null);
      }
      setInitializedReportDate(null);
    }
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
          custom_tickers: customTickers.length > 0 ? customTickers.join(',') : null,
          scan_entire_market: scanEntireMarket
        })
      });
    } catch (e) {
      console.error("Failed to run screener", e);
      setWasScreenerRunning(false);
    }
  };

  const isScreenerRunning = pipelineState?.is_running && pipelineState?.operation === 'screener';

  // Get flat list of all tickers from the main report selections
  const getSelectionsList = () => {
    if (!screenerReport?.report?.selections) return [];
    const flat = [];
    Object.values(screenerReport.report.selections).forEach(tickers => {
      if (Array.isArray(tickers)) {
        flat.push(...tickers);
      }
    });
    return [...new Set(flat)];
  };

  const getCategoryIcon = (category) => {
    const cat = category.toLowerCase();
    if (cat.includes('recommended by moat') && !cat.includes('not')) return <ShieldCheck size={16} style={{ color: 'var(--success)' }} />;
    if (cat.includes('not recommended')) return <ShieldAlert size={16} style={{ color: 'var(--danger)' }} />;
    if (cat.includes('secular') || cat.includes('tech') || cat.includes('ai')) return <Cpu size={16} className="text-accent-color" />;
    if (cat.includes('defensive') || cat.includes('cash') || cat.includes('health')) return <ShieldCheck size={16} style={{ color: 'var(--success)' }} />;
    if (cat.includes('financial') || cat.includes('infrastructure') || cat.includes('lifeline')) return <Zap size={16} style={{ color: 'var(--warning)' }} />;
    if (cat.includes('cyclical') || cat.includes('industrial') || cat.includes('engine')) return <TrendingUp size={16} style={{ color: 'var(--accent)' }} />;
    return <HelpCircle size={16} style={{ color: 'var(--text-secondary)' }} />;
  };

  // Resolve user_added data: prefer from the current report, fall back to persisted state
  const userAdded = screenerReport?.report?.user_added || currentUserAdded;
  const hasUserAdded = userAdded && userAdded.selections && Object.keys(userAdded.selections).length > 0;

  // Render a ticker pill (reusable for both main selections and user_added)
  const renderTickerPill = (ticker, moatStatus) => {
    const isChecked = checkedTickers.includes(ticker);
    return (
      <div 
        key={ticker} 
        onClick={() => toggleTicker(ticker)}
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.4rem', 
          cursor: 'pointer', 
          background: isChecked ? 'var(--accent-color)' : 'var(--bg-surface)', 
          color: isChecked ? 'var(--accent-text)' : 'var(--text-secondary)',
          padding: '0.4rem 0.8rem', 
          borderRadius: '20px', 
          border: '1px solid',
          borderColor: isChecked ? 'var(--accent-color)' : 'var(--border-color)',
          userSelect: 'none', 
          boxSizing: 'border-box'
        }}
      >
        {isChecked ? <Check size={14} /> : <Plus size={14} />}
        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ticker}</span>
        {moatStatus && (
          <span style={{ 
            fontSize: '0.65rem', 
            padding: '0.1rem 0.4rem', 
            borderRadius: '8px', 
            fontWeight: 600,
            background: moatStatus === 'pass' ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: moatStatus === 'pass' ? 'var(--success)' : 'var(--danger)'
          }}>
            {moatStatus === 'pass' ? 'MOAT ✓' : 'NO MOAT'}
          </span>
        )}
        <a 
          href={`https://finance.yahoo.com/quote/${ticker}`} 
          target="_blank" 
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ color: 'inherit', marginLeft: '0.1rem', display: 'flex', alignItems: 'center', opacity: 0.7 }}
          title="View on Yahoo Finance"
        >
          <ExternalLink size={12} />
        </a>
      </div>
    );
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
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Load Past Report</label>
              <select 
                value={screenerReport ? screenerReport.date : ""} 
                onChange={e => {
                  if (e.target.value === "") {
                    setScreenerReport(null);
                    setCurrentUserAdded(null);
                    setCheckedTickers([]);
                    setInitializedReportDate(null);
                    setIsNewReport(true);
                    isNewReportRef.current = true;
                  } else {
                    handleLoadPastReport(e.target.value);
                  }
                }} 
                disabled={isScreenerRunning} 
                className="modern-select"
                style={{ minWidth: '150px' }}
              >
                <option value="">New Report</option>
                {pastReportDates.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
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
        </div>

        <div className="flex-row" style={{ flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end', marginTop: '1.5rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '0 0 auto' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Scan Entire Market
            </label>
            <div 
              onClick={() => {
                if (!isScreenerRunning) setScanEntireMarket(!scanEntireMarket);
              }}
              style={{ 
                width: '48px', height: '24px', 
                background: scanEntireMarket ? 'var(--accent-color)' : 'var(--bg-surface-hover)', 
                borderRadius: '12px', 
                position: 'relative', 
                cursor: isScreenerRunning ? 'not-allowed' : 'pointer',
                transition: 'background 0.3s',
                display: 'flex',
                alignItems: 'center',
                padding: '0 2px',
                border: '1px solid var(--border-color)'
              }}
            >
              <div style={{ 
                width: '20px', height: '20px', 
                background: '#fff', 
                borderRadius: '50%', 
                transform: scanEntireMarket ? 'translateX(22px)' : 'translateX(0)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                boxShadow: 'var(--shadow-sm)'
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '250px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              {scanEntireMarket ? 'Custom Tickers (Optional - Press Enter)' : 'Custom Tickers (Required - Press Enter)'}
            </label>
            <TagInput 
              tags={customTickers} 
              setTags={setCustomTickers} 
              disabled={isScreenerRunning}
              placeholder="e.g. AAPL, MSFT"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Stocks Per Category</label>
            <select 
              value={stocksPerCat} 
              onChange={e => setStocksPerCat(e.target.value)} 
              disabled={isScreenerRunning || !scanEntireMarket} 
              className="modern-select"
            >
              <option value="1">1 Stock</option>
              <option value="3">3 Stocks</option>
              <option value="5">5 Stocks</option>
              <option value="10">10 Stocks</option>
            </select>
          </div>

          <button 
            onClick={handleRunScreener} 
            disabled={isScreenerRunning || (!scanEntireMarket && customTickers.length === 0)} 
            className="btn btn-primary"
            style={{ padding: '0.6rem 1.5rem', fontWeight: 600, height: '38px', minWidth: '140px' }}
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
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Fetching financial statements, evaluating PEG/ROE/Debt-to-Equity, and executing LLM Buffett Moat analysis. This may take 15-30 seconds.
          </p>
          <button 
            className="btn btn-danger" 
            onClick={async () => {
              try {
                await fetch('http://localhost:8000/api/pipeline/stop', { method: 'POST' });
              } catch (e) {
                console.error("Failed to stop pipeline", e);
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: '0 auto' }}
          >
            Stop Process
          </button>
        </div>
      )}

      {!isScreenerRunning && screenerReport && !screenerReport.error && (
        <div className="flex-col">
          {/* Selections Grid */}
          <div className="glass-panel">
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Moat Filter Selections ({screenerReport.date})
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {/* Main scan categories */}
              {Object.entries(screenerReport.report.selections || {}).map(([category, tickers]) => (
                <div key={category} className="data-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <div style={{ color: 'var(--accent-color)', display: 'inline-flex', marginTop: '0.15rem' }}>
                      {getCategoryIcon(category)}
                    </div>
                    <div style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 600, 
                      color: 'var(--text-primary)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      lineHeight: '1.4'
                    }}>
                      {category}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {tickers.map(ticker => renderTickerPill(ticker, null))}
                  </div>
                </div>
              ))}
              
              {/* User Added Category - from backend user_added field */}
              {hasUserAdded && (
                <div className="data-card" style={{ border: '1px solid var(--accent-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <div style={{ color: 'var(--accent-color)', display: 'inline-flex', marginTop: '0.15rem' }}>
                      <Cpu size={16} className="text-accent-color" />
                    </div>
                    <div style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 600, 
                      color: 'var(--text-primary)', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em',
                      lineHeight: '1.4'
                    }}>
                      User Added
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {(userAdded.selections["Recommended by Moat"] || []).map(ticker =>
                      renderTickerPill(ticker, 'pass')
                    )}
                    {(userAdded.selections["Not Recommended by Moat"] || []).map(ticker =>
                      renderTickerPill(ticker, 'fail')
                    )}
                  </div>
                </div>
              )}
              
            </div>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                onClick={() => onProceedToResearch(checkedTickers)}
                disabled={checkedTickers.length === 0}
                style={{ background: 'var(--success)', color: '#ffffff' }}
              >
                Proceed to Research ({checkedTickers.length} Stocks) <ArrowRight size={16} />
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
            {hasUserAdded && userAdded.reasoning && (
              <>
                <h4 style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1.5rem', marginBottom: '0.75rem' }}>
                  Custom Ticker Moat Analysis
                </h4>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  <ReactMarkdown>{userAdded.reasoning}</ReactMarkdown>
                </div>
              </>
            )}
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
