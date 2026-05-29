import React, { useState, useEffect } from 'react';
import { Search, Flame, Award, Heart } from 'lucide-react';
import Dashboard from './components/Dashboard.jsx';
import PainPointAnalyzer from './components/PainPointAnalyzer.jsx';
import SavedNiches from './components/SavedNiches.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('discover');
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [savedCount, setSavedCount] = useState(0);

  // Fetch saved niches count on load and set up simple polling or update trigger
  const updateSavedCount = async () => {
    try {
      const response = await fetch('/api/saved');
      if (response.ok) {
        const data = await response.json();
        setSavedCount(data.length);
      }
    } catch (error) {
      console.error('Failed to update saved count:', error);
    }
  };

  useEffect(() => {
    updateSavedCount();
  }, [activeTab]);

  // Handler to bridge Discover card click to the Pain Point Analyzer
  const handleAnalyzeCommunity = (communityOrSubreddit) => {
    if (typeof communityOrSubreddit === 'string') {
      setSelectedSubreddit(communityOrSubreddit);
      setSelectedCommunity(null);
    } else {
      setSelectedCommunity(communityOrSubreddit);
      setSelectedSubreddit(communityOrSubreddit?.platform === 'Reddit' ? communityOrSubreddit.name : '');
    }
    setActiveTab('analyzer');
  };

  return (
    <div className="app-container">
      {/* Premium Header and Navigation */}
      <header className="header-nav">
        <a href="#" className="brand" onClick={() => setActiveTab('discover')}>
          <span className="brand-logo">NicheGlow</span>
          <span className="brand-subtitle">Micro-Community Hunter</span>
        </a>

        <nav className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            <Search size={18} />
            Discover Niches
          </button>
          
          <button 
            className={`nav-tab ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyzer')}
          >
            <Flame size={18} />
            Pain Point Analyzer
          </button>
          
          <button 
            className={`nav-tab ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveTab('saved')}
          >
            <Heart size={18} />
            My Saved Niches
            {savedCount > 0 && (
              <span style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                padding: '0.1rem 0.4rem',
                borderRadius: '50%',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                marginLeft: '0.25rem'
              }}>
                {savedCount}
              </span>
            )}
          </button>
        </nav>
      </header>

      {/* Main Page Rendering */}
      <main style={{ flex: 1 }}>
        <div style={{ display: activeTab === 'discover' ? 'block' : 'none' }}>
          <Dashboard 
            onAnalyze={handleAnalyzeCommunity} 
            onSavedUpdate={updateSavedCount} 
          />
        </div>
        
        {activeTab === 'analyzer' && (
          <PainPointAnalyzer 
            initialSubreddit={selectedSubreddit} 
            initialCommunity={selectedCommunity}
            onClearSubreddit={() => { setSelectedSubreddit(''); setSelectedCommunity(null); }} 
            onBackToSearch={() => {
              setActiveTab('discover');
              // Scroll to the top of the page to show the full Discover screen
              setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }, 50);
            }}
            onSavedUpdate={updateSavedCount}
          />
        )}
        
        {activeTab === 'saved' && (
          <SavedNiches 
            onSavedUpdate={updateSavedCount} 
            onAnalyze={handleAnalyzeCommunity}
          />
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '2rem 0',
        color: 'var(--text-dark)',
        fontSize: '0.85rem',
        borderTop: '1px solid var(--border-color)',
        marginTop: '3rem'
      }}>
        <p>NicheGlow Discovery Dashboard &copy; 2026. Made for identifying high-value monetization opportunities.</p>
      </footer>
    </div>
  );
}
