const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const TEST_DB = path.join(__dirname, 'test-omniagent.sqlite');

test('getDb creates users, queries, and sessions tables', () => {
  process.env.DB_PATH = TEST_DB;
  delete require.cache[require.resolve('../server/db.js')];
  const { getDb, closeDb } = require('../server/db.js');
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  assert.ok(tables.includes('users'));
  assert.ok(tables.includes('queries'));
  assert.ok(tables.includes('sessions'));
  closeDb();
  fs.rmSync(TEST_DB, { force: true, maxRetries: 5, retryDelay: 100 });
});
