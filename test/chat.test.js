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

test('history returns this session\'s past text-chat exchanges in order', async () => {
  const http = require('node:http');
  const TEST_DB_2 = path.join(__dirname, 'test-chat-history.sqlite');
  process.env.DB_PATH = TEST_DB_2;

  let replyCount = 0;
  const fakeOllama = http.createServer((req, res) => {
    replyCount += 1;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: { content: `reply ${replyCount}` } }));
  });
  await new Promise((resolve) => fakeOllama.listen(0, resolve));
  process.env.OLLAMA_BASE_URL = `http://localhost:${fakeOllama.address().port}`;
  process.env.LOCAL_GENERAL_MODEL = 'qwen2.5:7b';
  process.env.LOCAL_CODING_MODEL = '';

  const { createApp } = require('../server/index.js');
  const { closeDb } = require('../server/db.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const first = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'first prompt' }),
  });
  const cookie = first.headers.get('set-cookie');

  await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt: 'second prompt' }),
  });

  const historyRes = await fetch(`${base}/history`, { headers: { Cookie: cookie } });
  const { history } = await historyRes.json();
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0].prompt, 'first prompt');
  assert.strictEqual(history[1].prompt, 'second prompt');

  server.close();
  fakeOllama.close();
  closeDb();
  fs.rmSync(TEST_DB_2, { force: true, maxRetries: 5, retryDelay: 100 });
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.LOCAL_GENERAL_MODEL;
});

test('a known persona is folded into the system prompt; an unknown one is ignored', async () => {
  const http = require('node:http');
  const TEST_DB_3 = path.join(__dirname, 'test-chat-persona.sqlite');
  process.env.DB_PATH = TEST_DB_3;

  // /chat now makes two internal calls per request (the answer, then
  // follow-up suggestions) -- capture every system prompt seen, not just
  // the last, since the suggestions call's own prompt would otherwise
  // overwrite the persona-bearing one from the answer call.
  const systemContents = [];
  const fakeOllama = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      systemContents.push(JSON.parse(body).messages[0].content);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: { content: 'ok' } }));
    });
  });
  await new Promise((resolve) => fakeOllama.listen(0, resolve));
  process.env.OLLAMA_BASE_URL = `http://localhost:${fakeOllama.address().port}`;
  process.env.LOCAL_GENERAL_MODEL = 'qwen2.5:7b';
  process.env.LOCAL_CODING_MODEL = '';

  const { createApp } = require('../server/index.js');
  const { closeDb } = require('../server/db.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hi', persona: 'casual' }),
  });
  assert.ok(systemContents.some((c) => /casual, friendly tone/.test(c)));

  systemContents.length = 0;
  await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hi', persona: 'not-a-real-persona' }),
  });
  assert.ok(systemContents.every((c) => !c.includes('not-a-real-persona')));

  server.close();
  fakeOllama.close();
  closeDb();
  fs.rmSync(TEST_DB_3, { force: true, maxRetries: 5, retryDelay: 100 });
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.LOCAL_GENERAL_MODEL;
});
