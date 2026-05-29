import axios from 'axios';
import * as cheerio from 'cheerio';

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';

const searchCache = new Map();

export function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export async function searchWeb(query, {
  limit = 20,
  scrape = false,
  includeDomains = [],
  preferredProviders = []
} = {}) {
  const providers = getProviderOrder(preferredProviders);
  const domainKey = includeDomains.join(',');
  const cacheKey = `${providers.join('+')}:${query}:${limit}:${scrape ? 'scrape' : 'serp'}:${domainKey}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) {
    return cached.results;
  }

  let results = [];
  for (const provider of providers) {
    try {
      console.log(`  Web search provider: ${provider} (${limit} results)`);
      const providerQuery = provider === 'firecrawl'
        ? query
        : withSiteFilters(query, includeDomains);

      results = provider === 'firecrawl'
        ? await searchViaFirecrawl(providerQuery, { limit, scrape, includeDomains })
        : provider === 'brave'
          ? await searchViaBrave(providerQuery, limit)
          : await searchViaYahoo(providerQuery, limit);

      if (results.length > 0) break;
      console.log(`  ${provider} returned 0 results; trying next provider...`);
    } catch (error) {
      console.error(`  ${provider} search failed:`, error.message);
    }
  }

  searchCache.set(cacheKey, { createdAt: Date.now(), results });
  return results;
}

function getProviderOrder(preferredProviders) {
  const available = {
    firecrawl: Boolean(FIRECRAWL_API_KEY),
    brave: Boolean(BRAVE_SEARCH_API_KEY),
    yahoo: true
  };
  const defaults = [
    ...(FIRECRAWL_API_KEY ? ['firecrawl'] : []),
    ...(BRAVE_SEARCH_API_KEY ? ['brave'] : []),
    'yahoo'
  ];

  return [...preferredProviders, ...defaults]
    .filter(provider => available[provider])
    .filter((provider, index, providers) => providers.indexOf(provider) === index);
}

function withSiteFilters(query, includeDomains) {
  if (!includeDomains.length) return query;

  const siteQuery = includeDomains.map(domain => `site:${domain}`).join(' OR ');
  return `(${siteQuery}) ${query}`;
}

async function searchViaFirecrawl(query, { limit, scrape, includeDomains }) {
  const response = await axios.post(
    'https://api.firecrawl.dev/v2/search',
    {
      query,
      limit: Math.min(limit, 30),
      sources: ['web'],
      ...(includeDomains.length ? { includeDomains } : {}),
      ...(scrape ? { scrapeOptions: { formats: [{ type: 'markdown' }] } } : {})
    },
    {
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: scrape ? 30000 : 15000
    }
  );

  const data = Array.isArray(response.data?.data?.web)
    ? response.data.data.web
    : Array.isArray(response.data?.data)
      ? response.data.data
      : [];

  if (response.data?.success === false) {
    throw new Error(response.data?.error || 'Firecrawl search failed');
  }

  return data.map((item) => ({
    title: cleanText(item.title || item.metadata?.title),
    url: item.url || item.metadata?.sourceURL || item.metadata?.url,
    description: cleanText(item.description || item.snippet || item.metadata?.description),
    markdown: cleanText(item.markdown)
  }));
}

async function searchViaBrave(query, limit) {
  const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': BRAVE_SEARCH_API_KEY
    },
    params: {
      q: query,
      count: Math.min(limit, 20),
      country: 'us',
      search_lang: 'en'
    },
    timeout: 12000
  });

  return (response.data?.web?.results || []).map((item) => ({
    title: cleanText(item.title),
    url: item.url,
    description: cleanText(item.description || item.extra_snippets?.join(' '))
  }));
}

async function searchViaYahoo(query, limit) {
  const response = await axios.get('https://search.yahoo.com/search', {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    params: { p: query, n: Math.min(limit, 30) },
    timeout: 15000
  });

  const $ = cheerio.load(response.data);
  const results = [];

  $('.algo, div[class*=" algo"], div[class^="algo"]').each((index, element) => {
    if (results.length >= limit) return false;

    const el = $(element);
    const linkEl = el.find('h3 a[href], a[href]').first();
    const title = cleanText(linkEl.text());
    const url = normalizeYahooUrl(linkEl.attr('href'));
    if (!title || !url) return;

    const description = cleanText(
      el.find('.compText, .fc-falcon, .lh-16, p').first().text()
    );

    results.push({ title, url, description });
  });

  return results;
}

function normalizeYahooUrl(rawUrl) {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl, 'https://search.yahoo.com');
    if (parsed.hostname.includes('r.search.yahoo.com')) {
      const match = parsed.pathname.match(/\/RU=([^/]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
