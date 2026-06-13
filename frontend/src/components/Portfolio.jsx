import React, { useEffect, useState } from 'react';
import { Briefcase, TrendingUp, ExternalLink } from 'lucide-react';

export default function Portfolio() {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/portfolio');
      const data = await res.json();
      setHoldings(data.holdings || []);
    } catch (e) {
      console.error("Failed to fetch portfolio", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    // Refresh portfolio every 30 seconds
    const interval = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="data-card" style={{ width: '350px' }}>
      <div className="flex-row mb-4 space-between" style={{ width: '100%', alignItems: 'center' }}>
        <div className="flex-row" style={{ gap: '0.5rem' }}>
          <Briefcase className="text-accent-color" />
          <h2 style={{ margin: 0 }}>Portfolio</h2>
        </div>
        <a 
          href="https://app.alpaca.markets/dashboard" 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', gap: '0.25rem', height: 'fit-content' }}
        >
          Alpaca <ExternalLink size={12} />
        </a>
      </div>

      {loading ? (
        <div className="text-sm">Loading portfolio...</div>
      ) : (
        <div className="flex-col">
          {holdings.length === 0 ? (
            <div className="text-sm" style={{ opacity: 0.5 }}>No active holdings.</div>
          ) : (
            holdings.map((ticker, idx) => (
              <div key={idx} className="flex-row space-between" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <a
                  href={`https://finance.yahoo.com/quote/${ticker}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-row"
                  style={{ 
                    fontWeight: 600, 
                    color: 'var(--text-primary)', 
                    textDecoration: 'none',
                    transition: 'color 0.15s ease',
                    cursor: 'pointer',
                    gap: '0.25rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--success)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                >
                  {ticker}
                  <ExternalLink size={12} style={{ opacity: 0.5 }} />
                </a>
                <div className="badge success flex-row" style={{ gap: '0.25rem' }}>
                  <TrendingUp size={12} /> ACTIVE
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
