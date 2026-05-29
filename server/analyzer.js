import { redditGet } from './redditClient.js';
import { scrapeUrl, searchWeb } from './webSearch.js';

// Define categorization patterns — much broader to catch real-world language
const PATTERNS = {
  frustration: {
    label: 'Pain Point / Frustration',
    keywords: /\b(annoying|frustrated|frustrating|pain|hate|sucks|issue|problem|broken|useless|flaw|horrible|terrible|wasted|waste of time|hard to|struggling with|confused by|hate when|fails to|disappointed|sick of|tired of|fed up|drives me crazy|can't stand|doesn't work|not working|stopped working|keep getting|won't stop|ruined|worst|nightmare|regret|mistake|wrong with|what happened|concerned|worried|scared|urgent|emergency|vet|help me|please help|need help|any advice|what should I do|what do I do|is this normal|SOS|desperate)\b/i
  },
  missingTool: {
    label: 'Product / Software Need',
    keywords: /\b(is there an app|is there a tool|looking for a tool|alternative to|any software|automated script|how can I automate|is there a way to|recommend a plugin|solution for|automated way|wish there was|someone should build|need a tool|any extension|browser extension|where can I find|where can I get|where can I buy|where do you get|how do I|how to fix|how to solve|how to make|how to get|does anyone know|anyone know how|what do you use for|what tools|what product|what equipment|what supplies|DIY|tutorial)\b/i
  },
  buyingIntent: {
    label: 'Buying Intent / Budget',
    keywords: /\b(willing to pay|budget|hire|cost|price|premium|paid|subscribe|how much does|buy|purchase|worth the money|commission|pricing|checkout|paying|spend|spent|expensive|cheap|affordable|deal|sale|discount|coupon|order|ordered|shipping|delivery|investment|invest in|splurge|upgrade|upgrading|bought|just got|picked up|pulled the trigger)\b/i
  },
  recommendation: {
    label: 'Product Recommendation',
    keywords: /\b(recommend|best tool|best app|best software|what do you use|what's the best|looking for|suggestion|suggestions|any good|top picks|favorite|favourite|which one|comparison|compare|vs |versus|review|reviews|worth it|should I get|should I buy|which should|thoughts on|opinions on|experience with|experiences with|anyone tried|has anyone used|does anyone recommend|what brand|which brand)\b/i
  }
};

const PLATFORM_SITE_FILTERS = {
  'Mighty Networks': 'site:mn.co',
  'Facebook Group': 'site:facebook.com/groups',
  'Discord': 'site:disboard.org',
  'Threads': 'site:threads.com'
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const MAX_SNIPPET_LENGTH = 700;
const MAX_FULL_CONTENT_LENGTH = 12000;

function normalizeText(value) {
  return (value || '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\\([_*\[\]()|])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, maxLength) {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSentence = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf('? '),
    truncated.lastIndexOf('! ')
  );
  const end = lastSentence > maxLength * 0.45 ? lastSentence + 1 : truncated.lastIndexOf(' ');
  return `${truncated.slice(0, end > 0 ? end : maxLength).trim()}...`;
}

function removeMarkdownNoise(value) {
  return (value || '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\\([_*\[\]()|`])/g, '$1');
}

function extractMainRedditPost(rawText, title = '') {
  const withoutMarkdown = removeMarkdownNoise(rawText);
  const titleText = normalizeText(title)
    .replace(/\s*:\s*r\/[^-]+(?:\s*-\s*Reddit)?$/i, '')
    .trim();
  const lower = withoutMarkdown.toLowerCase();
  const titleLower = titleText.toLowerCase();

  let start = -1;
  if (titleLower) {
    start = lower.indexOf(`# ${titleLower}`);
    if (start === -1) start = lower.indexOf(titleLower);
  }
  if (start === -1) start = 0;

  let slice = withoutMarkdown.slice(start);
  const stopPatterns = [
    /\bRead more\b/i,
    /\bShare\s+\*\s+\*\s+\*\s+Advertisement\b/i,
    /\bAdvertisement:/i,
    /\bComments Section\b/i,
    /\bModerator Announcement\b/i,
    /\bMore posts you may like\b/i,
    /\bReddit Rules\b/i,
    /\bExpand Navigation\b/i,
    /\breCAPTCHA\b/i
  ];

  let stop = slice.length;
  for (const pattern of stopPatterns) {
    const match = slice.match(pattern);
    if (match && match.index > 120) {
      stop = Math.min(stop, match.index);
    }
  }

  slice = slice.slice(0, stop);
  slice = slice
    .replace(/^.*?#\s*/s, '')
    .replace(/\bSkip to (?:main content|Navigation|Right Sidebar|Sign up)\b/gi, ' ')
    .replace(/\b\d+\s*[·•]\s*\d+\s+Back\b/g, ' ')
    .replace(/\br\/[A-Za-z0-9_]+\s*•\s*[\w\s]+\s+ago\s+\S+\s+Report\b/i, ' ')
    .replace(/\bReport\b/g, ' ')
    .replace(/\bView in app\b/gi, ' ')
    .replace(/\bThis video cannot be played\..*?Sorry, something went wrong when loading this video\./gi, ' ')
    .replace(/`{3,}/g, ' ');

  return normalizeText(slice);
}

function isNoiseLine(line) {
  return /^(skip to|go to |r\/|share$|report$|read more$|advertisement|promoted|about this ad|tired of ads|learn more$|comments section|moderator announcement|i am a bot|reddit rules|privacy policy|user agreement|your privacy choices|accessibility|expand navigation|collapse navigation|recaptcha|protected by|all rights reserved)/i.test(line);
}

function cleanScrapedRedditContent(rawText, title = '') {
  const redditPost = extractMainRedditPost(rawText, title);
  if (redditPost && redditPost.length > 80) {
    return redditPost;
  }

  const normalizedTitle = normalizeText(title).toLowerCase();
  const lines = (rawText || '')
    .split(/\r?\n+/)
    .map(line => normalizeText(line))
    .filter(Boolean)
    .filter(line => line.length > 2)
    .filter(line => !isNoiseLine(line))
    .filter(line => line.toLowerCase() !== normalizedTitle);

  const kept = [];
  for (const line of lines) {
    if (/^\d+\s*(upvotes?|comments?)\b/i.test(line)) continue;
    if (/\b(reddit rules|privacy policy|user agreement|recaptcha requires verification)\b/i.test(line)) break;
    if (/\b(advertisement|promoted|sponsored|walmart|homedepot|the home depot)\b/i.test(line)) continue;
    if (line.length < 25 && kept.length > 0) continue;

    kept.push(line);
    if (kept.join(' ').length > MAX_FULL_CONTENT_LENGTH) break;
  }

  const cleaned = kept.join(' ');
  return cleaned || normalizeText(rawText);
}

function buildOpportunityText({ title, markdown, description }) {
  const cleanedContent = cleanScrapedRedditContent(markdown || description || '', title);
  const fullContent = truncateText(cleanedContent || description || title, MAX_FULL_CONTENT_LENGTH);
  const snippet = truncateText(cleanedContent || description || title, MAX_SNIPPET_LENGTH);
  const rawContent = `${title || ''}\n\n${fullContent}`;

  return { snippet, fullContent, rawContent };
}

function needsFullContentHydration(item) {
  const markdownLength = item.markdown?.length || 0;
  const description = item.description || '';
  return markdownLength < 800 || /\.\.\.|…/.test(description);
}

async function hydrateRedditSearchResult(item) {
  if (!needsFullContentHydration(item)) return item;

  try {
    const scraped = await scrapeUrl(item.url);
    if (!scraped?.markdown || scraped.markdown.length < (item.markdown?.length || 0)) {
      return item;
    }

    return {
      ...item,
      title: item.title || scraped.title,
      description: item.description || scraped.description,
      markdown: scraped.markdown
    };
  } catch (error) {
    console.error(`  Firecrawl scrape failed for Reddit result ${item.url}:`, error.message);
    return item;
  }
}

function classifyText(fullText) {
  const matchedCategories = [];
  let score = 0;

  for (const [key, pattern] of Object.entries(PATTERNS)) {
    const matches = fullText.match(pattern.keywords);
    if (matches) {
      matchedCategories.push({
        type: key,
        label: pattern.label,
        matchedWord: matches[0]
      });
      score += 1;
    }
  }

  return { matchedCategories, score };
}

function getCommunityQuery(community) {
  const sourceText = [
    community?.name,
    community?.title,
    community?.description
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/^r\//i, '')
    .replace(/^Opportunity in\s+/i, '')
    .replace(/https?:\/\/\S+/g, ' ');

  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'community', 'group',
    'official', 'free', 'paid', 'about', 'home', 'www', 'com', 'https'
  ]);

  const tokens = sourceText
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(token => token.length > 2 && !stopWords.has(token)) || [];

  const uniqueTokens = [...new Set(tokens)].slice(0, 5);
  return uniqueTokens.join(' ') || community?.name || community?.title || '';
}

function getSiteFilter(community) {
  if (PLATFORM_SITE_FILTERS[community?.platform]) {
    return PLATFORM_SITE_FILTERS[community.platform];
  }

  try {
    const hostname = new URL(community?.url).hostname.replace(/^www\./, '');
    return `site:${hostname}`;
  } catch {
    return '';
  }
}

function getPlatformDomains(platform) {
  const domainsByPlatform = {
    'Facebook Group': ['facebook.com'],
    'Mighty Networks': ['mn.co', 'mightynetworks.com'],
    'Discord': ['disboard.org', 'discord.gg', 'discord.com'],
    'Threads': ['threads.com', 'threads.net']
  };

  return domainsByPlatform[platform] || [];
}

function isValidPlatformSignalUrl(platform, url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    if (platform === 'Facebook Group') {
      return hostname === 'facebook.com' && pathname.startsWith('/groups/');
    }
    if (platform === 'Mighty Networks') return hostname === 'mn.co' || hostname.endsWith('.mn.co') || hostname.includes('mightynetworks.com');
    if (platform === 'Discord') return hostname === 'disboard.org' || hostname === 'discord.gg' || hostname === 'discord.com';
    if (platform === 'Threads') return hostname === 'threads.com' || hostname === 'threads.net';

    return true;
  } catch {
    return false;
  }
}

function isLikelyAdOrCorporateSignal(title, text, url) {
  const combined = `${title || ''} ${text || ''} ${url || ''}`.toLowerCase();
  return /\b(advertisement|sponsored|promoted|supply chain leaders|dashboard for your entire|book a demo|request demo|whitepaper|case study|webinar|pricing|enterprise)\b/.test(combined);
}

function isRelevantToCommunity(query, ...values) {
  const queryTokens = query.match(/[a-z0-9]+/gi)?.filter(token => token.length > 3) || [];
  if (queryTokens.length === 0) return true;

  const searchableText = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\btight[-\s]?knit(?:ted)?\b/g, '');

  return queryTokens.some(token => searchableText.includes(token.toLowerCase()));
}

function buildMetadataFallbackNeeds(community, queryKeywords) {
  const nicheLabel = community?.name || queryKeywords || 'this community';
  const platform = community?.platform || 'Web';
  const sourceNote = ['Skool', 'Circle.so'].includes(platform)
    ? `${platform} member discussions are not publicly accessible, so this signal is inferred from the community metadata and platform context.`
    : 'Public posts were not accessible or indexed, so this signal is inferred from the community metadata and platform context.';

  return [
    {
      id: `metadata-${platform}-onboarding-${Date.now()}`,
      title: `Validate onboarding friction in ${nicheLabel}`,
      url: community?.url || '#',
      author: platform,
      platform,
      source: 'Community metadata',
      score: 0,
      commentsCount: 0,
      categories: [{
        type: 'frustration',
        label: PATTERNS.frustration.label,
        matchedWord: 'hard to'
      }],
      snippet: `${sourceNote} Look for beginner setup questions, repeated how-to posts, and confusion that could become a checklist, guide, or diagnostic tool.`,
      fullContent: `${sourceNote}\n\nLook for beginner setup questions, repeated how-to posts, and confusion that could become a checklist, guide, or diagnostic tool.`,
      rawContent: `${nicheLabel} ${community?.description || ''}`,
      relevanceScore: 1
    },
    {
      id: `metadata-${platform}-tooling-${Date.now()}`,
      title: `Explore tools, templates, or product bundles for ${nicheLabel}`,
      url: community?.url || '#',
      author: platform,
      platform,
      source: 'Community metadata',
      score: 0,
      commentsCount: 0,
      categories: [{
        type: 'missingTool',
        label: PATTERNS.missingTool.label,
        matchedWord: 'need a tool'
      }],
      snippet: `${sourceNote} Paid or tightly focused communities often need repeatable resources: templates, calculators, checklists, curated supplies, or workflow helpers.`,
      fullContent: `${sourceNote}\n\nPaid or tightly focused communities often need repeatable resources: templates, calculators, checklists, curated supplies, or workflow helpers.`,
      rawContent: `${nicheLabel} ${community?.description || ''}`,
      relevanceScore: 1
    },
    {
      id: `metadata-${platform}-buying-${Date.now()}`,
      title: `Test buying intent around premium solutions for ${nicheLabel}`,
      url: community?.url || '#',
      author: platform,
      platform,
      source: 'Community metadata',
      score: 0,
      commentsCount: 0,
      categories: [{
        type: 'buyingIntent',
        label: PATTERNS.buyingIntent.label,
        matchedWord: 'paid'
      }],
      snippet: `${sourceNote} Since this is on ${platform}, validate whether members already pay for access, coaching, courses, supplies, or expert support.`,
      fullContent: `${sourceNote}\n\nSince this is on ${platform}, validate whether members already pay for access, coaching, courses, supplies, or expert support.`,
      rawContent: `${nicheLabel} ${community?.description || ''}`,
      relevanceScore: 1
    }
  ];
}

// Fetch posts from a single Reddit listing endpoint
async function fetchRedditPosts(subreddit, listing, { limit = 30, t } = {}) {
  try {
    const response = await redditGet(`/r/${subreddit}/${listing}`, {
      params: { limit, ...(t ? { t } : {}) },
      timeout: 15000
    });
    if (!response.data?.data?.children) return [];
    return response.data.data.children;
  } catch (error) {
    console.error(`  Error fetching /${listing} for r/${subreddit}:`, error.message);
    return [];
  }
}

// Fetch and analyze subreddit posts across multiple listings
export async function analyzeSubredditNeeds(subredditName) {
  try {
    // Clean name: remove r/ prefix if present
    const cleanSubreddit = subredditName.replace(/^r\//i, '').trim();
    
    console.log(`  Fetching hot, new, and top posts for r/${cleanSubreddit}...`);

    // Fetch from hot, new, AND top (weekly) in parallel for much broader coverage
    const [hotPosts, newPosts, topPosts] = await Promise.all([
      fetchRedditPosts(cleanSubreddit, 'hot', { limit: 30 }),
      fetchRedditPosts(cleanSubreddit, 'new', { limit: 30 }),
      fetchRedditPosts(cleanSubreddit, 'top', { limit: 25, t: 'week' })
    ]);

    // Deduplicate by post ID
    const seenIds = new Set();
    const allPosts = [];
    for (const post of [...hotPosts, ...newPosts, ...topPosts]) {
      const id = post.data?.id;
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        allPosts.push(post);
      }
    }

    console.log(`  Total unique posts to analyze: ${allPosts.length}`);

    if (allPosts.length === 0) {
      console.log(`  Reddit listings unavailable for r/${cleanSubreddit}; using web search fallback...`);
      return analyzeSubredditNeedsViaSearch(cleanSubreddit);
    }

    const opportunities = [];

    for (const post of allPosts) {
      const data = post.data;
      
      // Skip stickied posts as they are usually rules/megathreads
      if (data.stickied) continue;

      const title = data.title || '';
      const body = data.selftext || '';
      const fullText = `${title}\n\n${body}`;

      const { matchedCategories, score } = classifyText(fullText);

      // If we found any matches, record this as a pain point opportunity
      if (matchedCategories.length > 0) {
        const fullContent = body || '(No body text)';

        opportunities.push({
          id: `post-${data.id}`,
          title: title,
          url: `https://www.reddit.com${data.permalink}`,
          author: data.author,
          score: data.score, // Upvotes
          commentsCount: data.num_comments,
          categories: matchedCategories,
          snippet: fullContent,
          fullContent,
          rawContent: fullText,
          relevanceScore: score + (data.num_comments > 10 ? 1 : 0) + (data.score > 20 ? 1 : 0) // Heuristic scoring
        });
      }
    }

    console.log(`  Found ${opportunities.length} opportunities in r/${cleanSubreddit}`);

    // Sort opportunities by relevance score desc
    return opportunities.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (error) {
    console.error(`Error analyzing subreddit r/${subredditName}:`, error.message);
    return [];
  }
}

async function analyzeSubredditNeedsViaSearch(subreddit) {
  const searchQueries = [
    `${subreddit} help problem issue advice`,
    `${subreddit} recommend best tool`,
    `${subreddit} worth price cost`,
    `${subreddit} wish need`
  ];

  const results = [];
  const seenUrls = new Set();

  for (let i = 0; i < searchQueries.length; i++) {
    if (i > 0) await delay(500);

    try {
      const webResults = await searchWeb(searchQueries[i], {
        limit: 10,
        scrape: true,
        includeDomains: ['reddit.com'],
        preferredProviders: ['firecrawl', 'brave', 'yahoo']
      });
      for (const item of webResults) {
        if (!item.url || !item.url.toLowerCase().includes(`reddit.com/r/${subreddit.toLowerCase()}`)) continue;

        const normalizedUrl = item.url.replace(/\/+$/, '').split('?')[0].split('#')[0].toLowerCase();
        if (seenUrls.has(normalizedUrl)) continue;
        seenUrls.add(normalizedUrl);

        const hydratedItem = await hydrateRedditSearchResult(item);
        const { snippet, fullContent, rawContent } = buildOpportunityText({
          title: hydratedItem.title || `Reddit signal in r/${subreddit}`,
          markdown: hydratedItem.markdown,
          description: hydratedItem.description
        });
        const { matchedCategories, score } = classifyText(rawContent);
        if (matchedCategories.length === 0) continue;

        results.push({
          id: `web-reddit-${results.length}-${Date.now()}`,
          title: hydratedItem.title || `Reddit signal in r/${subreddit}`,
          url: hydratedItem.url || item.url,
          author: 'Reddit',
          platform: 'Reddit',
          source: 'Public web search',
          score: 0,
          commentsCount: 0,
          categories: matchedCategories,
          snippet,
          fullContent,
          rawContent,
          relevanceScore: score
        });
      }
    } catch (error) {
      console.error(`  Reddit web analysis fallback failed for "${searchQueries[i]}":`, error.message);
    }
  }

  console.log(`  Found ${results.length} web fallback opportunities in r/${subreddit}`);
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

async function searchWebForNeeds(searchQuery, community, queryKeywords, sourceLabel = community.platform) {
  const platformDomains = getPlatformDomains(community.platform);
  const shouldScrape = community.platform !== 'Facebook Group';
  const preferredProviders = community.platform === 'Facebook Group'
    ? ['brave', 'firecrawl', 'yahoo']
    : ['firecrawl', 'brave', 'yahoo'];

  const webResults = await searchWeb(searchQuery, {
    limit: 10,
    scrape: shouldScrape,
    includeDomains: platformDomains,
    preferredProviders
  });
  const results = [];

  webResults.forEach((item, index) => {
    const url = item.url;
    const title = item.title;
    if (!url || !title) return;
    if (!isValidPlatformSignalUrl(community.platform, url)) return;

    const { snippet, fullContent, rawContent } = buildOpportunityText({
      title,
      markdown: item.markdown,
      description: item.description
    });
    if (isLikelyAdOrCorporateSignal(title, rawContent, url)) return;

    if (!isRelevantToCommunity(queryKeywords, title, rawContent, url)) return;

    const { matchedCategories, score } = classifyText(rawContent);
    if (matchedCategories.length === 0) return;

    results.push({
      id: `web-${community.platform}-${index}-${Date.now()}`,
      title,
      url,
      author: community.platform,
      platform: community.platform,
      source: sourceLabel,
      score: 0,
      commentsCount: 0,
      categories: matchedCategories,
      snippet: snippet || 'Public search result matched a need signal.',
      fullContent: fullContent || 'Public search result matched a need signal.',
      rawContent,
      relevanceScore: score
    });
  });

  return results;
}

function mergeCategories(results) {
  const seen = new Set();
  const categories = [];

  for (const result of results) {
    for (const category of result.categories || []) {
      const key = `${category.type}:${category.matchedWord}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      categories.push(category);
    }
  }

  return categories.slice(0, 6);
}

function aggregateFacebookSignals(results, community) {
  if (!results.length) return [];

  const sourceLines = results
    .slice(0, 8)
    .map((result, index) => {
      const sourceText = result.snippet || result.fullContent || result.title;
      return `${index + 1}. ${result.title}: ${sourceText}`;
    });
  const fullContent = sourceLines.join('\n\n');
  const snippet = truncateText(fullContent, MAX_SNIPPET_LENGTH);
  const relevanceScore = Math.min(5, Math.max(...results.map(result => result.relevanceScore || 1)) + Math.min(2, Math.floor(results.length / 3)));

  return [{
    id: `facebook-aggregate-${Date.now()}`,
    title: `Facebook group signals for ${community.name || 'this community'}`,
    url: community.url || results[0].url,
    author: 'Facebook Group',
    platform: 'Facebook Group',
    source: 'Facebook Group public signals',
    score: 0,
    commentsCount: results.length,
    categories: mergeCategories(results),
    snippet,
    fullContent,
    rawContent: fullContent,
    relevanceScore
  }];
}

export async function analyzeCommunityNeeds(community) {
  if (!community?.platform) return [];

  if (community.platform === 'Reddit') {
    const subredditFromUrl = community.url?.match(/reddit\.com\/r\/([^/]+)/i)?.[1];
    const subredditName = subredditFromUrl || community.name?.replace(/^r\//i, '');
    return analyzeSubredditNeeds(subredditName);
  }

  try {
    const queryKeywords = getCommunityQuery(community);
    if (!queryKeywords) return [];

    if (['Skool', 'Circle.so'].includes(community.platform)) {
      console.log(`  ${community.platform} discussions are not publicly accessible; using metadata fallback for ${community.name}.`);
      return buildMetadataFallbackNeeds(community, queryKeywords);
    }

    const siteFilter = getSiteFilter(community);
    if (!siteFilter) return buildMetadataFallbackNeeds(community, queryKeywords);

    console.log(`  Searching public need signals for ${community.platform}: "${queryKeywords}"...`);

    const needQueries = [
      `${siteFilter} ${queryKeywords} problem issue help`,
      `${siteFilter} ${queryKeywords} recommend best tool`,
      `${siteFilter} ${queryKeywords} worth price cost`,
      `${siteFilter} ${queryKeywords} wish need`
    ];

    const results = [];
    for (let i = 0; i < needQueries.length; i++) {
      if (i > 0) await delay(500);
      try {
        const queryResults = await searchWebForNeeds(needQueries[i], community, queryKeywords, community.platform);
        results.push(...queryResults);
      } catch (error) {
        console.error(`  Public need search failed for "${needQueries[i]}":`, error.message);
      }
    }

    const seenUrls = new Set();
    const deduped = [];
    for (const result of results) {
      const normalizedUrl = result.url.replace(/\/+$/, '').split('?')[0].split('#')[0].toLowerCase();
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.add(normalizedUrl);
        deduped.push(result);
      }
    }

    if (deduped.length === 0 && !getPlatformDomains(community.platform).length) {
      const broaderQueries = [
        `${queryKeywords} forum problem issue help`,
        `${queryKeywords} recommend best tool`,
        `${queryKeywords} worth price cost`
      ];

      for (let i = 0; i < broaderQueries.length; i++) {
        await delay(500);
        try {
          const broaderResults = await searchWebForNeeds(
            broaderQueries[i],
            community,
            queryKeywords,
            'Public Web'
          );

          for (const result of broaderResults) {
            const normalizedUrl = result.url.replace(/\/+$/, '').split('?')[0].split('#')[0].toLowerCase();
            if (!seenUrls.has(normalizedUrl)) {
              seenUrls.add(normalizedUrl);
              deduped.push(result);
            }
          }
        } catch (error) {
          console.error(`  Broader public need search failed for "${broaderQueries[i]}":`, error.message);
        }
      }
    }

    if (deduped.length === 0) {
      return buildMetadataFallbackNeeds(community, queryKeywords);
    }

    if (community.platform === 'Facebook Group') {
      const aggregated = aggregateFacebookSignals(deduped, community);
      console.log(`  Found ${deduped.length} Facebook signals aggregated into ${aggregated.length} source for ${community.name}`);
      return aggregated;
    }

    console.log(`  Found ${deduped.length} public need signals for ${community.name}`);
    return deduped.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (error) {
    console.error(`Error analyzing public community signals for ${community.name}:`, error.message);
    return [];
  }
}
