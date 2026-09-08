const test = require('node:test');
const assert = require('node:assert');
const { classify } = require('../server/classify.js');

test('classifies coding prompts', () => {
  assert.strictEqual(classify('debug this python function, it throws an error'), 'coding');
  assert.strictEqual(classify('```js\nfoo()\n```'), 'coding');
});

test('classifies summarization prompts', () => {
  assert.strictEqual(classify('summarize this article for me'), 'summarization');
  assert.strictEqual(classify('please analyze this report'), 'summarization');
});

test('classifies creative prompts', () => {
  assert.strictEqual(classify('brainstorm ideas for a birthday party'), 'creative');
  assert.strictEqual(classify('write a short story about a robot'), 'creative');
});

test('classifies classification prompts', () => {
  assert.strictEqual(classify('classify this list of animals'), 'classification');
});

test('classifies fast prompts', () => {
  assert.strictEqual(classify('give me a quick answer'), 'fast');
});

test('defaults unmatched prompts to general', () => {
  assert.strictEqual(classify('what is the capital of France?'), 'general');
});
