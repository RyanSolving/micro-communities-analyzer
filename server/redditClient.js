import axios from 'axios';

export const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || 'NicheGlow/1.0 (micro-communities research tool)';

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
  const headers = { 'User-Agent': REDDIT_USER_AGENT };
  const baseUrl = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const requestPath = token || normalizedPath.endsWith('.json')
    ? normalizedPath
    : `${normalizedPath}.json`;
  const url = `${baseUrl}${requestPath}`;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return axios.get(url, {
    headers,
    params: { raw_json: 1, ...params },
    timeout
  });
}
