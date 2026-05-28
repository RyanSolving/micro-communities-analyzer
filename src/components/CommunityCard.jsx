import React, { useEffect, useState } from 'react';
import { ExternalLink, Flame, Bookmark, BookmarkCheck, Users, EyeOff } from 'lucide-react';

export default function CommunityCard({ community, onAnalyze, onSavedUpdate, initiallySaved = false }) {
  const [isSaved, setIsSaved] = useState(initiallySaved);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setIsSaved(initiallySaved);
  }, [initiallySaved, community.url]);

  // Define size category and meter percentage
  const getMemberStatus = (count) => {
    if (count === null || count === undefined) {
      return { label: 'Size: Unknown', class: 'micro-too-small', percent: 0 };
    }
    if (count < 500) {
      return { label: 'Micro (Too Small: < 500)', class: 'micro-too-small', percent: Math.max(10, (count / 500) * 100) };
    }
    if (count <= 30000) {
      // 500 to 30,000 is our sweet spot
      const percent = ((count - 500) / 29500) * 100;
      return { label: `Micro-Sweet Spot (${count.toLocaleString()})`, class: 'sweet-spot', percent: Math.max(10, percent) };
    }
    if (count <= 100000) {
      const percent = ((count - 30000) / 70000) * 100;
      return { label: `Mid-Size Niche (${count.toLocaleString()})`, class: 'macro', percent: Math.max(10, percent) };
    }
    return { label: `Macro Group (${count.toLocaleString()})`, class: 'macro', percent: 100 };
  };

  const memberStatus = getMemberStatus(community.memberCount);

  // Format platform class for stylesheet
  const platformClass = `platform-${community.platform.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const badgeClass = `badge-platform badge-${community.platform.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  const handleSave = async () => {
    if (isSaved) return;
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(community)
      });
      if (!response.ok) throw new Error('Save request failed');
      setIsSaved(true);
      if (onSavedUpdate) await onSavedUpdate(community);
    } catch (e) {
      console.error('Failed to save community:', e);
      setSaveError('Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`glow-card ${platformClass}`}>
      {/* Top badges bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.35rem' }}>
        <span className={`badge ${badgeClass}`}>{community.platform}</span>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {community.isNsfw && (
            <span className="badge badge-nsfw" title="NSFW content">
              <EyeOff size={10} style={{ marginRight: '2px' }} /> 18+
            </span>
          )}
          {community.nicheSpecificity && (
            <span className={`badge badge-specificity ${community.nicheSpecificity.toLowerCase()}`}
              title={`Niche Specificity: ${community.nicheSpecificity}`}
            >
              {community.nicheSpecificity === 'High' ? '🎯' : community.nicheSpecificity === 'Medium' ? '📌' : '🌐'} {community.nicheSpecificity}
            </span>
          )}
          <span className={`badge badge-monetization ${community.monetizationScore?.toLowerCase() || 'medium'}`}>
            ${community.monetizationScore || 'Medium'} Opportunity
          </span>
          {community.memberCount > 30000 && (
            <span className="badge badge-macro-warning" title="This community is too large for micro-niche targeting">
              ⚠ Macro Group
            </span>
          )}
        </div>
      </div>

      {/* Main text content */}
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-main)', lineHeight: '1.3' }}>
        {community.name}
      </h3>
      
      {community.title && community.title !== community.name && (
        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: '500' }}>
          {community.title}
        </h4>
      )}

      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', flex: 1, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {community.description || 'No description provided. Click to visit and explore.'}
      </p>

      {/* Micro-Community Size Meter */}
      <div className="member-meter">
        <div className="member-meter-label">
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Users size={12} />
            {memberStatus.label}
          </span>
        </div>
        <div className="member-meter-bar-container">
          <div 
            className={`member-meter-bar ${memberStatus.class}`}
            style={{ width: `${memberStatus.percent}%` }}
          ></div>
        </div>
      </div>

      {/* Actions footer */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
        <a 
          href={community.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="btn-secondary"
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <ExternalLink size={14} />
          Join
        </a>

        {onAnalyze && (
          <button 
            className="btn-secondary"
            onClick={() => onAnalyze(community)}
            title={community.platform === 'Reddit'
              ? 'Analyze subreddit hot posts for complaints/needs'
              : 'Analyze public web signals for complaints/needs'
            }
          >
            <Flame size={14} style={{ color: 'var(--accent-gold)' }} />
            Analyze Needs
          </button>
        )}

        <button 
          className={`btn-secondary ${isSaved ? 'active' : ''}`}
          onClick={handleSave}
          disabled={isSaved || saving}
          title={isSaved ? "Saved to database" : "Save this community"}
          style={{ padding: '0.6rem 0.8rem' }}
        >
          {isSaved ? <BookmarkCheck size={14} style={{ color: '#fbbf24' }} /> : <Bookmark size={14} />}
        </button>
      </div>
      {saveError && (
        <p style={{ color: '#f87171', fontSize: '0.78rem', marginTop: '0.5rem' }}>{saveError}</p>
      )}
    </div>
  );
}
