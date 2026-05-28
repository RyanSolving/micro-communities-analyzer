import express from 'express';
import cors from 'cors';
import { searchReddit, searchOtherPlatforms } from './scraper.js';
import { analyzeCommunityNeeds, analyzeSubredditNeeds } from './analyzer.js';
import { getSavedNiches, saveNiche, deleteNiche } from './database.js';
import { getKeywordIdeas } from './keywordIdeas.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Endpoint: Search micro-communities
app.get('/api/debug-env', (req, res) => {
  res.json({
    hasClientId: !!process.env.REDDIT_CLIENT_ID,
    hasClientSecret: !!process.env.REDDIT_CLIENT_SECRET,
    clientIdLength: process.env.REDDIT_CLIENT_ID ? process.env.REDDIT_CLIENT_ID.length : 0,
    nodeEnv: process.env.NODE_ENV || 'not set'
  });
});

app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Search query parameter "q" is required.' });
  }

  try {
    console.log(`Searching for niche: "${query}"...`);
    // Run search engines in parallel
    const [redditResults, webResults] = await Promise.all([
      searchReddit(query),
      searchOtherPlatforms(query)
    ]);

    const combined = [...redditResults, ...webResults];

    // Sort by subscriber count or score
    // Put results with identified subscriber counts first
    combined.sort((a, b) => {
      if (a.memberCount === null) return 1;
      if (b.memberCount === null) return -1;
      return b.memberCount - a.memberCount;
    });

    res.json({
      query,
      count: combined.length,
      results: combined
    });
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Failed to perform search. Please try again.' });
  }
});

// Endpoint: Discover adjacent keywords and monetization search angles
app.get('/api/keyword-ideas', (req, res) => {
  try {
    const seed = req.query.seed || '';
    res.json(getKeywordIdeas(seed));
  } catch (error) {
    console.error('Keyword idea generation failed:', error);
    res.status(500).json({ error: 'Failed to generate keyword ideas.' });
  }
});

// Endpoint: Analyze subreddit for pain points / needs
app.get('/api/analyze', async (req, res) => {
  const subreddit = req.query.subreddit;
  if (!subreddit) {
    return res.status(400).json({ error: 'Subreddit name is required.' });
  }

  try {
    console.log(`Analyzing pain points for subreddit: r/${subreddit}...`);
    const opportunities = await analyzeSubredditNeeds(subreddit);
    res.json({
      subreddit,
      count: opportunities.length,
      opportunities
    });
  } catch (error) {
    console.error('Analysis failed:', error);
    res.status(500).json({ error: 'Failed to analyze subreddit.' });
  }
});

// Endpoint: Analyze any community for public pain-point / need signals
app.post('/api/analyze-community', async (req, res) => {
  const community = req.body;
  if (!community || !community.platform) {
    return res.status(400).json({ error: 'Community payload with platform is required.' });
  }

  try {
    console.log(`Analyzing need signals for ${community.platform}: ${community.name || community.url}...`);
    const opportunities = await analyzeCommunityNeeds(community);
    res.json({
      community: community.name || community.url,
      platform: community.platform,
      count: opportunities.length,
      opportunities
    });
  } catch (error) {
    console.error('Community analysis failed:', error);
    res.status(500).json({ error: 'Failed to analyze community.' });
  }
});

// Endpoint: Get all saved niches/ideas
app.get('/api/saved', (req, res) => {
  try {
    const saved = getSavedNiches();
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch saved niches.' });
  }
});

// Endpoint: Save a community/idea
app.post('/api/saved', (req, res) => {
  try {
    const saved = saveNiche(req.body);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save niche.' });
  }
});

// Endpoint: Delete a saved community/idea
app.delete('/api/saved/:id', (req, res) => {
  const id = req.params.id;
  try {
    deleteNiche(id);
    res.json({ success: true, message: `Deleted niche with ID ${id}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete niche.' });
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`🚀 Express backend server running on http://localhost:${PORT}`);
});
