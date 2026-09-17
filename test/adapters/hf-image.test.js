const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const hfImage = require('../../server/adapters/hf-image.js');

test('isConfigured is false without HF_API_KEY', () => {
  delete process.env.HF_API_KEY;
  assert.strictEqual(hfImage.isConfigured(), false);
});

test('generate returns base64 image data on a successful response', async () => {
  const server = http.createServer((req, res) => {
    assert.strictEqual(req.headers.authorization, 'Bearer hf-test');
    res.setHeader('Content-Type', 'image/png');
    res.end(Buffer.from('fake-png-bytes'));
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.HF_API_KEY = 'hf-test';
  process.env.HF_INFERENCE_BASE_URL = `http://localhost:${port}`;
  assert.strictEqual(hfImage.isConfigured(), true);

  const { base64, mimeType } = await hfImage.generate('a cat wearing a hat');
  assert.strictEqual(mimeType, 'image/png');
  assert.strictEqual(Buffer.from(base64, 'base64').toString(), 'fake-png-bytes');

  server.close();
});

test('throws a descriptive error when the API returns JSON instead of an image', async () => {
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Model is loading' }));
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.HF_API_KEY = 'hf-test';
  process.env.HF_INFERENCE_BASE_URL = `http://localhost:${port}`;

  await assert.rejects(() => hfImage.generate('anything'), /did not return an image/);

  server.close();
});

test('throws with the adapter name on a non-2xx response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 503;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.HF_API_KEY = 'hf-test';
  process.env.HF_INFERENCE_BASE_URL = `http://localhost:${port}`;

  await assert.rejects(() => hfImage.generate('anything'), /hf-image http 503/);

  server.close();
});
