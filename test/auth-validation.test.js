const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const TEST_DB = path.join(__dirname, 'test-auth-validation.sqlite');
process.env.DB_PATH = TEST_DB;
process.env.SESSION_SECRET = 'test-secret';

test('register rejects invalid email and short password, and normalizes email case', async () => {
  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const badEmail = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'hunter22' }),
  });
  assert.strictEqual(badEmail.status, 400);

  const shortPassword = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'c@example.com', password: 'short1' }),
  });
  assert.strictEqual(shortPassword.status, 400);

  const reg = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '  Mixed@Example.COM ', password: 'hunter22' }),
  });
  assert.strictEqual(reg.status, 200);

  // same address, different case -> treated as the same account
  const dup = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mixed@example.com', password: 'hunter22' }),
  });
  assert.strictEqual(dup.status, 409);

  const loginDifferentCase = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'MIXED@EXAMPLE.COM', password: 'hunter22' }),
  });
  assert.strictEqual(loginDifferentCase.status, 200);

  server.close();
  const { closeDb } = require('../server/db.js');
  closeDb();
  fs.rmSync(TEST_DB, { force: true, maxRetries: 5, retryDelay: 100 });
});
