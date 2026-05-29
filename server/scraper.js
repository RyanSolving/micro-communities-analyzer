import axios from 'axios';
import * as cheerio from 'cheerio';
import { redditGet } from './redditClient.js';
import { cleanText, searchWeb } from './webSearch.js';

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MAX_MEMBER_THRESHOLD = 100000;

const GENERIC_TERMS = [
  'funny', 'pics', 'memes', 'gaming', 'music', 'movies', 'news', 'videos',
  'technology', 'science', 'politics', 'sports', 'food', 'travel', 'art',
  'books', 'photography', 'programming', 'askreddit', 'todayilearned',
  'worldnews', 'showerthoughts', 'jokes', 'lifeprotips'
];

const RELATED_QUERY_TERMS = {
  yarn: ['yarn', 'knit', 'knitting', 'knitters', 'crochet', 'fiber', 'fibre', 'wool'],
  knitting: ['knit', 'knitting', 'knitters', 'yarn', 'fiber', 'fibre', 'wool'],
  crochet: ['crochet', 'crocheters', 'yarn', 'fiber', 'fibre', 'wool']
};

// Calculate niche specificity based on name, title, and description
function calculateNicheSpecificity(name, title, description) {
  const cleanName = (name || '').replace(/^r\//i, '').trim();
  const cleanTitle = (title || '').trim();
  const primaryText = cleanTitle || cleanName;

  if (GENERIC_TERMS.includes(cleanName.toLowerCase())) {
    return 'Low';
  }

  const words = primaryText.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  if (wordCount <= 1) {
    return 'Low';
  }

  const hasNumbers = /\d/.test(primaryText);
  const hasAcronyms = /\b[A-Z]{2,}\b/.test(primaryText);
  const geographicTerms = /\b(australia|canada|uk|usa|europe|asia|india|germany|france|japan|korea|brazil|mexico|africa|london|sydney|tokyo|berlin|paris|new york|los angeles|california|texas|florida|seattle)\b/i;
  const hasGeographic = geographicTerms.test(primaryText) || geographicTerms.test(description || '');
  const hasBrandOrJargon = /\b(keychron|razer|logitech|nvidia|amd|intel|tesla|arduino|raspberry pi|obsidian|notion|figma|blender|unity|unreal|godot|supabase|firebase|vercel|nextjs|react|vue|angular|tailwind|docker|kubernetes|linux|macos|ios|android)\b/i.test(primaryText);

  if (wordCount >= 3 || hasNumbers || hasAcronyms || hasGeographic || hasBrandOrJargon) {
    return 'High';
  }

  return 'Medium';
}

// Helper to extract member counts from text snippets using regex
function parseMemberCount(text) {
  if (!text) return null;
  
  const regex = /(\d+[,.]?\d*\s*[kKmM]?)\s*(?:members|subscribers|users|participants|followers|people)/i;
  const match = text.match(regex);
  if (match) {
    let countStr = match[1].toLowerCase().replace(/,/g, '').trim();
    if (countStr.includes('k')) {
      return Math.round(parseFloat(countStr.replace('k', '')) * 1000);
    }
    if (countStr.includes('m')) {
      return Math.round(parseFloat(countStr.replace('m', '')) * 1000000);
    }
    const parsed = parseInt(countStr, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Clean and parse URL to identify platform
function identifyPlatform(url) {
  if (!url) return 'Unknown';
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('reddit.com')) return 'Reddit';
  if (urlLower.includes('discord.com/invite') || urlLower.includes('discord.gg') || urlLower.includes('disboard.org')) return 'Discord';
  if (urlLower.includes('facebook.com/groups')) return 'Facebook Group';
  if (urlLower.includes('skool.com')) return 'Skool';
  if (urlLower.includes('circle.so')) return 'Circle.so';
  if (urlLower.includes('mightynetworks.com') || urlLower.includes('.mn.co')) return 'Mighty Networks';
  if (urlLower.includes('threads.com') || urlLower.includes('threads.net') || urlLower.includes('thread.com')) return 'Threads';
  if (urlLower.includes('slack.com')) return 'Slack';
  
  return 'Web Forum';
}

// ============================================================
// 1. Reddit Subreddit Search
//    Uses official OAuth when configured, then falls back to
//    web discovery for subreddit landing pages.
// ============================================================
export async function searchReddit(query) {
  // --- Strategy 1: Reddit API, preferably through OAuth ---
  try {
    const response = await redditGet('/subreddits/search', {
      params: { q: query, limit: 50, sort: 'relevance' },
      timeout: 10000
    });

    if (response.data?.data?.children?.length > 0) {
      const subreddits = response.data.data.children
        .map(child => {
          const data = child.data;
          const name = data.display_name_prefixed || `r/${data.display_name}`;
          const title = data.title || '';
          const description = data.public_description || data.description || '';
          return {
            id: `reddit-${data.id}`,
            name,
            title,
            platform: 'Reddit',
            url: `https://www.reddit.com${data.url}`,
            description,
            memberCount: data.subscribers || 0,
            activeCount: data.active_user_count || 0,
            isNsfw: data.over18 || false,
            tags: [data.subreddit_type, data.advertiser_category].filter(Boolean),
            createdAt: new Date(data.created_utc * 1000).toISOString(),
            monetizationScore: data.advertiser_category ? 'Medium' : 'Low',
            nicheSpecificity: calculateNicheSpecificity(name, title, description)
          };
        })
        .filter(sub => sub.memberCount <= MAX_MEMBER_THRESHOLD);

      console.log(`  Reddit API returned ${subreddits.length} communities (after filtering)`);
      return subreddits;
    }
  } catch (error) {
    console.error('  Reddit API failed:', error.message, '- falling back to web search...');
  }

  // --- Strategy 2: Web fallback for Reddit ---
  try {
    console.log('  Searching Reddit via web fallback...');
    return await searchRedditViaWeb(query);
  } catch (err) {
    console.error('  Reddit web fallback also failed:', err.message);
    return [];
  }
}

async function searchRedditViaWeb(query) {
  const webQueries = [
    `${query} subreddit`,
    `${query} reddit community`,
    `${query} reddit`
  ];
  const webResults = [];

  for (const webQuery of webQueries) {
    try {
      const queryResults = await searchWeb(webQuery, {
        limit: 12,
        includeDomains: ['reddit.com'],
        preferredProviders: ['brave', 'firecrawl', 'yahoo']
      });
      console.log(`  Reddit web query "${webQuery}" returned ${queryResults.length} results`);
      webResults.push(...queryResults);
    } catch (error) {
      console.error(`  Reddit web query failed for "${webQuery}":`, error.message);
    }
  }

  const results = [];
  const seenSubs = new Set();

  webResults.forEach((item) => {
    const url = item.url;
    if (!url) return;

    const subredditMatch = url.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)/i);
    if (!subredditMatch) return;

    const subName = subredditMatch[1];
    const subKey = subName.toLowerCase();
    if (seenSubs.has(subKey)) return;
    seenSubs.add(subKey);

    const title = cleanText(item.title);
    const description = cleanText(item.description);
    const parsedMembers = parseMemberCount(description) || parseMemberCount(title);

    if (parsedMembers && parsedMembers > MAX_MEMBER_THRESHOLD) return;

    const name = `r/${subName}`;
    results.push({
      id: `web-reddit-${subKey}-${Date.now()}`,
      name,
      title: title || name,
      platform: 'Reddit',
      url: `https://www.reddit.com/r/${subName}/`,
      description: description || `Reddit community for ${query}.`,
      memberCount: parsedMembers || null,
      activeCount: null,
      isNsfw: false,
      tags: [],
      createdAt: new Date().toISOString(),
      monetizationScore: 'Low',
      nicheSpecificity: calculateNicheSpecificity(name, title, description)
    });
  });

  console.log(`  Reddit web fallback returned ${results.length} communities`);
  return results;
}

// ============================================================
// 2. Multi-platform search via unified web query + Circle Discovery
// ============================================================
export async function searchOtherPlatforms(query) {
  const results = [];

  const webPromise = (async () => {
    try {
      console.log(`  Querying unified web search for public platform pages: "${query}"...`);
      return await searchUnifiedPlatformWeb(query);
    } catch (err) {
      console.error('  Unified platform web search failed:', err.message);
      return [];
    }
  })();

  const circlePromise = (async () => {
    try {
      console.log(`  Querying Circle Discovery API for: "${query}"...`);
      return await searchViaCircleDiscovery(query);
    } catch (err) {
      console.error('  Circle Discover fallback failed:', err.message);
      return [];
    }
  })();

  const allResultsArray = await Promise.all([webPromise, circlePromise]);
  for (const subResults of allResultsArray) {
    results.push(...subResults);
  }

  // Deduplicate by normalized URL
  const seenUrls = new Set();
  const combined = [];
  for (const result of results) {
    const normalizedUrl = result.url.replace(/\/+$/, '').split('?')[0].split('#')[0].toLowerCase();
    if (!seenUrls.has(normalizedUrl)) {
      seenUrls.add(normalizedUrl);
      combined.push(result);
    }
  }

  console.log(`  Non-Reddit results: ${combined.length} from web discovery`);
  return combined;
}

async function searchUnifiedPlatformWeb(query) {
  const siteQuery = [
    'site:skool.com',
    'site:circle.so',
    'site:mightynetworks.com',
    'site:mn.co',
    'site:facebook.com/groups',
    'site:disboard.org',
    'site:discord.gg'
  ].join(' OR ');
  const webResults = await searchWeb(`(${siteQuery}) ${query}`, { limit: 30 });
  const results = [];

  webResults.forEach((item, index) => {
    const community = mapWebResultToCommunity(item, query, index);
    if (community) results.push(community);
  });

  return results;
}

function mapWebResultToCommunity(item, query, index) {
  const url = item.url;
  if (!url || !isLikelyCommunityPage(url)) return null;

  const title = cleanText(item.title);
  if (!title) return null;

  const description = cleanText(item.description);
  if (!matchesQueryIntent(query, title, description, url)) return null;

  const platform = identifyPlatform(url);
  if (platform === 'Unknown' || platform === 'Web Forum' || platform === 'Reddit') return null;

  const handleMatch = url.match(/\/@([^/?#]+)/i);
  const handle = handleMatch ? `@${handleMatch[1]}` : '';
  const cleanedName = title
    .replace(/\s*[-|]\s*Threads.*$/i, '')
    .replace(/\s*,\s*Say more\s*$/i, '')
    .trim();
  const isPost = /\/post\//i.test(url);
  const parsedMembers = parseMemberCount(description) || parseMemberCount(title);

  return {
    id: `web-${platform}-${index}-${Date.now()}`,
    name: cleanedName || handle || title,
    title,
    platform,
    url,
    description: description || `${platform} public ${isPost ? 'post' : 'profile'} for ${query}.`,
    memberCount: parsedMembers || null,
    activeCount: null,
    isNsfw: false,
    tags: [platform, isPost ? 'Post' : 'Profile'],
    createdAt: new Date().toISOString(),
    monetizationScore: 'Medium',
    nicheSpecificity: calculateNicheSpecificity(cleanedName || handle, title, description)
  };
}

function extractBalancedJson(text, key) {
  const keyIndex = text.indexOf(key);
  if (keyIndex === -1) return null;

  const start = text.indexOf('{', keyIndex + key.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function extractNextFlightText(html) {
  const chunks = [];
  const pushRegex = /self\.__next_f\.push\(\[(\d+),"((?:\\.|[^"\\])*)"\]\)/g;
  let match;

  while ((match = pushRegex.exec(html))) {
    try {
      chunks.push(JSON.parse(`"${match[2]}"`));
    } catch {
      // Ignore malformed chunks; the page usually has enough remaining data.
    }
  }

  return chunks.join('');
}

async function searchViaCircleDiscovery(query) {
  const searchUrl = `https://discover.circle.so/search?q=${encodeURIComponent(query)}`;
  const response = await axios.get(searchUrl, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 4000
  });

  const flightText = extractNextFlightText(response.data);
  const listingsJson = extractBalancedJson(flightText, '"initialListingsResults":');
  const creatorsJson = extractBalancedJson(flightText, '"initialCreatorsResults":');
  const results = [];

  if (listingsJson) {
    const listings = JSON.parse(listingsJson);
    results.push(...(listings.records || [])
      .filter(record => matchesQueryIntent(
        query,
        record.name,
        record.short_description,
        record.long_description,
        record.community_name,
        record.creator_bio
      ))
      .slice(0, 8)
      .map((record, index) => {
      const description = record.short_description || record.long_description || `${record.name} community on Circle.`;
      const tags = [
        record.category_name,
        ...(Array.isArray(record.tags) ? record.tags : [])
      ].filter(Boolean);

      return {
        id: `circle-discover-${record.id || index}-${Date.now()}`,
        name: record.name,
        title: record.community_name && record.community_name !== record.name
          ? `${record.name} - ${record.community_name}`
          : record.name,
        platform: 'Circle.so',
        url: `https://discover.circle.so/product/${record.slug}`,
        description,
        memberCount: null,
        activeCount: null,
        isNsfw: false,
        tags,
        createdAt: record.created_at || new Date().toISOString(),
        monetizationScore: record.price_in_cents > 0 || record.human_readable_price ? 'High' : 'Medium',
        nicheSpecificity: calculateNicheSpecificity(record.name, record.community_name || record.name, description)
      };
      }));
  }

  if (creatorsJson) {
    const creators = JSON.parse(creatorsJson);
    results.push(...(creators.records || [])
      .filter(record => matchesQueryIntent(query, record.name, record.headline, record.bio))
      .slice(0, 6)
      .map((record, index) => {
        const description = record.headline || record.bio || `${record.name} creator profile on Circle.`;
        return {
          id: `circle-creator-${record.id || index}-${Date.now()}`,
          name: record.name,
          title: record.headline ? `${record.name} - ${record.headline}` : record.name,
          platform: 'Circle.so',
          url: `https://discover.circle.so/creator/${record.slug}`,
          description,
          memberCount: null,
          activeCount: null,
          isNsfw: false,
          tags: ['Creator'],
          createdAt: new Date().toISOString(),
          monetizationScore: 'Medium',
          nicheSpecificity: calculateNicheSpecificity(record.name, record.headline || record.name, description)
        };
      }));
  }

  return results;
}

// normalizeMojeekUrl removed — Mojeek no longer used

function isLikelyCommunityPage(url) {
  const urlLower = url.toLowerCase();

  if (
    urlLower.includes('/blog') ||
    urlLower.includes('/help') ||
    urlLower.includes('/support') ||
    urlLower.includes('/pricing') ||
    urlLower.includes('/careers') ||
    urlLower.includes('/privacy') ||
    urlLower.includes('/terms') ||
    urlLower.includes('/login') ||
    urlLower.includes('/search')
  ) {
    return false;
  }

  if (urlLower.includes('threads.com/') || urlLower.includes('threads.net/') || urlLower.includes('thread.com/')) {
    return /\/@[^/?#]+/.test(urlLower);
  }

  if (urlLower.includes('facebook.com/groups')) return true;
  if (urlLower.includes('disboard.org/server/')) return true;
  if (urlLower.includes('discord.gg/') || urlLower.includes('discord.com/invite/')) return true;
  if (urlLower.includes('skool.com/')) return true;
  if (urlLower.includes('circle.so/')) return true;
  if (urlLower.includes('mightynetworks.com/')) return true;
  if (urlLower.includes('.mn.co/')) return true;

  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getQueryTokens(query) {
  return query
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(token => token.length >= 2) || [];
}

function stemToken(token) {
  if (token.length <= 3) return token;
  return token.replace(/(ing|ers|er|ies|s)$/i, '');
}

function matchesQueryIntent(query, ...values) {
  const tokens = getQueryTokens(query).flatMap(token => RELATED_QUERY_TERMS[token] || [token]);
  if (tokens.length === 0) return true;

  const searchableText = values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\btight[-\s]?knit(?:ted)?\b/g, '');

  return tokens.some(token => {
    const stem = stemToken(token);
    const pattern = stem.length <= 2
      ? new RegExp(`\\b${escapeRegExp(stem)}\\b`, 'i')
      : new RegExp(`\\b${escapeRegExp(stem)}[a-z0-9]*\\b`, 'i');

    return pattern.test(searchableText);
  });
}

// searchViaMojeek removed — Mojeek no longer used

async function unusedSearchViaDuckDuckGo() {
  return [];
/*
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${query} ${siteFilter}`)}`;
  const html = await fetchDuckDuckGoHtml(searchUrl);
  const $ = cheerio.load(html);
  const results = [];

  $('.web-result').each((index, element) => {
    const el = $(element);
    const linkEl = el.find('a.result__a[href]').first();
    const url = normalizeDuckDuckGoUrl(linkEl.attr('href'));
    if (!url || !isLikelyCommunityPage(url)) return;

    const title = linkEl.text().replace(/\s+/g, ' ').trim();
    if (!title) return;

    const description = el.find('.result__snippet').first().text().replace(/\s+/g, ' ').trim();
    if (!matchesQueryIntent(query, title, description, url)) return;

    const platform = defaultPlatform || identifyPlatform(url);
    if (platform === 'Unknown' || platform === 'Web Forum' || platform === 'Reddit') return;

    const handleMatch = url.match(/\/@([^/?#]+)/i);
    const handle = handleMatch ? `@${handleMatch[1]}` : '';
    const cleanedName = title
      .replace(/\s*[•|-]\s*Threads.*$/i, '')
      .replace(/\s*,\s*Say more\s*$/i, '')
      .trim();
    const isPost = /\/post\//i.test(url);
    const parsedMembers = parseMemberCount(description) || parseMemberCount(title);

    results.push({
      id: `duckduckgo-${platform}-${index}-${Date.now()}`,
      name: cleanedName || handle || title,
      title,
      platform,
      url,
      description: description || `${platform} public ${isPost ? 'post' : 'profile'} for ${query}.`,
      memberCount: parsedMembers || null,
      activeCount: null,
      isNsfw: false,
      tags: [platform, isPost ? 'Post' : 'Profile'],
      createdAt: new Date().toISOString(),
      monetizationScore: 'Medium',
      nicheSpecificity: calculateNicheSpecificity(cleanedName || handle, title, description)
    });
  });

  return results;
*/
}
