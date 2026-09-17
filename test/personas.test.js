const test = require('node:test');
const assert = require('node:assert');
const { getPersonaInstruction, PERSONAS } = require('../server/personas.js');

test('getPersonaInstruction returns the instruction for a known id', () => {
  assert.strictEqual(getPersonaInstruction('casual'), PERSONAS.casual);
});

test('getPersonaInstruction returns null for an unknown id, never the raw input', () => {
  assert.strictEqual(getPersonaInstruction('anything-not-in-map'), null);
  assert.strictEqual(getPersonaInstruction(undefined), null);
  assert.strictEqual(getPersonaInstruction(''), null);
});
