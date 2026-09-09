const test = require('node:test');
const assert = require('node:assert');
const { classify } = require('../server/classify.js');

test('classifies coding prompts', () => {
  assert.strictEqual(classify('debug this python function, it throws an error'), 'coding');
  assert.strictEqual(classify('```js\nfoo()\n```'), 'coding');
});

test('classifies prompts naming other languages/tools as coding', () => {
  assert.strictEqual(classify('write a rust program that reverses a string'), 'coding');
  assert.strictEqual(classify('why does this sql query return no rows'), 'coding');
  assert.strictEqual(classify('refactor this typescript class'), 'coding');
  assert.strictEqual(classify('fix this syntax error in my c++ code'), 'coding');
});

test('does not misclassify plain english containing "go"', () => {
  assert.strictEqual(classify('should I go to the store today?'), 'general');
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
