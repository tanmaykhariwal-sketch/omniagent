const test = require('node:test');
const assert = require('node:assert');
const { buildRouter } = require('../../server/routing/router.js');

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

const categoryPrimary = { coding: ['specialist'], general: ['generalist'] };
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

test('falls through to another adapter when primary returns a safety-classifier artifact', async () => {
  const brokenAutoRouter = {
    name: 'specialist',
    isConfigured: () => true,
    send: async () => 'User Safety: safe\nResponse Safety: safe',
  };
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), brokenAutoRouter],
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

test('falls back to keyword classify when the lead dispatch fails', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), fakeAdapter('specialist', 'ok')],
    {
      classify: alwaysCoding,
      categoryPrimary,
      decideCategories: async () => { throw new Error('lead unavailable'); },
    }
  );
  const result = await router.route('fix this bug');
  assert.strictEqual(result.backendUsed, 'specialist');
  assert.strictEqual(result.category, 'coding');
});

test('dispatches to multiple categories and synthesizes a combined answer', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), fakeAdapter('specialist', 'ok')],
    {
      categoryPrimary,
      decideCategories: async () => ['coding', 'general'],
      synthesize: async (prompt, results) => `combined: ${results.map((r) => r.text).join(' | ')}`,
    }
  );
  const result = await router.route('fix this bug and explain it simply');
  assert.strictEqual(result.backendUsed, 'specialist+generalist');
  assert.strictEqual(result.category, 'coding+general');
  assert.strictEqual(result.text, 'combined: specialist: fix this bug and explain it simply | generalist: fix this bug and explain it simply');
});

test('resolves to the second named candidate when the first is unconfigured, not just whatever adapter is listed first', async () => {
  // Regression test: category primaries are ordered lists (e.g.
  // ['ollama-general', 'openrouter-general']). When the first candidate
  // isn't configured, the category must resolve to the *next named*
  // candidate for that category -- not silently fall through to an
  // unrelated adapter that just happens to be first in the adapter list.
  const unconfiguredLocal = { name: 'local-general', isConfigured: () => false, send: async () => { throw new Error('should not be called'); } };
  const wrongCategoryButFirst = fakeAdapter('cloud-coding', 'ok');
  const rightCategory = fakeAdapter('cloud-general', 'ok');
  const router = buildRouter(
    [wrongCategoryButFirst, rightCategory, unconfiguredLocal],
    {
      classify: () => 'general',
      categoryPrimary: { general: ['local-general', 'cloud-general'] },
    }
  );
  const result = await router.route('translate this');
  assert.strictEqual(result.backendUsed, 'cloud-general');
});

test('falls back to the first specialist answer when synthesis fails', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), fakeAdapter('specialist', 'ok')],
    {
      categoryPrimary,
      decideCategories: async () => ['coding', 'general'],
      synthesize: async () => { throw new Error('synthesis unavailable'); },
    }
  );
  const result = await router.route('fix this bug and explain it simply');
  assert.strictEqual(result.backendUsed, 'specialist');
  assert.strictEqual(result.category, 'coding');
});
