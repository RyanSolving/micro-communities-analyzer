import axios from 'axios';
import * as cheerio from 'cheerio';

// Reddit's JSON API blocks browser-spoofing UAs (403). Use a descriptive bot UA.
const USER_AGENT = 'NicheGlow/1.0 (micro-communities research tool)';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
  'Skool': 'site:skool.com',
  'Circle.so': 'site:circle.so',
  'Mighty Networks': 'site:mn.co',
  'Facebook Group': 'site:facebook.com/groups',
  'Discord': 'site:disboard.org',
  'Threads': 'site:threads.com'
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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

function normalizeSearchUrl(rawUrl) {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl, 'https://www.mojeek.com');
    if (parsed.hostname.includes('mojeek.com')) {
      return parsed.searchParams.get('u') || parsed.searchParams.get('url') || null;
    }
    return parsed.href;
  } catch {
    return null;
  }
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
  const sourceNote = 'Public posts were not accessible or indexed, so this signal is inferred from the community metadata and platform context.';

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
async function fetchRedditPosts(subreddit, sort, limit = 30) {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&raw_json=1`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 15000
    });
    if (!response.data?.data?.children) return [];
    return response.data.data.children;
  } catch (error) {
    console.error(`  Error fetching /${sort} for r/${subreddit}:`, error.message);
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
      fetchRedditPosts(cleanSubreddit, 'hot', 30),
      fetchRedditPosts(cleanSubreddit, 'new', 30),
      fetchRedditPosts(cleanSubreddit, 'top?t=week', 25)
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

async function searchMojeekForNeeds(searchQuery, community, queryKeywords, sourceLabel = community.platform) {
  const searchUrl = `https://www.mojeek.com/search?q=${encodeURIComponent(searchQuery)}`;
  const response = await axios.get(searchUrl, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    timeout: 12000
  });

  const $ = cheerio.load(response.data);
  const results = [];

  $('.results li').each((index, element) => {
    const el = $(element);
    let linkEl = el.find('h2 a.title[href], h3 a.title[href], a.title[href]').first();
    if (!linkEl.length) {
      linkEl = el.find('h2 a[href], h3 a[href], a[href]').first();
    }

    const url = normalizeSearchUrl(linkEl.attr('href'));
    const title = linkEl.text().trim();
    if (!url || !title) return;

    let snippet = el.find('p.s').first().text().trim();
    if (!snippet) snippet = el.find('.desc').first().text().trim();
    if (!snippet) snippet = el.find('p:not(.i)').first().text().trim();

    if (!isRelevantToCommunity(queryKeywords, title, snippet, url)) return;

    const fullText = `${title}\n\n${snippet}`;
    const { matchedCategories, score } = classifyText(fullText);
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
      fullContent: snippet || 'Public search result matched a need signal.',
      rawContent: fullText,
      relevanceScore: score
    });
  });

  return results;
}

export async function analyzeCommunityNeeds(community) {
  if (!community?.platform) return [];

  if (community.platform === 'Reddit') {
    const subredditFromUrl = community.url?.match(/reddit\.com\/r\/([^/]+)/i)?.[1];
    const subredditName = subredditFromUrl || community.name?.replace(/^r\//i, '');
    return analyzeSubredditNeeds(subredditName);
  }

  try {
    const siteFilter = getSiteFilter(community);
    const queryKeywords = getCommunityQuery(community);
    if (!siteFilter || !queryKeywords) return [];

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
        const queryResults = await searchMojeekForNeeds(needQueries[i], community, queryKeywords, community.platform);
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

    if (deduped.length === 0) {
      const broaderQueries = [
        `${queryKeywords} forum problem issue help`,
        `${queryKeywords} recommend best tool`,
        `${queryKeywords} worth price cost`
      ];

      for (let i = 0; i < broaderQueries.length; i++) {
        await delay(500);
        try {
          const broaderResults = await searchMojeekForNeeds(
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

    console.log(`  Found ${deduped.length} public need signals for ${community.name}`);
    return deduped.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (error) {
    console.error(`Error analyzing public community signals for ${community.name}:`, error.message);
    return [];
  }
}
