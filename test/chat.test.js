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
for (const key of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'COHERE_API_KEY', 'KIMI_API_KEY', 'HF_API_KEY', 'LOCAL_CODING_MODEL', 'LOCAL_GENERAL_MODEL']) {
  process.env[key] = '';
}

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
  assert.ok(!/anthropic|openai|gemini|mistral|cohere|huggingface|kimi|ollama/i.test(JSON.stringify(chatBody)));

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
