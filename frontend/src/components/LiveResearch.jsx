import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Activity, CheckCircle, Clock, ShieldAlert, ArrowRight } from 'lucide-react';
import TagInput from './TagInput';

function StatusIcon({ status }) {
  if (status === 'completed') return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
  if (status === 'in_progress') return <Activity size={16} className="pulse" style={{ color: 'var(--accent)' }} />;
  return <Clock size={16} style={{ color: 'var(--text-secondary)' }} />;
}

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

function LiveResearch({ 
  llmProvider,
  quickModel,
  setQuickModel,
  deepModel,
  setDeepModel,
  MODELS,
  pipelineState, 
  onRunResearch, 
  onProceedToExecutor, 
  screenerTickers 
}) {
  const [currentTicker, setCurrentTicker] = useState(pipelineState.ticker || null);
  const [analysts, setAnalysts] = useState(pipelineState.analysts || []);
  const [agentStatus, setAgentStatus] = useState(pipelineState.agent_status || {});
  const [reports, setReports] = useState(pipelineState.reports || {});
  const [progress, setProgress] = useState(pipelineState.progress || '');

  useEffect(() => {
    // Sync with pipelineState if it comes from the parent fetchStatus polling
    if (pipelineState.is_running && pipelineState.ticker) {
      setCurrentTicker(pipelineState.ticker);
      setAnalysts(pipelineState.analysts || []);
      setAgentStatus(pipelineState.agent_status || {});
      setReports(pipelineState.reports || {});
      setProgress(pipelineState.progress || '');
    }

    if (!pipelineState.is_running && pipelineState.reports && Object.keys(pipelineState.reports).length > 0) {
       setReports(pipelineState.reports);
       setCurrentTicker(pipelineState.ticker);
       setAnalysts(pipelineState.analysts || []);
       setAgentStatus(pipelineState.agent_status || {});
    }
  }, [pipelineState]);

  useEffect(() => {
    const sse = new EventSource('http://localhost:8000/api/stream');

    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        const event = payload.event;
        const data = JSON.parse(payload.data);
        
        if (event === "pipeline_status") {
          setCurrentTicker(data.ticker);
          setProgress(`(${data.current}/${data.total})`);
          // clear previous
          setAgentStatus({});
          setReports({});
        } else if (event === "research_start") {
          setAnalysts(data.analysts);
          const initialStatus = {};
          data.analysts.forEach(a => initialStatus[a] = 'pending');
          setAgentStatus(initialStatus);
        } else if (event === "agent_message") {
          // Attempt to update status based on message type
          const atype = data.type.toLowerCase();
          setAgentStatus(prev => {
            const next = { ...prev };
            // Simple heuristic to show progress
            if (next[atype] !== 'completed') {
              next[atype] = 'in_progress';
            }
            return next;
          });
        } else if (event === "report_update") {
          setReports(prev => ({ ...prev, ...data }));
          // If a report comes in, mark that analyst completed
          setAgentStatus(prev => {
            const next = { ...prev };
            if (data.market_report) next['market'] = 'completed';
            if (data.sentiment_report) next['social'] = 'completed';
            if (data.news_report) next['news'] = 'completed';
            if (data.fundamentals_report) next['fundamentals'] = 'completed';
            return next;
          });
        } else if (event === "research_complete") {
           // All done
           setAgentStatus(prev => {
             const next = {};
             Object.keys(prev).forEach(k => next[k] = 'completed');
             return next;
           });
        }
      } catch (err) {
        // ping or parse error
      }
    };

    return () => sse.close();
  }, []);

  const [customInput, setCustomInput] = useState([]);

  const isIdle = !pipelineState.is_running && !currentTicker && Object.keys(reports).length === 0;
  const hasScreenerTickers = screenerTickers && screenerTickers.length > 0;
  const isResearchFinished = !pipelineState.is_running && Object.keys(reports).length > 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Configuration Header */}
      <div className="data-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.25rem' }}>Step 2: Live Research Team</h2>
            <p className="text-sm" style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Deploys a team of 4 specialized AI agents to conduct deep-dive fundamental and news assessment.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Research Quick</label>
              <select value={quickModel} onChange={e => setQuickModel(e.target.value)} disabled={pipelineState.is_running} className="modern-select">
                {MODELS[llmProvider].quick.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Research Deep</label>
              <select value={deepModel} onChange={e => setDeepModel(e.target.value)} disabled={pipelineState.is_running} className="modern-select">
                {MODELS[llmProvider].deep.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {isIdle ? (
        <div className="data-card" style={{ padding: '3rem 2rem' }}>
          {hasScreenerTickers ? (
            <div className="flex-col" style={{ gap: '1.5rem' }}>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Tickers Passed from Screener
                </div>
                <div className="flex-row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
                  {screenerTickers.map(t => <span key={t} className="badge pending" style={{ fontWeight: 600 }}>{t}</span>)}
                </div>
              </div>
              
              <button 
                className="btn" 
                onClick={() => onRunResearch(screenerTickers)}
                style={{ background: 'var(--success)', color: '#ffffff', alignSelf: 'flex-start', border: 'none' }}
              >
                Start Research on {screenerTickers.length} Stocks
              </button>
            </div>
          ) : (
            <div className="flex-col" style={{ gap: '1.5rem' }}>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '1rem' }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Screened Stocks Loaded</h4>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Run Step 1 (Screener) first, or enter custom tickers below to run research directly.</p>
              </div>
              
              <div className="flex-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    Enter Tickers (Press Enter)
                  </label>
                  <TagInput 
                    tags={customInput} 
                    setTags={setCustomInput} 
                    placeholder="e.g. AAPL, MSFT, TSLA" 
                  />
                </div>
                <button 
                  className="btn" 
                  onClick={() => {
                    if (customInput.length > 0) onRunResearch(customInput);
                  }}
                  disabled={customInput.length === 0}
                  style={{ background: 'var(--accent-color)', color: 'var(--accent-text)', border: 'none' }}
                >
                  Start Research
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>

      {/* Status Header */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>
            {currentTicker || 'Loading...'} {progress}
          </h2>
          {pipelineState.is_running && (
            <span style={{ color: 'var(--accent)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={14} className="pulse" /> {pipelineState.operation} running
            </span>
          )}
        </div>
      </div>

      {pipelineState.error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '1rem', color: 'var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            <ShieldAlert size={18} />
            Pipeline Error
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{pipelineState.error}</div>
        </div>
      )}

      {/* Agents Status Grid */}
      <div className="data-card">
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Active Agents</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          {analysts.map(agent => (
            <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <StatusIcon status={agentStatus[agent]} />
              <span style={{ textTransform: 'capitalize', fontWeight: 500, fontSize: '0.9rem' }}>{agent} Analyst</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reports Stack */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        <ReportCard title="Market Analysis" content={reports.market_report} />
        <ReportCard title="Social Sentiment" content={reports.sentiment_report} />
        <ReportCard title="News Analysis" content={reports.news_report} />
        <ReportCard title="Fundamentals Analysis" content={reports.fundamentals_report} />
      </div>
      
      {reports.debate && (
         <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <div className="data-card" style={{ flex: '1 1 400px', borderLeft: '4px solid var(--success)' }}>
               <h4 style={{ color: 'var(--success)', marginBottom: '0.75rem' }}>Bull Thesis</h4>
               <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                 <ReactMarkdown>{reports.debate.bull}</ReactMarkdown>
               </div>
            </div>
            <div className="data-card" style={{ flex: '1 1 400px', borderLeft: '4px solid var(--danger)' }}>
               <h4 style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>Bear Thesis</h4>
               <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                 <ReactMarkdown>{reports.debate.bear}</ReactMarkdown>
               </div>
            </div>
         </div>
      )}

      {reports.debate && reports.debate.judge && (
         <ReportCard title="Research Team Decision (Judge)" content={reports.debate.judge} />
      )}

      <ReportCard title="Trading Team Plan" content={reports.trader_investment_plan || reports.investment_plan} />
      <ReportCard title="Final Decision" content={reports.final_trade_decision} />

      {isResearchFinished && (
        <div className="data-card" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', background: 'var(--bg-surface)' }}>
          <button 
            className="btn" 
            onClick={onProceedToExecutor}
            style={{ background: 'var(--success)', color: '#ffffff', gap: '0.5rem' }}
          >
            Proceed to Execution Step <ArrowRight size={16} />
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}

export default LiveResearch;
