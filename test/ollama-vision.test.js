const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const ollamaVision = require('../server/adapters/ollama-vision.js');

test('isConfigured reflects LOCAL_VISION_MODEL', () => {
  delete process.env.LOCAL_VISION_MODEL;
  assert.strictEqual(ollamaVision.isConfigured(), false);
  process.env.LOCAL_VISION_MODEL = 'llava';
  assert.strictEqual(ollamaVision.isConfigured(), true);
  delete process.env.LOCAL_VISION_MODEL;
});

test('caption sends the image as base64 in the images array and returns the model text', async () => {
  let receivedBody;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      receivedBody = JSON.parse(raw);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: { content: 'A red bicycle.' } }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.OLLAMA_BASE_URL = `http://localhost:${server.address().port}`;
  process.env.LOCAL_VISION_MODEL = 'llava';

  const buffer = Buffer.from('fake-image-bytes');
  const result = await ollamaVision.caption(buffer, 'What is this?');
  assert.strictEqual(result, 'A red bicycle.');
  assert.strictEqual(receivedBody.model, 'llava');
  assert.strictEqual(receivedBody.messages[0].content, 'What is this?');
  assert.deepStrictEqual(receivedBody.messages[0].images, [buffer.toString('base64')]);

  server.close();
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.LOCAL_VISION_MODEL;
});

test('throws with the adapter name on a non-2xx response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 500;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.OLLAMA_BASE_URL = `http://localhost:${server.address().port}`;
  process.env.LOCAL_VISION_MODEL = 'llava';

  await assert.rejects(() => ollamaVision.caption(Buffer.from('x'), 'q'), /ollama-vision http 500/);

  server.close();
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.LOCAL_VISION_MODEL;
});

test('throws when the model returns no content', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: {} }));
  });
  await new Promise((resolve) => server.listen(0, resolve));
  process.env.OLLAMA_BASE_URL = `http://localhost:${server.address().port}`;
  process.env.LOCAL_VISION_MODEL = 'llava';

  await assert.rejects(() => ollamaVision.caption(Buffer.from('x'), 'q'), /returned no description/);

  server.close();
  delete process.env.OLLAMA_BASE_URL;
  delete process.env.LOCAL_VISION_MODEL;
});
