const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../server/index.js');

test('GET /health returns OmniAgent identity only', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/health`);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.identity, 'OmniAgent');
  server.close();
});
