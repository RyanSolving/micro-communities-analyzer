import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Search, MessageSquare, ThumbsUp, Flame, ExternalLink, Bookmark } from 'lucide-react';
import SearchBar from './SearchBar.jsx';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitIntoSentences(text) {
  return (text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function getHighlightTerms(categories = []) {
  return categories
    .map(category => category?.matchedWord)
    .filter(Boolean)
    .map(term => term.trim())
    .filter(term => term.length >= 2);
}

function renderHighlightedSentence(sentence, terms) {
  if (!terms.length) return sentence;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'ig');
  const parts = sentence.split(pattern);

  return parts.map((part, index) => {
    const isMatch = terms.some(term => part.toLowerCase() === term.toLowerCase());
    if (!isMatch) return part;

    return (
      <mark
        key={index}
        style={{
          background: 'rgba(245, 158, 11, 0.24)',
          color: '#111827',
          borderRadius: '4px',
          padding: '0 0.15rem',
          fontWeight: '700'
        }}
      >
        {part}
      </mark>
    );
  });
}

function HighlightedContent({ text, categories }) {
  const terms = getHighlightTerms(categories);
  const sentences = splitIntoSentences(text);

  if (!sentences.length) return null;

  return (
    <>
      {sentences.map((sentence, index) => {
        const isHighlighted = terms.some(term => sentence.toLowerCase().includes(term.toLowerCase()));
        return (
          <span
            key={index}
            style={{
              display: 'block',
              marginBottom: index === sentences.length - 1 ? 0 : '0.45rem',
              background: isHighlighted ? 'rgba(245, 158, 11, 0.10)' : 'transparent',
              borderRadius: isHighlighted ? '5px' : 0,
              padding: isHighlighted ? '0.08rem 0.18rem' : 0,
              color: isHighlighted ? '#111827' : 'inherit'
            }}
          >
            {renderHighlightedSentence(sentence, terms)}
          </span>
        );
      })}
    </>
  );
}

export default function PainPointAnalyzer({ initialSubreddit, initialCommunity, onClearSubreddit, onBackToSearch, onSavedUpdate }) {
  const [subreddit, setSubreddit] = useState(initialSubreddit || '');
  const [analysisTarget, setAnalysisTarget] = useState(initialCommunity || null);
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [expandedContentIds, setExpandedContentIds] = useState(new Set());

  useEffect(() => {
    if (initialCommunity) {
      setAnalysisTarget(initialCommunity);
      if (initialCommunity.platform === 'Reddit') {
        setSubreddit(initialCommunity.name || '');
      }
      handleAnalyzeCommunity(initialCommunity);
    } else if (initialSubreddit) {
      setAnalysisTarget(null);
      setSubreddit(initialSubreddit);
      handleAnalyze(initialSubreddit);
    }
  }, [initialSubreddit, initialCommunity]);

  const handleAnalyzeCommunity = async (community) => {
    if (!community) return;

    setLoading(true);
    setError('');
    setOpportunities([]);
    setSuccessMsg('');
    setExpandedContentIds(new Set());

    try {
      const response = await fetch('/api/analyze-community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(community)
      });
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setOpportunities(data.opportunities || []);
    } catch (e) {
      const label = community.platform === 'Reddit'
        ? `r/${(community.name || '').replace(/^r\//i, '')}`
        : `${community.name || community.platform}`;
      setError(`Failed to retrieve need signals for ${label}. Public sources may be sparse or temporarily blocked.`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async (subName) => {
    const target = subName || subreddit;
    if (!target.trim()) return;

    // Clean name: remove r/ prefix if entered
    const cleanSub = target.replace(/^r\//i, '').trim();
    setAnalysisTarget({
      name: `r/${cleanSub}`,
      platform: 'Reddit',
      url: `https://www.reddit.com/r/${cleanSub}/`
    });
    
    setLoading(true);
    setError('');
    setOpportunities([]);
    setSuccessMsg('');
    setExpandedContentIds(new Set());

    try {
      const response = await fetch(`/api/analyze?subreddit=${encodeURIComponent(cleanSub)}`);
      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setOpportunities(data.opportunities || []);
    } catch (e) {
      setError(`Failed to retrieve threads for r/${cleanSub}. Make sure the subreddit name is correct and public.`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIdea = async (opp) => {
    const cleanSubreddit = subreddit.replace(/^r\//i, '').trim();
    const targetLabel = analysisTarget?.name || (cleanSubreddit ? `r/${cleanSubreddit}` : 'selected community');
    const platform = opp.platform || analysisTarget?.platform || 'Reddit';
    // Save this thread opportunity as a starting point for an idea
    const payload = {
      name: `Opportunity in ${targetLabel}`,
      platform,
      url: opp.url,
      description: opp.title,
      memberCount: null,
      monetizationScore: 'High',
      notes: platform === 'Reddit'
        ? `Extracted from thread: "${opp.title}"\nAuthor: ${opp.author}\nEngagement: ${opp.score} upvotes, ${opp.commentsCount} comments.`
        : `Extracted from public ${platform} signal: "${opp.title}"\nSource: ${opp.url}\nContent: ${opp.fullContent || opp.snippet}`,
      ideas: [`Solve the user issue: "${opp.categories[0]?.matchedWord ? `Fixing issue related to ${opp.categories[0].matchedWord}` : 'Create a custom product/solution'}"`]
    };

    try {
      const response = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        if (onSavedUpdate) await onSavedUpdate();
        setSuccessMsg(`Successfully bookmarked thread to your "Saved Niches"!`);
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        throw new Error('Save request failed');
      }
    } catch (e) {
      console.error('Failed to save idea:', e);
      setSuccessMsg('');
      setError('Could not bookmark this opportunity. Please try again.');
    }
  };

  const toggleFullContent = (id) => {
    setExpandedContentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBackToSearch = () => {
    if (onBackToSearch) {
      onBackToSearch();
    } else if (onClearSubreddit) {
      onClearSubreddit();
    }
  };

  const isPublicTarget = analysisTarget && analysisTarget.platform !== 'Reddit';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Subreddit Input Section */}
      <div className="glass-panel" style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(240, 243, 250, 0.95))',
        padding: '2.5rem'
      }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontFamily: 'Outfit', fontWeight: '800', color: '#111827' }}>
          Pain Point & Need Analyzer
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '600px', fontSize: '0.95rem' }}>
          {isPublicTarget
            ? `Scans public indexed ${analysisTarget.platform} signals for complaints, product requests, recommendations, and buying intent.`
            : 'Scans the hot threads of a subreddit and extracts posts containing complaints, product requests, and willing-to-pay indicators.'
          }
        </p>

        {isPublicTarget ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className={`badge badge-platform badge-${analysisTarget.platform.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
              {analysisTarget.platform}
            </span>
            <strong style={{ color: 'var(--text-main)' }}>{analysisTarget.name}</strong>
            <button
              className="btn-glow"
              onClick={() => handleAnalyzeCommunity(analysisTarget)}
              disabled={loading}
            >
              <Flame size={16} />
              {loading ? 'Scanning...' : 'Rescan Public Signals'}
            </button>
          </div>
        ) : (
          <SearchBar
            value={subreddit.replace(/^r\//i, '')}
            onChange={(val) => setSubreddit(val)}
            onSubmit={() => handleAnalyze()}
            placeholder="subredditname (e.g. learnSQL, resinprinting)"
            loading={loading}
            prefix="r/"
            buttonText="Scan Needs"
            maxWidth="600px"
          />
        )}
      </div>

      {/* Opportunities List Section */}
      <section className="glass-panel" style={{ minHeight: '300px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111827' }}>
            <Flame size={20} style={{ color: 'var(--accent-gold)' }} />
            Detected Money-Making Opportunities {opportunities.length > 0 && `(${opportunities.length})`}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={handleBackToSearch}>
              <ArrowLeft size={16} />
              Back to Search
            </button>
            {onClearSubreddit && (
              <button className="btn-secondary" onClick={() => { setSubreddit(''); setOpportunities([]); setExpandedContentIds(new Set()); onClearSubreddit(); }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            color: '#059669',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            {successMsg}
          </div>
        )}

        {error && (
          <p style={{ color: '#dc2626', padding: '1rem 0' }}>{error}</p>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 0', gap: '1rem' }}>
            <div className="loading-pulse" style={{ width: '2.5rem', height: '2.5rem' }}></div>
            <p style={{ color: 'var(--text-muted)' }}>
              {isPublicTarget ? 'Searching public web signals and matching buying-intent language...' : 'Reading threads and performing keyword matching...'}
            </p>
          </div>
        ) : opportunities.length > 0 ? (
          <div className="pain-point-list">
            {opportunities.map((opp) => {
              const isExpanded = expandedContentIds.has(opp.id);
              const displayContent = isExpanded
                ? (opp.fullContent || opp.rawContent || opp.snippet)
                : (opp.snippet || opp.fullContent || opp.rawContent);
              const canExpand = Boolean(opp.fullContent && opp.fullContent !== opp.snippet);

              return (
              <article key={opp.id} className="pain-point-item">
                <div className="pain-point-header">
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>
                        {opp.platform === 'Reddit' || !opp.platform
                          ? `Posted by u/${opp.author}`
                          : `Public signal from ${opp.source || opp.platform}`
                        }
                      </span>
                      <div className="pain-point-categories">
                        {opp.categories.map((cat, idx) => (
                          <span key={idx} className={`category-tag ${cat.type}`}>
                            {cat.label} ({cat.matchedWord})
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <a 
                      href={opp.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="pain-point-title"
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#111827' }}
                    >
                      {opp.title}
                      <ExternalLink size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    </a>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn-secondary" 
                      onClick={() => handleSaveIdea(opp)}
                      title="Bookmark this opportunity & thread to My Saved Niches"
                      style={{ padding: '0.5rem 0.75rem' }}
                    >
                      <Bookmark size={14} style={{ color: 'var(--accent-gold)' }} />
                      Bookmark & Ideate
                    </button>
                  </div>
                </div>

                <div style={{
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                  lineHeight: '1.55',
                  margin: '0.75rem 0',
                  background: 'rgba(0, 0, 0, 0.03)',
                  padding: '0.9rem',
                  borderRadius: '6px',
                  borderLeft: '3px solid var(--accent-primary)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: isExpanded ? 'none' : '11rem',
                  overflow: isExpanded ? 'visible' : 'hidden'
                }}>
                  <HighlightedContent text={displayContent} categories={opp.categories} />
                </div>

                {canExpand && (
                  <button
                    className="btn-secondary"
                    onClick={() => toggleFullContent(opp.id)}
                    style={{ padding: '0.4rem 0.65rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isExpanded ? 'Show Less' : 'Show Full Content'}
                  </button>
                )}

                <div className="pain-point-meta">
                  {(opp.platform === 'Reddit' || !opp.platform) ? (
                    <>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ThumbsUp size={12} />
                        {opp.score} upvotes
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageSquare size={12} />
                        {opp.commentsCount} comments
                      </span>
                    </>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MessageSquare size={12} />
                      Public web signal
                    </span>
                  )}
                  <span style={{ color: 'var(--accent-gold)', fontWeight: '600' }}>
                    Relevance: {opp.relevanceScore}/5
                  </span>
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0', gap: '1rem', color: 'var(--text-dark)' }}>
            <Search size={40} />
            <p>No opportunities loaded. Enter a subreddit name above to extract pain points.</p>
          </div>
        )}
      </section>
    </div>
  );
}
