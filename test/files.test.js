const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const TEST_DB = path.join(__dirname, 'test-files.sqlite');
process.env.DB_PATH = TEST_DB;
process.env.SESSION_SECRET = 'test-secret';

test('analyze-file requires a file, rejects unsupported types, needs no login', async () => {
  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const noFile = await fetch(`${base}/analyze-file`, { method: 'POST' });
  assert.strictEqual(noFile.status, 400);
  assert.ok(noFile.headers.get('set-cookie'));

  const form = new FormData();
  form.append('file', new Blob([Buffer.from('irrelevant')], { type: 'application/zip' }), 'archive.zip');
  const unsupported = await fetch(`${base}/analyze-file`, { method: 'POST', body: form });
  assert.strictEqual(unsupported.status, 400);
  const body = await unsupported.json();
  assert.match(body.error, /unsupported file type/);

  server.close();
});

test('analyze-file extracts a CSV and routes it through the model, logging to history', async () => {
  const fakeOllama = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: { content: 'This spreadsheet lists two people and their ages.' } }));
  });
  await new Promise((resolve) => fakeOllama.listen(0, resolve));
  process.env.OLLAMA_BASE_URL = `http://localhost:${fakeOllama.address().port}`;
  process.env.LOCAL_GENERAL_MODEL = 'qwen2.5:7b';
  process.env.LOCAL_CODING_MODEL = '';
  delete process.env.OPENROUTER_API_KEY;

  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const form = new FormData();
  form.append('file', new Blob([Buffer.from('name,age\nAda,36\nGrace,85\n')], { type: 'text/csv' }), 'people.csv');
  form.append('question', 'How many people are in this file?');
  const res = await fetch(`${base}/analyze-file`, { method: 'POST', body: form });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.response, 'This spreadsheet lists two people and their ages.');
  const cookie = res.headers.get('set-cookie');

  const historyRes = await fetch(`${base}/history`, { headers: { Cookie: cookie } });
  const { history } = await historyRes.json();
  assert.strictEqual(history.length, 1);
  assert.match(history[0].prompt, /people\.csv/);

  server.close();
  fakeOllama.close();
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.LOCAL_GENERAL_MODEL;
  const { closeDb } = require('../server/db.js');
  closeDb();
  fs.rmSync(TEST_DB, { force: true, maxRetries: 5, retryDelay: 100 });
});
