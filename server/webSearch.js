import axios from 'axios';
import * as cheerio from 'cheerio';

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY || '';

const searchCache = new Map();

export function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export async function searchWeb(query, { limit = 20, scrape = false } = {}) {
  const provider = FIRECRAWL_API_KEY ? 'firecrawl' : BRAVE_SEARCH_API_KEY ? 'brave' : 'yahoo';
  console.log(`  Web search provider: ${provider} (${limit} results)`);
  const cacheKey = `${provider}:${query}:${limit}:${scrape ? 'scrape' : 'serp'}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) {
    return cached.results;
  }

  const results = provider === 'firecrawl'
    ? await searchViaFirecrawl(query, { limit, scrape })
    : provider === 'brave'
      ? await searchViaBrave(query, limit)
      : await searchViaYahoo(query, limit);

  searchCache.set(cacheKey, { createdAt: Date.now(), results });
  return results;
}

async function searchViaFirecrawl(query, { limit, scrape }) {
  const response = await axios.post(
    'https://api.firecrawl.dev/v2/search',
    {
      query,
      limit: Math.min(limit, 30),
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

  const data = Array.isArray(response.data?.data) ? response.data.data : [];
  return data.map((item) => ({
    title: cleanText(item.title),
    url: item.url,
    description: cleanText(item.description),
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
