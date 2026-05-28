import React, { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ 
  value, 
  onChange, 
  onSubmit, 
  placeholder = 'Search...', 
  loading = false,
  prefix = null,
  buttonText = 'Search',
  maxWidth = '800px'
}) {
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(value);
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div 
        className={`input-glow-group ${isFocused ? 'focused' : ''}`} 
        style={{ maxWidth }}
      >
        {prefix ? (
          <span style={{ paddingLeft: '1rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
            {prefix}
          </span>
        ) : (
          <Search 
            style={{ marginLeft: '1rem', color: isFocused ? 'var(--accent-primary)' : 'var(--text-muted)', transition: 'color 0.3s ease' }} 
            size={22} 
          />
        )}
        <input
          ref={inputRef}
          type="text"
          className="input-glow"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={prefix ? { paddingLeft: '0.25rem' } : {}}
        />
        <button 
          type="submit" 
          className="btn-glow" 
          disabled={loading}
          style={{ padding: '0.6rem 1.5rem', borderRadius: '10px' }}
        >
          {loading ? <span className="loading-pulse"></span> : buttonText}
        </button>
      </div>
    </form>
  );
}
