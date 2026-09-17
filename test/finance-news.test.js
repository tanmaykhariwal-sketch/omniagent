const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const TEST_DB = path.join(__dirname, 'test-finance-news.sqlite');
process.env.DB_PATH = TEST_DB;
process.env.SESSION_SECRET = 'test-secret';

async function loginCookie(base) {
  await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'finnews@example.com', password: 'hunter22' }),
  });
  const login = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'finnews@example.com', password: 'hunter22' }),
  });
  return login.headers.get('set-cookie');
}

test('finance and news routes need no login, auto-provisioning a session', async () => {
  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const finance = await fetch(`${base}/finance?symbol=AAPL`);
  assert.notStrictEqual(finance.status, 401);
  assert.ok(finance.headers.get('set-cookie'));

  const news = await fetch(`${base}/news?q=test`);
  assert.notStrictEqual(news.status, 401);

  server.close();
});

test('finance validates the symbol and returns a quote on success', async () => {
  const yahooServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      chart: { result: [{ meta: { symbol: 'AAPL', longName: 'Apple Inc.', regularMarketPrice: 110, previousClose: 100, currency: 'USD' } }] },
    }));
  });
  await new Promise((resolve) => yahooServer.listen(0, resolve));
  process.env.YAHOO_FINANCE_BASE_URL = `http://localhost:${yahooServer.address().port}`;

  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const cookie = await loginCookie(base);

  const missing = await fetch(`${base}/finance`, { headers: { Cookie: cookie } });
  assert.strictEqual(missing.status, 400);

  const invalid = await fetch(`${base}/finance?symbol=${encodeURIComponent('bad symbol!')}`, { headers: { Cookie: cookie } });
  assert.strictEqual(invalid.status, 400);

  const ok = await fetch(`${base}/finance?symbol=aapl`, { headers: { Cookie: cookie } });
  assert.strictEqual(ok.status, 200);
  const body = await ok.json();
  assert.strictEqual(body.quote.symbol, 'AAPL');
  assert.strictEqual(body.quote.price, 110);

  server.close();
  yahooServer.close();
});

test('news validates the query and returns headlines on success', async () => {
  const newsServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    res.end('<rss version="2.0"><channel><item><title>A headline - example.com</title><link>https://example.com/a</link><pubDate>Mon, 15 Sep 2026 09:00:00 GMT</pubDate></item></channel></rss>');
  });
  await new Promise((resolve) => newsServer.listen(0, resolve));
  process.env.GOOGLE_NEWS_BASE_URL = `http://localhost:${newsServer.address().port}`;

  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const cookie = await loginCookie(base);

  const missing = await fetch(`${base}/news`, { headers: { Cookie: cookie } });
  assert.strictEqual(missing.status, 400);

  const ok = await fetch(`${base}/news?q=testing`, { headers: { Cookie: cookie } });
  assert.strictEqual(ok.status, 200);
  const body = await ok.json();
  assert.strictEqual(body.headlines.length, 1);
  assert.strictEqual(body.headlines[0].headline, 'A headline');

  server.close();
  newsServer.close();
  const { closeDb } = require('../server/db.js');
  closeDb();
  fs.rmSync(TEST_DB, { force: true, maxRetries: 5, retryDelay: 100 });
});
