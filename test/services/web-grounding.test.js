const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { getWebGroundingContext } = require('../../server/services/web-grounding.js');

const SAMPLE_HTML = `<html><body>
<div class="result results_links results_links_deep web-result">
  <div class="links_main links_deep result__body">
    <h2 class="result__title">
      <a rel="nofollow" class="result__a" href="https://example.com/a">Result A</a>
    </h2>
    <a class="result__snippet" href="https://example.com/a">Snippet A.</a>
  </div>
</div>
</body></html>`;

test('builds a context string and returns sources when results exist', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(SAMPLE_HTML);
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.WEB_SEARCH_BASE_URL = `http://localhost:${server.address().port}`;

  const grounding = await getWebGroundingContext('anything');
  assert.ok(grounding.context.includes('Result A'));
  assert.ok(grounding.context.includes('Snippet A.'));
  assert.deepStrictEqual(grounding.sources, [{ title: 'Result A', snippet: 'Snippet A.', link: 'https://example.com/a' }]);

  server.close();
});

test('returns null when the search has no results', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<html><body>nothing here</body></html>');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.WEB_SEARCH_BASE_URL = `http://localhost:${server.address().port}`;

  const grounding = await getWebGroundingContext('nothing');
  assert.strictEqual(grounding, null);

  server.close();
});

test('never throws when the search fails', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 500;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.WEB_SEARCH_BASE_URL = `http://localhost:${server.address().port}`;

  const grounding = await getWebGroundingContext('anything');
  assert.strictEqual(grounding, null);

  server.close();
});
