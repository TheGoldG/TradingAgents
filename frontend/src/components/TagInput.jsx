import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export default function TagInput({ tags, setTags, disabled, placeholder }) {
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newTag = inputValue.trim().toUpperCase();
      if (!newTag) return;
      if (tags.includes(newTag)) {
        setInputValue('');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const res = await fetch(`http://localhost:8000/api/ticker/verify?ticker=${newTag}`);
        if (res.ok) {
          setTags([...tags, newTag]);
          setInputValue('');
        } else {
          setError(`Invalid ticker: ${newTag}`);
        }
      } catch (err) {
        setError("Network error validating ticker");
      } finally {
        setLoading(false);
      }
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="flex-col" style={{ width: '100%', gap: '0.5rem' }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '0.5rem', 
          padding: '0.5rem', 
          background: 'var(--bg-color)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '6px',
          minHeight: '42px'
        }}
      >
        {tags.map(tag => (
          <span 
            key={tag} 
            className="badge success flex-row" 
            style={{ padding: '0.2rem 0.5rem', gap: '0.25rem', fontSize: '0.8rem' }}
          >
            {tag}
            <button 
              onClick={() => removeTag(tag)} 
              disabled={disabled}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          placeholder={tags.length === 0 ? placeholder : ''}
          style={{ flex: 1, minWidth: '120px', border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none' }}
        />
        {loading && <Loader2 size={16} className="pulse" style={{ color: 'var(--text-secondary)' }} />}
      </div>
      {error && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{error}</span>}
    </div>
  );
}
