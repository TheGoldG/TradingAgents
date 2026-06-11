import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Activity, CheckCircle, Clock } from 'lucide-react';

function StatusIcon({ status }) {
  if (status === 'completed') return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
  if (status === 'in_progress') return <Activity size={16} className="pulse" style={{ color: 'var(--accent)' }} />;
  return <Clock size={16} style={{ color: 'var(--text-secondary)' }} />;
}

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

function LiveResearch({ pipelineState }) {
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
  }, [pipelineState]);

  useEffect(() => {
    const sse = new EventSource('http://localhost:8000/api/stream');

    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        const { event, data } = payload;
        
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

  if (!pipelineState.is_running && !currentTicker) {
    return (
      <div className="glass-panel" style={{ flex: 1, textAlign: 'center', padding: '4rem 2rem' }}>
        <h2 style={{ color: 'var(--text-secondary)' }}>System is Idle</h2>
        <p>Select an operation above to begin autonomous research.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

      {/* Agents Status Grid */}
      <div className="glass-panel">
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Active Agents</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          {analysts.map(agent => (
            <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <StatusIcon status={agentStatus[agent]} />
              <span style={{ textTransform: 'capitalize' }}>{agent} Analyst</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reports Stack */}
      <ReportCard title="Market Analysis" content={reports.market_report} />
      <ReportCard title="Social Sentiment" content={reports.sentiment_report} />
      <ReportCard title="News Analysis" content={reports.news_report} />
      <ReportCard title="Fundamentals Analysis" content={reports.fundamentals_report} />
      
      {reports.debate && (
         <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--success)' }}>
               <h4 style={{ color: 'var(--success)' }}>Bull Thesis</h4>
               <ReactMarkdown>{reports.debate.bull}</ReactMarkdown>
            </div>
            <div className="glass-panel" style={{ flex: 1, borderLeft: '4px solid var(--danger)' }}>
               <h4 style={{ color: 'var(--danger)' }}>Bear Thesis</h4>
               <ReactMarkdown>{reports.debate.bear}</ReactMarkdown>
            </div>
         </div>
      )}

      {reports.debate && reports.debate.judge && (
         <ReportCard title="Research Team Decision (Judge)" content={reports.debate.judge} />
      )}

      <ReportCard title="Trading Team Plan" content={reports.trader_investment_plan || reports.investment_plan} />
      <ReportCard title="Final Decision" content={reports.final_trade_decision} />

    </div>
  );
}

export default LiveResearch;
