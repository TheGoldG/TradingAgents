import React, { useEffect, useState, useRef } from 'react';
import { Activity, Code, Terminal, Zap, CheckCircle2 } from 'lucide-react';

export default function LiveResearch() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState({ operation: 'Idle', ticker: '', current: 0, total: 0 });
  const [debate, setDebate] = useState(null);
  const [riskDebate, setRiskDebate] = useState(null);
  const [decision, setDecision] = useState(null);
  const feedRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to bottom of feed
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const sse = new EventSource('http://localhost:8000/api/stream');

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const event = data.event;
        const payload = JSON.parse(data.data);

        if (event === 'pipeline_status') {
          setStatus(payload);
          setDebate(null);
          setRiskDebate(null);
          setDecision(null);
          setMessages([{ type: 'System', content: `Starting pipeline: ${payload.operation} for ${payload.ticker}` }]);
        } else if (event === 'agent_message') {
          setMessages(prev => [...prev, { type: payload.type, content: payload.content }]);
        } else if (event === 'tool_call') {
          setMessages(prev => [...prev, { type: 'Tool', content: `Executed ${payload.name}`, details: payload.args }]);
        } else if (event === 'report_update') {
          if (payload.debate) setDebate(payload.debate);
          if (payload.risk_debate) setRiskDebate(payload.risk_debate);
        } else if (event === 'research_complete') {
          setDecision(payload.decision);
          setMessages(prev => [...prev, { type: 'System', content: `Analysis complete. Decision: ${payload.decision}` }]);
        }
      } catch (err) {
        // Ping event or parsing error
      }
    };

    return () => {
      sse.close();
    };
  }, []);

  return (
    <div className="flex-col" style={{ flex: 1 }}>
      <div className="glass-panel">
        <div className="flex-row space-between mb-4">
          <div className="flex-row">
            <Activity className="text-accent-color" />
            <h2>Live Research Feed</h2>
          </div>
          {status.operation !== 'Idle' && (
            <div className="badge in_progress">
              {status.operation} - {status.ticker} ({status.current}/{status.total})
            </div>
          )}
        </div>
        
        <div className="message-feed" ref={feedRef}>
          {messages.length === 0 ? (
            <div className="text-sm" style={{ textAlign: 'center', opacity: 0.5, marginTop: '2rem' }}>
              Waiting for pipeline to start...
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message-item ${msg.type.toLowerCase()}`}>
                <div className="flex-row" style={{ marginBottom: '0.25rem' }}>
                  {msg.type === 'System' && <Terminal size={14} color="var(--accent-color)" />}
                  {msg.type === 'Tool' && <Code size={14} color="var(--warning)" />}
                  {(msg.type !== 'System' && msg.type !== 'Tool') && <Zap size={14} color="var(--success)" />}
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{msg.type}</span>
                </div>
                <div className="text-sm">{msg.content}</div>
                {msg.details && (
                  <pre style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto' }}>
                    {JSON.stringify(msg.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {(debate || riskDebate) && (
        <div className="glass-panel mt-4">
          <h2>Active Debates</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {debate && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                <h3>Investment Thesis Debate</h3>
                <div className="text-sm mt-4">
                  <strong>Bull:</strong> {debate.bull || 'Waiting for thesis...'}
                </div>
                <div className="text-sm mt-4">
                  <strong>Bear:</strong> {debate.bear || 'Waiting for thesis...'}
                </div>
                {debate.judge && (
                  <div className="text-sm mt-4" style={{ color: 'var(--accent-color)' }}>
                    <strong>Verdict:</strong> {debate.judge}
                  </div>
                )}
              </div>
            )}
            
            {riskDebate && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                <h3>Risk Management Debate</h3>
                <div className="text-sm mt-4">
                  <strong>Aggressive:</strong> {riskDebate.aggressive || 'Waiting...'}
                </div>
                <div className="text-sm mt-4">
                  <strong>Conservative:</strong> {riskDebate.conservative || 'Waiting...'}
                </div>
                {riskDebate.judge && (
                  <div className="text-sm mt-4" style={{ color: 'var(--success)' }}>
                    <strong>Verdict:</strong> {riskDebate.judge}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {decision !== null && (
        <div className="glass-panel mt-4 flex-row" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <CheckCircle2 color="var(--success)" size={24} />
          <h2 style={{ marginBottom: 0, color: 'var(--success)' }}>Final Decision: {decision ? 'APPROVED' : 'REJECTED'}</h2>
        </div>
      )}
    </div>
  );
}
