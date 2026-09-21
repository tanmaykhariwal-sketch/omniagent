const test = require('node:test');
const assert = require('node:assert');
const { chatBodySchema, pinBodySchema, feedbackBodySchema, validateBody } = require('../../server/core/validation.js');

function fakeReqRes(body) {
  const req = { body };
  let statusCode = null;
  let jsonBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return this;
    },
  };
  return { req, res, getStatus: () => statusCode, getJson: () => jsonBody };
}

test('chatBodySchema: trims the prompt and rejects an empty one', () => {
  assert.strictEqual(chatBodySchema.safeParse({ prompt: '  hi  ' }).data.prompt, 'hi');
  const empty = chatBodySchema.safeParse({ prompt: '   ' });
  assert.strictEqual(empty.success, false);
});

test('chatBodySchema: rejects a prompt over the max length', () => {
  const result = chatBodySchema.safeParse({ prompt: 'x'.repeat(4001) });
  assert.strictEqual(result.success, false);
});

test('chatBodySchema: persona and webSearch are optional and type-checked', () => {
  assert.strictEqual(chatBodySchema.safeParse({ prompt: 'hi' }).success, true);
  assert.strictEqual(chatBodySchema.safeParse({ prompt: 'hi', persona: 'casual' }).success, true);
  assert.strictEqual(chatBodySchema.safeParse({ prompt: 'hi', webSearch: true }).success, true);
  assert.strictEqual(chatBodySchema.safeParse({ prompt: 'hi', webSearch: 'true' }).success, false);
});

test('pinBodySchema: requires pinned to be a real boolean', () => {
  assert.strictEqual(pinBodySchema.safeParse({ pinned: true }).success, true);
  assert.strictEqual(pinBodySchema.safeParse({ pinned: false }).success, true);
  assert.strictEqual(pinBodySchema.safeParse({}).success, false);
  assert.strictEqual(pinBodySchema.safeParse({ pinned: 'yes' }).success, false);
});

test('feedbackBodySchema: accepts up/down/null, rejects anything else', () => {
  assert.strictEqual(feedbackBodySchema.safeParse({ feedback: 'up' }).success, true);
  assert.strictEqual(feedbackBodySchema.safeParse({ feedback: 'down' }).success, true);
  assert.strictEqual(feedbackBodySchema.safeParse({ feedback: null }).success, true);
  assert.strictEqual(feedbackBodySchema.safeParse({ feedback: 'sideways' }).success, false);
});

test('validateBody middleware: replaces req.body with parsed data and calls next on success', () => {
  const { req, res } = fakeReqRes({ prompt: '  hi  ' });
  let nextCalled = false;
  validateBody(chatBodySchema)(req, res, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.body.prompt, 'hi');
});

test('validateBody middleware: responds 400 with the first issue message on failure, never calls next', () => {
  const { req, res, getStatus, getJson } = fakeReqRes({ pinned: 'not-a-boolean' });
  let nextCalled = false;
  validateBody(pinBodySchema)(req, res, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(getStatus(), 400);
  assert.strictEqual(typeof getJson().error, 'string');
});

test('validateBody middleware: treats a missing body as an empty object rather than throwing', () => {
  const { req, res, getStatus } = fakeReqRes(undefined);
  validateBody(pinBodySchema)(req, res, () => {});
  assert.strictEqual(getStatus(), 400);
});
