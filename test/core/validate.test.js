const test = require('node:test');
const assert = require('node:assert');
const { normalizeEmail, isValidEmail, isValidPassword } = require('../../server/core/validate.js');

test('normalizeEmail trims and lowercases', () => {
  assert.strictEqual(normalizeEmail('  Foo@Example.COM '), 'foo@example.com');
});

test('isValidEmail accepts well-formed addresses', () => {
  assert.strictEqual(isValidEmail('a@b.com'), true);
  assert.strictEqual(isValidEmail('not-an-email'), false);
  assert.strictEqual(isValidEmail('missing@domain'), false);
});

test('isValidPassword enforces an 8 character minimum', () => {
  assert.strictEqual(isValidPassword('short1'), false);
  assert.strictEqual(isValidPassword('longenough1'), true);
});
