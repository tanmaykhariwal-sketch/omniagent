const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const TEST_DB = path.join(__dirname, 'test-memory.sqlite');
process.env.DB_PATH = TEST_DB;
delete process.env.OPENROUTER_API_KEY;

const { getDb, closeDb } = require('../server/db.js');
const { getMemoryContext, extractAndSaveMemory } = require('../server/memory.js');

test('getMemoryContext returns null with nothing stored, then a formatted block after saving', async () => {
  getDb(); // ensure the memories table exists

  assert.strictEqual(getMemoryContext(1), null);

  let nextReply = 'Prefers concise, direct answers.';
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: { content: nextReply } }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  process.env.OLLAMA_BASE_URL = `http://localhost:${port}`;
  process.env.LOCAL_GENERAL_MODEL = 'qwen2.5:7b';

  await extractAndSaveMemory(1, 'I mostly write Python', 'Got it.');
  const context = getMemoryContext(1);
  assert.ok(context.includes('Prefers concise, direct answers.'));

  nextReply = 'NONE';
  await extractAndSaveMemory(1, 'what time is it', 'I do not have real-time access.');
  const contextAfterNone = getMemoryContext(1);
  assert.strictEqual((contextAfterNone.match(/^- /gm) || []).length, 1);

  server.close();
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.LOCAL_GENERAL_MODEL;
});

test('extractAndSaveMemory never throws when no memory adapter is configured', async () => {
  delete process.env.LOCAL_GENERAL_MODEL;
  delete process.env.OPENROUTER_API_KEY;
  await assert.doesNotReject(() => extractAndSaveMemory(2, 'hi', 'hello'));
  assert.strictEqual(getMemoryContext(2), null);
});

test.after(() => {
  closeDb();
  fs.rmSync(TEST_DB, { force: true, maxRetries: 5, retryDelay: 100 });
});
