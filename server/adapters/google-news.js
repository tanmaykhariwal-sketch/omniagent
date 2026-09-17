const { fetchWithTimeout } = require('../core/fetch-timeout');

const NAME = 'google-news';
const DEFAULT_BASE_URL = 'https://news.google.com/rss/search';
const TIMEOUT_MS = 15000;
const MAX_HEADLINES = 8;

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseItems(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of itemBlocks) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    if (!title || !link) continue;

    const decodedTitle = decodeEntities(title.replace(/^<!\[CDATA\[|\]\]>$/g, ''));
    // Google News titles are formatted "Headline - source.com"
    const lastDash = decodedTitle.lastIndexOf(' - ');
    const headline = lastDash === -1 ? decodedTitle : decodedTitle.slice(0, lastDash);
    const source = lastDash === -1 ? null : decodedTitle.slice(lastDash + 3);

    items.push({
      headline,
      source,
      link: decodeEntities(link.trim()),
      publishedAt: pubDate || null,
    });
    if (items.length >= MAX_HEADLINES) break;
  }
  return items;
}

module.exports = {
  name: NAME,
  isConfigured: () => true, // no API key needed
  async search(query) {
    const baseUrl = process.env.GOOGLE_NEWS_BASE_URL || DEFAULT_BASE_URL;
    const url = `${baseUrl}?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetchWithTimeout(url, {}, TIMEOUT_MS);
    if (!res.ok) throw new Error(`${NAME} http ${res.status}`);
    const xml = await res.text();
    return parseItems(xml);
  },
};
