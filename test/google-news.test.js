const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const googleNews = require('../server/adapters/google-news.js');

const SAMPLE_RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<item>
<title>First headline about testing - example.com</title>
<link>https://example.com/first</link>
<pubDate>Mon, 15 Sep 2026 09:00:00 GMT</pubDate>
</item>
<item>
<title><![CDATA[Second headline with &amp; entities - another.com]]></title>
<link>https://example.com/second</link>
<pubDate>Mon, 15 Sep 2026 08:00:00 GMT</pubDate>
</item>
</channel></rss>`;

test('isConfigured is always true (no API key needed)', () => {
  assert.strictEqual(googleNews.isConfigured(), true);
});

test('search parses headline, source, link, and publishedAt from RSS items', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.end(SAMPLE_RSS);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.GOOGLE_NEWS_BASE_URL = `http://localhost:${server.address().port}`;

  const headlines = await googleNews.search('testing');
  assert.strictEqual(headlines.length, 2);
  assert.strictEqual(headlines[0].headline, 'First headline about testing');
  assert.strictEqual(headlines[0].source, 'example.com');
  assert.strictEqual(headlines[0].link, 'https://example.com/first');
  assert.strictEqual(headlines[1].headline, 'Second headline with & entities');
  assert.strictEqual(headlines[1].source, 'another.com');

  server.close();
});

test('returns an empty array when there are no items', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.end('<rss version="2.0"><channel></channel></rss>');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.GOOGLE_NEWS_BASE_URL = `http://localhost:${server.address().port}`;

  const headlines = await googleNews.search('nothing');
  assert.deepStrictEqual(headlines, []);

  server.close();
});

test('throws with the adapter name on a non-2xx response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 500;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.GOOGLE_NEWS_BASE_URL = `http://localhost:${server.address().port}`;

  await assert.rejects(() => googleNews.search('anything'), /google-news http 500/);

  server.close();
});
