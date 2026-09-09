const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

test('isConfigured is false without LOCAL_CODING_MODEL set', () => {
  delete process.env.LOCAL_CODING_MODEL;
  delete require.cache[require.resolve('../server/adapters/ollama.js')];
  const ollama = require('../server/adapters/ollama.js');
  assert.strictEqual(ollama.isConfigured(), false);
});

test('sends a chat request to the local Ollama server and returns its content', async () => {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      assert.strictEqual(parsed.model, 'qwen2.5-coder:7b');
      assert.strictEqual(parsed.messages[1].content, 'write a for loop in rust');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: { content: 'for i in 0..10 { }' } }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.OLLAMA_BASE_URL = `http://localhost:${port}`;
  process.env.LOCAL_CODING_MODEL = 'qwen2.5-coder:7b';
  delete require.cache[require.resolve('../server/adapters/ollama.js')];
  const ollama = require('../server/adapters/ollama.js');

  assert.strictEqual(ollama.isConfigured(), true);
  const text = await ollama.send('write a for loop in rust');
  assert.strictEqual(text, 'for i in 0..10 { }');

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
  process.env.LOCAL_CODING_MODEL = 'qwen2.5-coder:7b';
  delete require.cache[require.resolve('../server/adapters/ollama.js')];
  const ollama = require('../server/adapters/ollama.js');

  await assert.rejects(() => ollama.send('anything'), /ollama http 500/);

  server.close();
});
