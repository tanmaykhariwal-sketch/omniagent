const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const TEST_DB = path.join(__dirname, 'test-media.sqlite');
process.env.DB_PATH = TEST_DB;
process.env.SESSION_SECRET = 'test-secret';

async function loginCookie(base) {
  await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'media@example.com', password: 'hunter22' }),
  });
  const login = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'media@example.com', password: 'hunter22' }),
  });
  return login.headers.get('set-cookie');
}

test('media routes require auth', async () => {
  delete process.env.HF_API_KEY;
  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const image = await fetch(`${base}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'a cat' }),
  });
  assert.strictEqual(image.status, 401);

  const transcribe = await fetch(`${base}/transcribe`, { method: 'POST' });
  assert.strictEqual(transcribe.status, 401);

  server.close();
});

test('generate-image validates input and returns 503 without HF_API_KEY', async () => {
  delete process.env.HF_API_KEY;
  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const cookie = await loginCookie(base);

  const empty = await fetch(`${base}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt: '   ' }),
  });
  assert.strictEqual(empty.status, 400);

  const tooLong = await fetch(`${base}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt: 'x'.repeat(1001) }),
  });
  assert.strictEqual(tooLong.status, 400);

  const unconfigured = await fetch(`${base}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt: 'a cat wearing a hat' }),
  });
  assert.strictEqual(unconfigured.status, 503);

  server.close();
});

test('generate-image returns a data URL on success', async () => {
  const hfServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'image/png');
    res.end(Buffer.from('fake-png'));
  });
  await new Promise((resolve) => hfServer.listen(0, resolve));
  process.env.HF_API_KEY = 'hf-test';
  process.env.HF_INFERENCE_BASE_URL = `http://localhost:${hfServer.address().port}`;

  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const cookie = await loginCookie(base);

  const res = await fetch(`${base}/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt: 'a cat wearing a hat' }),
  });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.ok(body.image.startsWith('data:image/png;base64,'));

  server.close();
  hfServer.close();
});

test('transcribe requires a file and returns text on success', async () => {
  const hfServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ text: 'transcribed text' }));
  });
  await new Promise((resolve) => hfServer.listen(0, resolve));
  process.env.HF_API_KEY = 'hf-test';
  process.env.HF_INFERENCE_BASE_URL = `http://localhost:${hfServer.address().port}`;

  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;
  const cookie = await loginCookie(base);

  const noFile = await fetch(`${base}/transcribe`, { method: 'POST', headers: { Cookie: cookie } });
  assert.strictEqual(noFile.status, 400);

  const form = new FormData();
  form.append('audio', new Blob([Buffer.from('fake-audio-bytes')], { type: 'audio/wav' }), 'clip.wav');
  const res = await fetch(`${base}/transcribe`, { method: 'POST', headers: { Cookie: cookie }, body: form });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.text, 'transcribed text');

  server.close();
  hfServer.close();
  const { closeDb } = require('../server/db.js');
  closeDb();
  fs.rmSync(TEST_DB, { force: true, maxRetries: 5, retryDelay: 100 });
});
