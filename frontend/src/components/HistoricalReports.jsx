import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

function ReportCard({ title, content }) {
  if (!content) return null;
  return (
    <div className="glass-panel" style={{ marginTop: '1rem' }}>
      <h3 style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
        {title}
      </h3>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
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
      <div className="glass-panel" style={{ width: '250px', flexShrink: 0 }}>
        <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Search size={18} /> Researched Stocks
        </h3>
        
        {Object.keys(reportsMenu).length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No history found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(reportsMenu).map(([ticker, dates]) => {
              const isExpanded = expandedFolders[ticker];
              return (
                <div key={ticker}>
                  <div 
                    onClick={() => toggleFolder(ticker)}
                    style={{ 
                      fontWeight: 'bold', 
                      color: 'var(--text-primary)', 
                      marginBottom: '0.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      borderRadius: '4px',
                      userSelect: 'none'
                    }}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    {ticker}
                  </div>
                  {isExpanded && dates.map(date => (
                    <button 
                      key={date}
                      onClick={() => handleSelect(ticker, date)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.5rem',
                        paddingLeft: '2rem',
                        background: selectedTicker === ticker && selectedDate === date ? 'rgba(255,255,255,0.1)' : 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        borderRadius: '4px'
                      }}
                    >
                      {date}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Viewer */}
      <div style={{ flex: 1 }}>
        {!selectedTicker ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
            <h2 style={{ color: 'var(--text-secondary)' }}>Select a report to view</h2>
          </div>
        ) : !reportData ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
            <h2>Loading...</h2>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-panel">
              <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{selectedTicker}</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Report Date: {selectedDate}</p>
            </div>

            <ReportCard title="Market Analysis" content={reportData.market_report} />
            <ReportCard title="Social Sentiment" content={reportData.sentiment_report} />
            <ReportCard title="News Analysis" content={reportData.news_report} />
            <ReportCard title="Fundamentals Analysis" content={reportData.fundamentals_report} />
            
            {reportData.investment_debate_state && (
               <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--success)' }}>
                     <h4 style={{ color: 'var(--success)' }}>Bull Thesis</h4>
                     <ReactMarkdown>{reportData.investment_debate_state.bull_history}</ReactMarkdown>
                  </div>
                  <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--danger)' }}>
                     <h4 style={{ color: 'var(--danger)' }}>Bear Thesis</h4>
                     <ReactMarkdown>{reportData.investment_debate_state.bear_history}</ReactMarkdown>
                  </div>
               </div>
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
