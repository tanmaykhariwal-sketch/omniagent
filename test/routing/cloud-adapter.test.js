const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { createCloudAdapter } = require('../../server/routing/cloud-adapter.js');

test('isConfigured requires both OPENROUTER_API_KEY and the model env var', () => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.TEST_CLOUD_MODEL;
  const adapter = createCloudAdapter({ name: 'test-cloud', modelEnvVar: 'TEST_CLOUD_MODEL', systemPrompt: 'x' });
  assert.strictEqual(adapter.isConfigured(), false);

  process.env.OPENROUTER_API_KEY = 'sk-test';
  assert.strictEqual(adapter.isConfigured(), false);

  process.env.TEST_CLOUD_MODEL = 'some/model:free';
  assert.strictEqual(adapter.isConfigured(), true);
});

test('sends an OpenAI-style chat request to the configured base URL and returns the content', async () => {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      assert.strictEqual(parsed.model, 'some/model:free');
      assert.strictEqual(parsed.messages[0].content, 'be helpful');
      assert.strictEqual(parsed.messages[1].content, 'hello');
      assert.strictEqual(req.headers.authorization, 'Bearer sk-test');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: 'hi there' } }] }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.OPENROUTER_BASE_URL = `http://localhost:${port}`;
  process.env.OPENROUTER_API_KEY = 'sk-test';
  process.env.TEST_CLOUD_MODEL = 'some/model:free';
  const adapter = createCloudAdapter({ name: 'test-cloud', modelEnvVar: 'TEST_CLOUD_MODEL', systemPrompt: 'be helpful' });

  const text = await adapter.send('hello');
  assert.strictEqual(text, 'hi there');

  server.close();
});

test('throws with the adapter name in the message on a non-2xx response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 500;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.OPENROUTER_BASE_URL = `http://localhost:${port}`;
  process.env.OPENROUTER_API_KEY = 'sk-test';
  process.env.TEST_CLOUD_MODEL = 'some/model:free';
  const adapter = createCloudAdapter({ name: 'my-adapter', modelEnvVar: 'TEST_CLOUD_MODEL', systemPrompt: 'x' });

  await assert.rejects(() => adapter.send('anything'), /my-adapter http 500/);

  server.close();
});
