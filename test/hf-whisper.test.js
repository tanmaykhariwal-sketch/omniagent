const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const hfWhisper = require('../server/adapters/hf-whisper.js');

test('isConfigured is false without HF_API_KEY', () => {
  delete process.env.HF_API_KEY;
  assert.strictEqual(hfWhisper.isConfigured(), false);
});

test('transcribe sends raw audio bytes and returns the transcribed text', async () => {
  const server = http.createServer((req, res) => {
    assert.strictEqual(req.headers['content-type'], 'audio/wav');
    assert.strictEqual(req.headers.authorization, 'Bearer hf-test');
    let chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      assert.strictEqual(Buffer.concat(chunks).toString(), 'fake-audio-bytes');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ text: 'hello world' }));
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.HF_API_KEY = 'hf-test';
  process.env.HF_INFERENCE_BASE_URL = `http://localhost:${port}`;

  const text = await hfWhisper.transcribe(Buffer.from('fake-audio-bytes'), 'audio/wav');
  assert.strictEqual(text, 'hello world');

  server.close();
});

test('throws with the adapter name on a non-2xx response', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = 500;
    res.end('boom');
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  process.env.HF_API_KEY = 'hf-test';
  process.env.HF_INFERENCE_BASE_URL = `http://localhost:${port}`;

  await assert.rejects(() => hfWhisper.transcribe(Buffer.from('x'), 'audio/wav'), /hf-whisper http 500/);

  server.close();
});
