const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const TEST_DB = path.join(__dirname, 'test-chat.sqlite');
process.env.DB_PATH = TEST_DB;
process.env.SESSION_SECRET = 'test-secret';

test('chat requires auth, then routes and logs', async () => {
  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const unauth = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hi' }),
  });
  assert.strictEqual(unauth.status, 401);

  await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'b@example.com', password: 'hunter22' }),
  });
  const login = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'b@example.com', password: 'hunter22' }),
  });
  const cookie = login.headers.get('set-cookie');

  // no keys configured in this test process -> chat should 503 with a
  // generic message, no provider names leaked
  const chatRes = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt: 'hi' }),
  });
  assert.strictEqual(chatRes.status, 503);
  const chatBody = await chatRes.json();
  assert.ok(!/anthropic|openai|gemini|mistral|cohere|huggingface|kimi/i.test(JSON.stringify(chatBody)));

  server.close();
  const { closeDb } = require('../server/db.js');
  closeDb();
  fs.rmSync(TEST_DB, { force: true });
});
