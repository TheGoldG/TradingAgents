import React, { useEffect, useState } from 'react';
import { Briefcase, TrendingUp } from 'lucide-react';

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
    <div className="glass-panel" style={{ width: '350px' }}>
      <div className="flex-row mb-4">
        <Briefcase className="text-accent-color" />
        <h2>Current Portfolio</h2>
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
                <span style={{ fontWeight: 600 }}>{ticker}</span>
                <div className="badge completed flex-row" style={{ gap: '0.25rem' }}>
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
