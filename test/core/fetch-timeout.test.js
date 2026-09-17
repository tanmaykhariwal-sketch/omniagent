const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { fetchWithTimeout } = require('../../server/core/fetch-timeout.js');

test('aborts a request that exceeds the timeout', async () => {
  const server = http.createServer((req, res) => {
    // never responds
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  await assert.rejects(
    () => fetchWithTimeout(`http://localhost:${port}/`, {}, 100),
    /abort/i
  );

  server.close();
});

test('resolves normally when the response is well within the timeout', async () => {
  const server = http.createServer((req, res) => {
    res.end('ok');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  const res = await fetchWithTimeout(`http://localhost:${port}/`, {}, 5000);
  assert.strictEqual(res.ok, true);

  server.close();
});
