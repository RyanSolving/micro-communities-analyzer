import axios from 'axios';

export const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || 'NicheGlow/1.0 (micro-communities research tool)';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || '';
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || '';

let redditOAuthToken = null;
let redditOAuthExpiry = 0;

export function hasRedditOAuthCredentials() {
  return Boolean(REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET);
}

export async function getRedditOAuthToken() {
  if (redditOAuthToken && Date.now() < redditOAuthExpiry) {
    return redditOAuthToken;
  }

  if (!hasRedditOAuthCredentials()) {
    return null;
  }

  try {
    const response = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      {
        auth: { username: REDDIT_CLIENT_ID, password: REDDIT_CLIENT_SECRET },
        headers: {
          'User-Agent': REDDIT_USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 8000
      }
    );

    redditOAuthToken = response.data.access_token;
    redditOAuthExpiry = Date.now() + Math.max(0, response.data.expires_in - 60) * 1000;
    console.log('  Reddit OAuth token acquired successfully');
    return redditOAuthToken;
  } catch (error) {
    console.error('  Failed to get Reddit OAuth token:', error.message);
    return null;
  }
}

export async function redditGet(path, { params = {}, timeout = 15000 } = {}) {
  const token = await getRedditOAuthToken();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Strategy 1: OAuth via oauth.reddit.com (most reliable)
  if (token) {
    return axios.get(`https://oauth.reddit.com${normalizedPath}`, {
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
        'Authorization': `Bearer ${token}`
      },
      params: { raw_json: 1, ...params },
      timeout
    });
  }

  // Strategy 2: old.reddit.com (more lenient with unauthenticated .json requests)
  const jsonPath = normalizedPath.endsWith('.json') ? normalizedPath : `${normalizedPath}.json`;
  try {
    const response = await axios.get(`https://old.reddit.com${jsonPath}`, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'application/json, text/html;q=0.9, */*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      params: { raw_json: 1, ...params },
      timeout
    });
    return response;
  } catch (oldRedditError) {
    // Strategy 3: www.reddit.com with browser-like headers as last resort
    try {
      const response = await axios.get(`https://www.reddit.com${jsonPath}`, {
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        params: { raw_json: 1, ...params },
        timeout
      });
      return response;
    } catch (wwwError) {
      // Throw the original old.reddit.com error with context
      throw new Error(`Reddit request failed (old: ${oldRedditError.message}, www: ${wwwError.message})`);
    }
  }
}
