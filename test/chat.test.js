const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const TEST_DB = path.join(__dirname, 'test-chat.sqlite');
process.env.DB_PATH = TEST_DB;
process.env.SESSION_SECRET = 'test-secret';

// Force "no backend configured" regardless of a real .env on disk: dotenv
// does not override already-set env vars, so clearing these before
// server/index.js requires it keeps this test offline and deterministic.
for (const key of ['LOCAL_CODING_MODEL', 'LOCAL_GENERAL_MODEL', 'OPENROUTER_API_KEY', 'OPENROUTER_CODING_MODEL', 'OPENROUTER_GENERAL_MODEL']) {
  process.env[key] = '';
}

test('chat needs no login, auto-provisions a session, routes and logs', async () => {
  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  // no keys configured in this test process -> chat should 503 with a
  // generic message, no provider names leaked. No prior register/login:
  // requireAuth silently provisions an anonymous session on first request.
  const chatRes = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hi' }),
  });
  assert.strictEqual(chatRes.status, 503);
  const chatBody = await chatRes.json();
  assert.ok(!/anthropic|openai|gemini|mistral|cohere|huggingface|kimi|ollama|openrouter/i.test(JSON.stringify(chatBody)));

  const cookie = chatRes.headers.get('set-cookie');

  const whitespaceOnly = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt: '   ' }),
  });
  assert.strictEqual(whitespaceOnly.status, 400);

  const tooLong = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt: 'x'.repeat(4001) }),
  });
  assert.strictEqual(tooLong.status, 400);

  server.close();
  const { closeDb } = require('../server/db.js');
  closeDb();
  fs.rmSync(TEST_DB, { force: true, maxRetries: 5, retryDelay: 100 });
});
