const { fetchWithTimeout } = require('../fetch-timeout');

const NAME = 'web-search';
const DEFAULT_BASE_URL = 'https://html.duckduckgo.com/html/';
const TIMEOUT_MS = 15000;
const MAX_RESULTS = 6;

function stripTags(str) {
  return str.replace(/<[^>]+>/g, '');
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function resolveLink(href) {
  // DuckDuckGo's HTML endpoint wraps result links in a redirect:
  // "//duckduckgo.com/l/?uddg=<url-encoded-real-url>&rut=...". Decode the
  // real target instead of surfacing the redirect URL to the client.
  const match = href.match(/[?&]uddg=([^&]+)/);
  if (!match) return href.startsWith('//') ? `https:${href}` : href;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return href;
  }
}

function parseResults(html) {
  const results = [];
  const pattern = /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = pattern.exec(html)) && results.length < MAX_RESULTS) {
    const [, href, rawTitle, rawSnippet] = match;
    const title = decodeEntities(stripTags(rawTitle)).trim();
    const snippet = decodeEntities(stripTags(rawSnippet)).trim();
    if (!title) continue;
    results.push({ title, snippet, link: resolveLink(href) });
  }
  return results;
}

module.exports = {
  name: NAME,
  isConfigured: () => true, // no API key needed
  async search(query) {
    const baseUrl = process.env.WEB_SEARCH_BASE_URL || DEFAULT_BASE_URL;
    const url = `${baseUrl}?q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OmniAgentBot/1.0)' } },
      TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`${NAME} http ${res.status}`);
    const html = await res.text();
    return parseResults(html);
  },
};
