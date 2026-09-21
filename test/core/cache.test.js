const test = require('node:test');
const assert = require('node:assert');

// memoizeAsync deliberately disables caching under NODE_ENV=test (see
// server/core/cache.js) so test files sharing one process across multiple
// test() blocks never get a stale cached response from an earlier test's
// fake server -- override it here specifically to exercise the real
// caching behavior this module provides.
// This file runs in its own isolated process (scripts/run-tests.js spawns
// one process per test file), so overriding NODE_ENV here for the whole
// file's lifetime doesn't affect any other test file.
process.env.NODE_ENV = 'development';
const { memoizeAsync } = require('../../server/core/cache.js');

test('caches a result and does not call the wrapped function again for the same key', async () => {
  let calls = 0;
  const fn = memoizeAsync(
    async (id) => {
      calls++;
      return `result-${id}`;
    },
    { ttl: 60_000 }
  );

  assert.strictEqual(await fn('a'), 'result-a');
  assert.strictEqual(await fn('a'), 'result-a');
  assert.strictEqual(calls, 1);
});

test('caches falsy-but-defined results (0, "", false), not just truthy ones', async () => {
  let calls = 0;
  const fn = memoizeAsync(
    async () => {
      calls++;
      return 0;
    },
    { ttl: 60_000 }
  );

  assert.strictEqual(await fn(), 0);
  assert.strictEqual(await fn(), 0);
  assert.strictEqual(calls, 1);
});

test('different keys are cached independently', async () => {
  let calls = 0;
  const fn = memoizeAsync(
    async (id) => {
      calls++;
      return `result-${id}`;
    },
    { ttl: 60_000, keyFn: (id) => id }
  );

  assert.strictEqual(await fn('a'), 'result-a');
  assert.strictEqual(await fn('b'), 'result-b');
  assert.strictEqual(calls, 2);
});

test('does not cache a rejected call', async () => {
  let calls = 0;
  const fn = memoizeAsync(
    async () => {
      calls++;
      throw new Error('boom');
    },
    { ttl: 60_000 }
  );

  await assert.rejects(() => fn('x'), /boom/);
  await assert.rejects(() => fn('x'), /boom/);
  assert.strictEqual(calls, 2);
});

test('an expired entry triggers a fresh call', async () => {
  let calls = 0;
  const fn = memoizeAsync(
    async (id) => {
      calls++;
      return `result-${id}-${calls}`;
    },
    { ttl: 10 }
  );

  const first = await fn('a');
  await new Promise((resolve) => setTimeout(resolve, 30));
  const second = await fn('a');
  assert.notStrictEqual(first, second);
  assert.strictEqual(calls, 2);
});

test('caching is disabled under NODE_ENV=test (the actual mode this suite runs in)', async () => {
  process.env.NODE_ENV = 'test';
  let calls = 0;
  const fn = memoizeAsync(async () => {
    calls++;
    return calls;
  });

  assert.strictEqual(await fn(), 1);
  assert.strictEqual(await fn(), 2);
  assert.strictEqual(calls, 2);
});
