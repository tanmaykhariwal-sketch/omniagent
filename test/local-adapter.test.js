const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createLocalAdapter } = require('../server/local-adapter.js');

test('isConfigured is false without the model env var set', () => {
  delete process.env.TEST_LOCAL_MODEL;
  const adapter = createLocalAdapter({ name: 'test-local', modelEnvVar: 'TEST_LOCAL_MODEL', systemPrompt: 'x' });
  assert.strictEqual(adapter.isConfigured(), false);
});

test('sends a chat request to the local server and returns its content', async () => {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      assert.strictEqual(parsed.model, 'qwen2.5:7b');
      assert.strictEqual(parsed.messages[0].content, 'x');
      assert.strictEqual(parsed.messages[1].content, 'hello');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: { content: 'hi there' } }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.OLLAMA_BASE_URL = `http://localhost:${port}`;
  process.env.TEST_LOCAL_MODEL = 'qwen2.5:7b';
  const adapter = createLocalAdapter({ name: 'test-local', modelEnvVar: 'TEST_LOCAL_MODEL', systemPrompt: 'x' });

  assert.strictEqual(adapter.isConfigured(), true);
  const text = await adapter.send('hello');
  assert.strictEqual(text, 'hi there');

  server.close();
});

test('throws when the local server responds with an error status', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 500;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.OLLAMA_BASE_URL = `http://localhost:${port}`;
  process.env.TEST_LOCAL_MODEL = 'qwen2.5:7b';
  const adapter = createLocalAdapter({ name: 'test-local', modelEnvVar: 'TEST_LOCAL_MODEL', systemPrompt: 'x' });

  await assert.rejects(() => adapter.send('anything'), /test-local http 500/);

  server.close();
});
