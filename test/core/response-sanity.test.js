const test = require('node:test');
const assert = require('node:assert');
const { isSafetyClassifierArtifact } = require('../../server/core/response-sanity.js');

test('detects a safety-classifier artifact regardless of case or which line leads', () => {
  assert.strictEqual(isSafetyClassifierArtifact('User Safety: safe\nResponse Safety: safe'), true);
  assert.strictEqual(isSafetyClassifierArtifact('response safety: unsafe'), true);
  assert.strictEqual(isSafetyClassifierArtifact('USER SAFETY: SAFE'), true);
});

test('does not flag a genuine answer that happens to mention safety in passing', () => {
  assert.strictEqual(isSafetyClassifierArtifact('Wearing a seatbelt improves user safety significantly.'), false);
  assert.strictEqual(isSafetyClassifierArtifact('Hello! How can I help you today?'), false);
});
