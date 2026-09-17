const test = require('node:test');
const assert = require('node:assert');
const { decideCategories, synthesize, parseCategories } = require('../../server/routing/lead.js');

function fakeAdapter(name, response) {
  return {
    name,
    isConfigured: () => true,
    send: async () => {
      if (response === 'fail') throw new Error(`${name} failed`);
      return response;
    },
  };
}

test('parseCategories extracts and validates a JSON category list', () => {
  assert.deepStrictEqual(parseCategories('{"categories": ["coding"]}'), ['coding']);
  assert.deepStrictEqual(parseCategories('sure, here you go: {"categories": ["coding", "creative"]}'), ['coding', 'creative']);
});

test('parseCategories dedupes and caps at 2 categories', () => {
  assert.deepStrictEqual(parseCategories('{"categories": ["coding", "coding", "creative", "fast"]}'), ['coding', 'creative']);
});

test('parseCategories drops unknown categories and throws if none remain valid', () => {
  assert.deepStrictEqual(parseCategories('{"categories": ["coding", "not-a-real-category"]}'), ['coding']);
  assert.throws(() => parseCategories('{"categories": ["not-a-real-category"]}'));
});

test('parseCategories throws on non-JSON or empty categories', () => {
  assert.throws(() => parseCategories('no json here'));
  assert.throws(() => parseCategories('{"categories": []}'));
});

test('decideCategories tries adapters in order until one parses', async () => {
  const categories = await decideCategories('hello', [
    fakeAdapter('bad', 'not json'),
    fakeAdapter('good', '{"categories": ["fast"]}'),
  ]);
  assert.deepStrictEqual(categories, ['fast']);
});

test('decideCategories throws when every adapter fails or returns unusable output', async () => {
  await assert.rejects(() =>
    decideCategories('hello', [fakeAdapter('a', 'fail'), fakeAdapter('b', 'garbage')])
  );
});

test('synthesize combines results using the first working adapter', async () => {
  const text = await synthesize(
    'original question',
    [{ category: 'coding', text: 'answer A', backendUsed: 'x' }, { category: 'creative', text: 'answer B', backendUsed: 'y' }],
    [fakeAdapter('bad', 'fail'), fakeAdapter('good', 'combined answer')]
  );
  assert.strictEqual(text, 'combined answer');
});

test('synthesize throws when every adapter fails', async () => {
  await assert.rejects(() =>
    synthesize('q', [{ category: 'coding', text: 'a', backendUsed: 'x' }], [fakeAdapter('a', 'fail')])
  );
});
