const test = require('node:test');
const assert = require('node:assert');
const { validateEnv } = require('../../server/core/env.js');

test('applies documented defaults when nothing is set', () => {
  const env = validateEnv({});
  assert.strictEqual(env.NODE_ENV, 'development');
  assert.strictEqual(env.PORT, 3000);
  assert.strictEqual(env.SESSION_SECRET, 'dev-secret');
  assert.strictEqual(env.OLLAMA_BASE_URL, 'http://localhost:11434');
  assert.strictEqual(env.LOCAL_CODING_MODEL, '');
  assert.strictEqual(env.OPENROUTER_API_KEY, '');
});

test('passes through valid explicit values', () => {
  const env = validateEnv({
    NODE_ENV: 'production',
    PORT: '8080',
    SESSION_SECRET: 'a-real-secret',
    OPENROUTER_API_KEY: 'sk-test',
  });
  assert.strictEqual(env.NODE_ENV, 'production');
  assert.strictEqual(env.PORT, 8080);
  assert.strictEqual(env.SESSION_SECRET, 'a-real-secret');
  assert.strictEqual(env.OPENROUTER_API_KEY, 'sk-test');
});

test('throws on a malformed PORT rather than silently coercing it', () => {
  assert.throws(() => validateEnv({ PORT: 'not-a-port' }));
});

test('throws on an unrecognized NODE_ENV value', () => {
  assert.throws(() => validateEnv({ NODE_ENV: 'staging' }));
});

test('throws on a malformed OLLAMA_BASE_URL', () => {
  assert.throws(() => validateEnv({ OLLAMA_BASE_URL: 'not a url' }));
});

test('an empty-string OLLAMA_BASE_URL falls back to the default instead of failing', () => {
  const env = validateEnv({ OLLAMA_BASE_URL: '' });
  assert.strictEqual(env.OLLAMA_BASE_URL, 'http://localhost:11434');
});
