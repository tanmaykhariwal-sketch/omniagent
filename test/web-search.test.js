const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const webSearch = require('../server/adapters/web-search.js');

const SAMPLE_HTML = `<html><body>
<div class="result results_links results_links_deep web-result">
  <div class="links_main links_deep result__body">
    <h2 class="result__title">
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Ffirst&rut=abc">First &amp; <b>result</b></a>
    </h2>
    <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Ffirst&rut=abc">A snippet about <b>testing</b>.</a>
  </div>
</div>
<div class="result results_links results_links_deep web-result">
  <div class="links_main links_deep result__body">
    <h2 class="result__title">
      <a rel="nofollow" class="result__a" href="https://plain-link.example.com/second">Second result</a>
    </h2>
    <a class="result__snippet" href="https://plain-link.example.com/second">Another snippet.</a>
  </div>
</div>
</body></html>`;

test('isConfigured is always true (no API key needed)', () => {
  assert.strictEqual(webSearch.isConfigured(), true);
});

test('search parses title, snippet, and decodes the redirect link', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(SAMPLE_HTML);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.WEB_SEARCH_BASE_URL = `http://localhost:${server.address().port}`;

  const results = await webSearch.search('testing');
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].title, 'First & result');
  assert.strictEqual(results[0].snippet, 'A snippet about testing.');
  assert.strictEqual(results[0].link, 'https://example.com/first');
  assert.strictEqual(results[1].title, 'Second result');
  assert.strictEqual(results[1].link, 'https://plain-link.example.com/second');

  server.close();
});

test('returns an empty array when there are no results', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<html><body>no results here</body></html>');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.WEB_SEARCH_BASE_URL = `http://localhost:${server.address().port}`;

  const results = await webSearch.search('nothing');
  assert.deepStrictEqual(results, []);

  server.close();
});

test('throws with the adapter name on a non-2xx response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 500;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.WEB_SEARCH_BASE_URL = `http://localhost:${server.address().port}`;

  await assert.rejects(() => webSearch.search('anything'), /web-search http 500/);

  server.close();
});
