import React, { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, Sparkles, AlertCircle, Lightbulb, ChevronDown, ChevronUp, Zap, Palette, Dumbbell, DollarSign, Cpu, Gamepad2, Utensils, GraduationCap, Heart, Wrench } from 'lucide-react';
import CommunityCard from './CommunityCard.jsx';
import SearchBar from './SearchBar.jsx';

const QUICK_SUGGESTIONS = [
  'Resin 3D printing',
  'Custom mechanical keyboards',
  'Notion templates',
  'Retro game repair',
  'Leathercraft wallets',
  'Home automation',
  'Sourdough baking'
];

const NICHE_CATEGORIES = [
  {
    name: 'Digital Tools & SaaS',
    icon: 'Cpu',
    color: '#6366f1',
    description: 'Software, apps, and automation communities where users pay for solutions',
    niches: [
      'Excel automation templates', 'Power BI dashboard', 'Notion templates',
      'Obsidian plugins', 'Airtable automation', 'Zapier workflows',
      'Google Sheets formulas', 'Figma plugins', 'VS Code extensions',
      'Salesforce admin', 'HubSpot CRM', 'Shopify apps'
    ]
  },
  {
    name: 'Crafts & Making',
    icon: 'Palette',
    color: '#ec4899',
    description: 'Handmade goods and maker communities with active buying/selling',
    niches: [
      'Resin art', 'Crochet patterns', 'Leathercraft wallets', 'Candle making',
      'Pottery wheel', 'Soap making', 'Woodworking jigs', 'Embroidery patterns',
      'Jewelry making', 'Book binding', 'Screen printing', 'Laser cutting projects'
    ]
  },
  {
    name: 'Tech & Electronics',
    icon: 'Zap',
    color: '#3b82f6',
    description: 'Hardware enthusiasts who spend heavily on specialized gear',
    niches: [
      'Custom mechanical keyboards', 'Home lab server', 'Raspberry Pi projects',
      'Arduino automation', 'Ham radio', '3D printer mods', 'Custom PC watercooling',
      'Smart home devices', 'Drone building', 'FPGA development', 'ESP32 projects',
      'Retro computing'
    ]
  },
  {
    name: 'Health & Fitness',
    icon: 'Dumbbell',
    color: '#10b981',
    description: 'Specialized fitness & wellness niches with supplement/product spend',
    niches: [
      'Kettlebell training', 'Calisthenics bodyweight', 'Carnivore diet',
      'Cold plunge therapy', 'Posture correction', 'TMJ exercises',
      'Grip strength training', 'Mobility stretching', 'Sleep optimization',
      'Biohacking supplements', 'Running form analysis', 'Pilates reformer'
    ]
  },
  {
    name: 'Finance & Side Hustles',
    icon: 'DollarSign',
    color: '#f59e0b',
    description: 'Money-focused communities with high buying intent',
    niches: [
      'Flipping reselling', 'Print on demand', 'Etsy shop tips',
      'Amazon FBA private label', 'Dividend investing', 'Options trading strategies',
      'Bookkeeping freelance', 'Tax strategies small business',
      'Vending machine business', 'Real estate wholesaling', 'Credit card churning',
      'FIRE financial independence'
    ]
  },
  {
    name: 'Gaming & Retro',
    icon: 'Gamepad2',
    color: '#8b5cf6',
    description: 'Collectors and retro gaming communities with active marketplaces',
    niches: [
      'Retro game repair', 'Game Boy modding', 'Steam Deck mods',
      'PS Vita homebrew', 'Retro game collecting', 'Board game design',
      'Tabletop miniature painting', 'D&D dungeon master tools',
      'Flight simulator hardware', 'Sim racing setup', 'ROM hacking',
      'Mechanical arcade sticks'
    ]
  },
  {
    name: 'Food & Drink',
    icon: 'Utensils',
    color: '#ef4444',
    description: 'Specialty food communities that love premium tools and ingredients',
    niches: [
      'Sourdough baking', 'Espresso machine', 'Fermentation kombucha',
      'Hot sauce making', 'Meat smoking BBQ', 'Sous vide cooking',
      'Cast iron cooking', 'Meal prep containers', 'Home brewing beer',
      'Cheese making', 'Japanese knife sharpening', 'Pizza oven outdoor'
    ]
  },
  {
    name: 'Learning & Education',
    icon: 'GraduationCap',
    color: '#0ea5e9',
    description: 'Skill-building communities where people pay for courses and tools',
    niches: [
      'Learn SQL database', 'Python automation scripts', 'Blender 3D modeling',
      'Music production FL Studio', 'Piano self taught', 'Calligraphy lettering',
      'Language learning immersion', 'Speed reading techniques',
      'Data science portfolio', 'UX design portfolio', 'Prompt engineering AI',
      'Copywriting freelance'
    ]
  },
  {
    name: 'Pets & Animals',
    icon: 'Heart',
    color: '#f472b6',
    description: 'Passionate pet owners who spend generously on their animals',
    niches: [
      'Aquarium planted tank', 'Reptile enclosure', 'Shrimp keeping aquarium',
      'Dog agility training', 'Raw feeding dogs', 'Cat enrichment toys',
      'Betta fish care', 'Beekeeping backyard', 'Chicken coop design',
      'Parrot training', 'Axolotl care', 'Hermit crab habitat'
    ]
  },
  {
    name: 'Home & DIY',
    icon: 'Wrench',
    color: '#14b8a6',
    description: 'Home improvement enthusiasts willing to buy tools and supplies',
    niches: [
      'Home automation', 'Garage workshop', 'CNC router projects',
      'Epoxy countertop', 'Van life conversion', 'Tiny house building',
      'Indoor garden hydroponics', 'Closet organization', 'Power washing',
      'Fence building', 'Welding beginner', 'Solar panel DIY'
    ]
  }
];

const ICON_MAP = {
  Cpu, Palette, Zap, Dumbbell, DollarSign, Gamepad2, Utensils, GraduationCap, Heart, Wrench
};

export default function Dashboard({ onAnalyze, onSavedUpdate }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [savedUrls, setSavedUrls] = useState([]);
  const [error, setError] = useState('');

  // Filters state
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [onlySweetSpot, setOnlySweetSpot] = useState(true);
  const [showNsfw, setShowNsfw] = useState(false);
  const [onlyHighMonetization, setOnlyHighMonetization] = useState(false);

  // Fetch saved URLs to check bookmarks
  const fetchSavedUrls = async () => {
    try {
      const response = await fetch('/api/saved');
      if (response.ok) {
        const data = await response.json();
        setSavedUrls(data.map(item => item.url));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSavedUrls();
  }, []);

  const handleSavedUpdate = async (savedCommunity) => {
    if (savedCommunity?.url) {
      setSavedUrls(prev => prev.includes(savedCommunity.url) ? prev : [...prev, savedCommunity.url]);
    }
    await fetchSavedUrls();
    if (onSavedUpdate) await onSavedUpdate();
  };

  const handleSearch = async (searchQuery) => {
    const term = searchQuery || query;
    if (!term.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      if (!response.ok) throw new Error('Search request failed');
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError('Could not connect to the search server. Please make sure the backend is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  // Filter Logic
  const filteredResults = results.filter(item => {
    // 1. Platform Filter
    if (selectedPlatform !== 'All' && item.platform !== selectedPlatform) return false;
    
    // 2. NSFW Filter
    if (!showNsfw && item.isNsfw) return false;

    // 3. Monetization Filter
    if (onlyHighMonetization && item.monetizationScore !== 'High') return false;

    // 4. Size Filter (Sweet spot is 500 to 30,000 members)
    if (onlySweetSpot) {
      // If memberCount is null, we show it (unknowns are allowed in case they are micro)
      if (item.memberCount !== null) {
        if (item.memberCount < 500 || item.memberCount > 30000) return false;
      }
    }

    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Search Input Banner */}
      <div className="glass-panel" style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(240, 243, 250, 0.95))',
        padding: '3rem 2.5rem'
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h2 style={{ fontSize: '2.2rem', marginBottom: '0.75rem', fontFamily: 'Outfit', fontWeight: '800' }}>
            Find Hyper-Niche Communities
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '600px', fontSize: '1.05rem', lineHeight: '1.5' }}>
            Search any niche, product, or hobby to find specific micro-communities (500 to 30k members) to explore and monetize.
          </p>

          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={() => handleSearch()}
            placeholder="Enter a keyword or niche (e.g. custom keycaps, resin casting)..."
            loading={loading}
            buttonText="Scan Niche"
            maxWidth="800px"
          />



          {/* Quick Suggestion Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dark)', fontWeight: '600', marginRight: '0.25rem' }}>
              Quick ideas:
            </span>
            {QUICK_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                className="btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px' }}
                onClick={() => handleSuggestionClick(s)}
                disabled={loading}
              >
                <Sparkles size={12} style={{ color: 'var(--accent-gold)' }} />
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>



      {/* Main Results Workspace */}
      <div className="dashboard-layout" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Filters Sidebar */}
        <aside className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <SlidersHorizontal size={18} style={{ color: 'var(--accent-primary)' }} />
            <h3 style={{ fontSize: '1.1rem' }}>Filter Options</h3>
          </div>

          {/* Size Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={onlySweetSpot}
                onChange={(e) => setOnlySweetSpot(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
              />
              <span style={{ fontWeight: '500' }}>Only Micro-Sweet Spot</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginLeft: '1.5rem' }}>
              Strictly show groups between 500 and 30k members (excludes massive groups).
            </p>
          </div>

          {/* Monetization filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={onlyHighMonetization}
                onChange={(e) => setOnlyHighMonetization(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
              />
              <span style={{ fontWeight: '500' }}>High Monetization Only</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginLeft: '1.5rem' }}>
              Only show platforms like Skool or Circle where members already pay.
            </p>
          </div>

          {/* NSFW / 18+ filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={showNsfw}
                onChange={(e) => setShowNsfw(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
              />
              <span style={{ fontWeight: '500', color: showNsfw ? '#f87171' : 'inherit' }}>Show 18+ / Adult groups</span>
            </label>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', marginLeft: '1.5rem' }}>
              Enable to search for mature niches, fetishes, or adult hobby groups.
            </p>
          </div>

          {/* Platform Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {['All', 'Reddit', 'Discord', 'Facebook Group', 'Skool', 'Circle.so', 'Mighty Networks', 'Threads'].map(p => (
                <button
                  key={p}
                  className={`btn-secondary ${selectedPlatform === p ? 'active' : ''}`}
                  onClick={() => setSelectedPlatform(p)}
                  style={{ justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Results Container */}
        <section style={{ flex: 1 }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              padding: '1rem',
              color: '#f87171',
              marginBottom: '1.5rem'
            }}>
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', gap: '1rem' }}>
              <div className="loading-pulse" style={{ width: '3rem', height: '3rem', borderWidth: '4px' }}></div>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: '500' }}>Scanning platforms for micro-communities...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Showing <strong>{filteredResults.length}</strong> matching micro-communities
                </span>
              </div>
              <div className="card-grid">
                {filteredResults.map((item) => (
                  <CommunityCard
                    key={item.id}
                    community={item}
                    onAnalyze={onAnalyze}
                    onSavedUpdate={handleSavedUpdate}
                    initiallySaved={savedUrls.includes(item.url)}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* ========== NICHE INSPIRATION EXPLORER ========== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Explorer Header */}
              <div className="glass-panel" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.5rem 2rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(245, 158, 11, 0.04))'
              }}>
                <Lightbulb size={28} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Not sure what to search? Explore profitable niches below</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                    Click any niche to instantly search for micro-communities. Each category is curated for monetization potential — communities where members <strong>actively spend money</strong> on tools, products, courses, and services.
                  </p>
                </div>
              </div>

              {/* Category Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                {NICHE_CATEGORIES.map((category) => {
                  const IconComponent = ICON_MAP[category.icon];
                  return (
                    <div
                      key={category.name}
                      className="glow-card"
                      style={{ padding: '1.25rem', height: 'auto' }}
                    >
                      {/* Category Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px',
                          background: `${category.color}22`,
                          border: `1px solid ${category.color}44`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {IconComponent && <IconComponent size={16} style={{ color: category.color }} />}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.2' }}>{category.name}</h4>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-dark)', marginBottom: '0.75rem', lineHeight: '1.3' }}>
                        {category.description}
                      </p>

                      {/* Niche Tags */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {category.niches.map((niche) => (
                          <button
                            key={niche}
                            onClick={() => handleSuggestionClick(niche)}
                            disabled={loading}
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: 'var(--text-muted)',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontWeight: '500'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = `${category.color}22`;
                              e.target.style.borderColor = `${category.color}55`;
                              e.target.style.color = category.color;
                              e.target.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'rgba(255,255,255,0.04)';
                              e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                              e.target.style.color = 'var(--text-muted)';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            {niche}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
