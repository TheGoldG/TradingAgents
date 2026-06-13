import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Search, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

function ReportCard({ title, content }) {
  if (!content) return null;
  return (
    <div className="data-card" style={{ marginTop: '1rem' }}>
      <h3 style={{ color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', fontSize: '1.1rem' }}>
        {title}
      </h3>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

function HistoricalReports() {
  const [reportsMenu, setReportsMenu] = useState({});
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [reportMode, setReportMode] = useState('advanced');

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/reports');
        const data = await res.json();
        setReportsMenu(data.reports || {});
        // Auto-expand all folders initially
        const initialExpanded = {};
        Object.keys(data.reports || {}).forEach(ticker => {
          initialExpanded[ticker] = true;
        });
        setExpandedFolders(initialExpanded);
      } catch (e) {
        console.error("Failed to fetch reports list", e);
      }
    };
    fetchReports();
  }, []);

  const handleSelect = async (ticker, date) => {
    setSelectedTicker(ticker);
    setSelectedDate(date);
    try {
      const res = await fetch(`http://localhost:8000/api/reports/${ticker}/${date}`);
      const data = await res.json();
      setReportData(data);
    } catch (e) {
      console.error("Failed to fetch report data", e);
    }
  };

  const toggleFolder = (ticker) => {
    setExpandedFolders(prev => ({
      ...prev,
      [ticker]: !prev[ticker]
    }));
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
      
      {/* Sidebar */}
      {/* Sidebar List */}
      <div className="data-card" style={{ width: '280px', flexShrink: 0, maxHeight: '80vh', overflowY: 'auto', padding: '1rem' }}>
        <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
          Saved Reports
        </h3>
        
        {Object.keys(reportsMenu).length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
            No reports found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.keys(reportsMenu).sort().map(ticker => {
              const dates = reportsMenu[ticker];
              const isExpanded = expandedFolders[ticker];
              return (
                <div key={ticker}>
                  <div 
                    onClick={() => toggleFolder(ticker)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.5rem', 
                      padding: '0.5rem', cursor: 'pointer', borderRadius: '4px',
                      background: isExpanded ? 'var(--bg-surface-hover)' : 'transparent',
                      color: 'var(--text-primary)', fontWeight: 600
                    }}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {ticker} <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 400 }}>({dates.length})</span>
                  </div>
                  
                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '1.5rem', marginTop: '0.25rem', gap: '0.25rem' }}>
                      {dates.map(date => {
                        // date might be "YYYY-MM-DD" or "SCREENER_REPORT"
                        const isScreener = date === "SCREENER_REPORT";
                        const displayDate = isScreener ? "Screener Analysis" : date;
                        const isSelected = selectedTicker === ticker && selectedDate === date;
                        
                        return (
                          <div 
                            key={date}
                            onClick={() => handleSelect(ticker, date)}
                            style={{ 
                              padding: '0.5rem 0.75rem', 
                              cursor: 'pointer', 
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              color: isSelected ? 'var(--accent-color)' : 'var(--text-secondary)',
                              background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                              fontWeight: isSelected ? 500 : 400
                            }}
                          >
                            {displayDate}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Viewer */}
      <div style={{ flex: 1 }}>
        {!selectedTicker ? (
          <div className="data-card" style={{ textAlign: 'center', padding: '4rem' }}>
            <h2 style={{ color: 'var(--text-secondary)' }}>Select a report to view</h2>
          </div>
        ) : !reportData ? (
          <div className="data-card" style={{ textAlign: 'center', padding: '4rem' }}>
            <h2>Loading...</h2>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="data-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
                  {selectedDate !== 'SCREENER_REPORT' ? (
                    <a 
                      href={`https://finance.yahoo.com/quote/${selectedTicker}`} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ color: 'var(--accent-color)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      title="View on Yahoo Finance"
                    >
                      {selectedTicker} <ExternalLink size={18} />
                    </a>
                  ) : selectedTicker}
                </h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Report Date: {selectedDate === 'SCREENER_REPORT' ? 'Screener Scan' : selectedDate}</p>
              </div>

              {selectedTicker !== 'SCREENER_REPORT' && (
                <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <button 
                    className="btn" 
                    onClick={() => setReportMode('simple')}
                    style={{ background: reportMode === 'simple' ? 'var(--accent-color)' : 'transparent', color: reportMode === 'simple' ? 'var(--accent-text)' : 'var(--text-secondary)', border: 'none', borderRadius: 0, padding: '0.5rem 1rem' }}
                  >
                    Simple
                  </button>
                  <button 
                    className="btn" 
                    onClick={() => setReportMode('advanced')}
                    style={{ background: reportMode === 'advanced' ? 'var(--accent-color)' : 'transparent', color: reportMode === 'advanced' ? 'var(--accent-text)' : 'var(--text-secondary)', border: 'none', borderRadius: 0, padding: '0.5rem 1rem' }}
                  >
                    Advanced
                  </button>
                </div>
              )}
            </div>

            {reportData.reasoning && (
              <ReportCard title="Screener Thought Process" content={reportData.reasoning} />
            )}

            {reportData.selections && (
              <div className="data-card" style={{ marginTop: '1rem' }}>
                <h3 style={{ color: 'var(--accent-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem', fontSize: '1.1rem' }}>
                  Moat Filter Selections
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {Object.entries(reportData.selections).map(([category, tickers]) => (
                    <div 
                      key={category} 
                      style={{ 
                        padding: '1rem', 
                        background: 'var(--bg-surface)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '6px' 
                      }}
                    >
                      <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{category}</h4>
                      <div className="flex-row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                        {tickers.map(t => <span key={t} className="badge pending" style={{ fontWeight: 600 }}>{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reportMode === 'advanced' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  <ReportCard title="Market Analysis" content={reportData.market_report} />
                  <ReportCard title="Social Sentiment" content={reportData.sentiment_report} />
                  <ReportCard title="News Analysis" content={reportData.news_report} />
                  <ReportCard title="Fundamentals Analysis" content={reportData.fundamentals_report} />
                </div>
                
                {reportData.investment_debate_state && (
                   <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                      <div className="data-card" style={{ flex: '1 1 400px', borderLeft: '4px solid var(--success)' }}>
                         <h4 style={{ color: 'var(--success)', marginBottom: '0.75rem' }}>Bull Thesis</h4>
                         <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                           <ReactMarkdown>{reportData.investment_debate_state.bull_history}</ReactMarkdown>
                         </div>
                      </div>
                      <div className="data-card" style={{ flex: '1 1 400px', borderLeft: '4px solid var(--danger)' }}>
                         <h4 style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>Bear Thesis</h4>
                         <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                           <ReactMarkdown>{reportData.investment_debate_state.bear_history}</ReactMarkdown>
                         </div>
                      </div>
                   </div>
                )}
              </>
            )}

            {reportData.investment_debate_state && reportData.investment_debate_state.judge_decision && (
               <ReportCard title="Research Team Decision (Judge)" content={reportData.investment_debate_state.judge_decision} />
            )}

            <ReportCard title="Trading Team Plan" content={reportData.trader_investment_plan || reportData.investment_plan} />
            <ReportCard title="Final Decision" content={reportData.final_trade_decision} />
          </div>
        )}
      </div>

    </div>
  );
}

export default HistoricalReports;
