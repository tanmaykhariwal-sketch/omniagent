const test = require('node:test');
const assert = require('node:assert');
const { buildRouter } = require('../server/router.js');

function fakeAdapter(name, behavior) {
  return {
    name,
    isConfigured: () => true,
    send: async (prompt) => {
      if (behavior === 'fail') throw new Error(`${name} failed`);
      return `${name}: ${prompt}`;
    },
  };
}

const categoryPrimary = { coding: 'specialist', general: 'generalist' };
const alwaysGeneral = () => 'general';
const alwaysCoding = () => 'coding';

test('uses the category primary when configured and it succeeds', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), fakeAdapter('specialist', 'ok')],
    { classify: alwaysCoding, categoryPrimary }
  );
  const result = await router.route('fix this bug');
  assert.strictEqual(result.backendUsed, 'specialist');
  assert.strictEqual(result.category, 'coding');
});

test('falls through to another configured adapter when primary fails', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), fakeAdapter('specialist', 'fail')],
    { classify: alwaysCoding, categoryPrimary }
  );
  const result = await router.route('fix this bug');
  assert.strictEqual(result.backendUsed, 'generalist');
});

test('falls through when primary is not configured', async () => {
  const unconfiguredSpecialist = { name: 'specialist', isConfigured: () => false, send: async () => { throw new Error('should not be called'); } };
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), unconfiguredSpecialist],
    { classify: alwaysCoding, categoryPrimary }
  );
  const result = await router.route('fix this bug');
  assert.strictEqual(result.backendUsed, 'generalist');
});

test('throws when all configured adapters fail', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'fail'), fakeAdapter('specialist', 'fail')],
    { classify: alwaysCoding, categoryPrimary }
  );
  await assert.rejects(() => router.route('fix this bug'), /all backends unavailable/);
});

test('uses general-category primary for unmatched prompts', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), fakeAdapter('specialist', 'ok')],
    { classify: alwaysGeneral, categoryPrimary }
  );
  const result = await router.route('hello');
  assert.strictEqual(result.backendUsed, 'generalist');
  assert.strictEqual(result.category, 'general');
});
