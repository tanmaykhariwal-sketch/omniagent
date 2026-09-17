const test = require('node:test');
const assert = require('node:assert');
const { getFollowUpSuggestions, parseSuggestions } = require('../server/suggestions.js');

test('parseSuggestions accepts a valid JSON array of strings', () => {
  assert.deepStrictEqual(parseSuggestions('["What about X?", "How does Y work?"]'), [
    'What about X?',
    'How does Y work?',
  ]);
});

test('parseSuggestions returns [] for non-JSON, non-array, or empty-array input', () => {
  assert.deepStrictEqual(parseSuggestions('not json'), []);
  assert.deepStrictEqual(parseSuggestions('{"a":1}'), []);
  assert.deepStrictEqual(parseSuggestions('[]'), []);
});

test('parseSuggestions drops overlong or non-string entries and caps the count', () => {
  const tooLong = 'x'.repeat(200);
  const raw = JSON.stringify(['ok one', 42, tooLong, 'ok two', 'ok three', 'ok four']);
  const result = parseSuggestions(raw);
  assert.deepStrictEqual(result, ['ok one', 'ok two', 'ok three']);
});

test('getFollowUpSuggestions uses the preferred adapter and returns its suggestions', async () => {
  const preferredAdapter = {
    name: 'preferred',
    isConfigured: () => true,
    send: async () => '["Follow-up A?", "Follow-up B?"]',
  };
  const result = await getFollowUpSuggestions('hi', 'hello', preferredAdapter);
  assert.deepStrictEqual(result, ['Follow-up A?', 'Follow-up B?']);
});

test('getFollowUpSuggestions never throws when nothing is configured', async () => {
  await assert.doesNotReject(() => getFollowUpSuggestions('hi', 'hello', undefined));
});
