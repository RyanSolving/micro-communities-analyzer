import React, { useState, useEffect } from 'react';
import { Trash2, Flame, ExternalLink, Save, BookOpen, DollarSign, Sparkles } from 'lucide-react';

export default function SavedNiches({ onSavedUpdate, onAnalyze }) {
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeNicheId, setActiveNicheId] = useState(null);
  
  // Note edit states (mapped by niche ID)
  const [notesState, setNotesState] = useState({});
  const [ideasState, setIdeasState] = useState({});
  const [saveStatus, setSaveStatus] = useState({}); // { id: 'idle' | 'saving' | 'saved' }

  const fetchNiches = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/saved');
      if (response.ok) {
        const data = await response.json();
        setNiches(data);
        
        // Populate local edit states
        const notesObj = {};
        const ideasObj = {};
        data.forEach(n => {
          notesObj[n.id] = n.notes || '';
          ideasObj[n.id] = Array.isArray(n.ideas) ? n.ideas.join('\n') : n.ideas || '';
        });
        setNotesState(notesObj);
        setIdeasState(ideasObj);

        if (data.length > 0 && !activeNicheId) {
          setActiveNicheId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNiches();
  }, []);

  const handleUpdateNiche = async (id, originalNiche) => {
    setSaveStatus(prev => ({ ...prev, [id]: 'saving' }));
    
    // Parse ideas back to array
    const ideasArray = ideasState[id]
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean);

    const payload = {
      ...originalNiche,
      notes: notesState[id],
      ideas: ideasArray
    };

    try {
      const response = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const updatedNiche = await response.json();
        setNiches(prev => prev.map(n => n.id === id ? { ...n, ...updatedNiche } : n));
        setSaveStatus(prev => ({ ...prev, [id]: 'saved' }));
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [id]: 'idle' }));
        }, 3000);
        // Refresh local count
        if (onSavedUpdate) onSavedUpdate();
      }
    } catch (e) {
      console.error(e);
      setSaveStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this niche from your saved list?')) return;
    try {
      const response = await fetch(`/api/saved/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setNiches(prev => prev.filter(n => n.id !== id));
        if (onSavedUpdate) onSavedUpdate();
        
        // Reset active niche if deleted
        if (activeNicheId === id) {
          const remaining = niches.filter(n => n.id !== id);
          setActiveNicheId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const activeNiche = niches.find(n => n.id === activeNicheId);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', gap: '1rem' }}>
        <div className="loading-pulse" style={{ width: '2.5rem', height: '2.5rem' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Loading saved niches...</p>
      </div>
    );
  }

  if (niches.length === 0) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
        <BookOpen size={48} style={{ color: 'var(--text-dark)', marginBottom: '1rem' }} />
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>No Saved Niches Yet</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto', fontSize: '0.95rem' }}>
          Discover communities in the first tab and click the bookmark button to save them here for monetization planning.
        </p>
      </div>
    );
  }

  return (
    <div className="saved-layout" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '2rem', alignItems: 'start' }}>
      
      {/* Sidebar List of Niches */}
      <aside className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.5rem' }}>
          Saved Communities
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {niches.map(n => (
            <button
              key={n.id}
              onClick={() => setActiveNicheId(n.id)}
              className={`btn-secondary ${activeNicheId === n.id ? 'active' : ''}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                textAlign: 'left',
                width: '100%',
                gap: '0.25rem',
                borderWidth: '1px'
              }}
            >
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                  {n.name}
                </span>
                <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                  {n.platform}
                </span>
              </div>
              {n.memberCount && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                  {n.memberCount.toLocaleString()} members
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Ideation / Notes Editor */}
      <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {activeNiche ? (
          <div>
            {/* Header Details */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className={`badge badge-platform badge-${activeNiche.platform.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                    {activeNiche.platform}
                  </span>
                  <span className={`badge badge-monetization ${activeNiche.monetizationScore?.toLowerCase() || 'medium'}`}>
                    ${activeNiche.monetizationScore || 'Medium'} Opportunity
                  </span>
                </div>
                <h2 style={{ fontSize: '1.75rem', color: '#fff', fontFamily: 'Outfit' }}>
                  {activeNiche.name}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                  {activeNiche.description || 'No description provided.'}
                </p>
                {activeNiche.memberCount && (
                  <span style={{ display: 'inline-block', fontSize: '0.85rem', color: 'var(--text-dark)', marginTop: '0.5rem' }}>
                    Size: <strong>{activeNiche.memberCount.toLocaleString()} members</strong>
                  </span>
                )}
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <a
                  href={activeNiche.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                >
                  <ExternalLink size={14} />
                  Visit
                </a>

                <button
                  className="btn-secondary"
                  onClick={() => onAnalyze(activeNiche)}
                  style={{ border: '1px solid rgba(245, 158, 11, 0.4)' }}
                >
                  <Flame size={14} style={{ color: 'var(--accent-gold)' }} />
                  Scan Pain Points
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => handleDelete(activeNiche.id)}
                  style={{ color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Ideation / Workspace Forms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Research Notes Form */}
              <div className="saved-notes-editor" style={{ border: 'none', padding: 0, margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '1rem', color: '#fff' }}>
                  <BookOpen size={16} style={{ color: 'var(--accent-primary)' }} />
                  Niche Research & Observations
                </label>
                <textarea
                  className="textarea-glow"
                  value={notesState[activeNiche.id] || ''}
                  onChange={(e) => setNotesState({ ...notesState, [activeNiche.id]: e.target.value })}
                  placeholder="Record what members do, what questions they ask most frequently, what triggers them, etc..."
                  rows={4}
                />
              </div>

              {/* Monetization Ideas Form */}
              <div className="saved-notes-editor" style={{ border: 'none', padding: 0, margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', fontSize: '1rem', color: '#fff' }}>
                  <DollarSign size={16} style={{ color: 'var(--accent-gold)' }} />
                  Monetization & Product Ideas (One per line)
                </label>
                <textarea
                  className="textarea-glow"
                  value={ideasState[activeNiche.id] || ''}
                  onChange={(e) => setIdeasState({ ...ideasState, [activeNiche.id]: e.target.value })}
                  placeholder="List software ideas, digital products, service packages, or sponsorships (e.g. custom key mapping app, resin curing guide...)"
                  rows={4}
                />
              </div>

              {/* Save Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  className="btn-glow"
                  onClick={() => handleUpdateNiche(activeNiche.id, activeNiche)}
                  disabled={saveStatus[activeNiche.id] === 'saving'}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={16} />
                  {saveStatus[activeNiche.id] === 'saving' ? 'Saving...' : 
                   saveStatus[activeNiche.id] === 'saved' ? 'Saved Successfully!' :
                   saveStatus[activeNiche.id] === 'error' ? 'Save Failed' : 'Save Observations'}
                </button>
              </div>

              {/* Tips panel */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.04)',
                border: '1px solid rgba(99, 102, 241, 0.1)',
                borderRadius: '12px',
                padding: '1.25rem',
                marginTop: '1rem',
                display: 'flex',
                gap: '0.75rem'
              }}>
                <Sparkles size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <h4 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '0.25rem' }}>Ideation Tip: How to Sell to this Niche</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                    Look for repetitive, frustrating tasks that community members complain about. Build a simple software utility, template pack, or high-end service package. If it's a paid platform (Skool/Circle), they already have buying intent; consider offering them micro-consulting or custom integration.
                  </p>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-dark)' }}>
            <p>Select a saved community from the sidebar to start brainstorming.</p>
          </div>
        )}
      </section>

    </div>
  );
}
