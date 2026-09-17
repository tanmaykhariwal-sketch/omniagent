const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'omniagent.sqlite');
  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      backend_used TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      fact TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  // ALTER TABLE ... ADD COLUMN has no IF NOT EXISTS in SQLite, and
  // CREATE TABLE IF NOT EXISTS above is a no-op on a DB file that already
  // has the queries table from before this column existed. Try the add,
  // ignore the "duplicate column" error on every run after the first.
  try {
    dbInstance.exec('ALTER TABLE queries ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err;
  }
  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

module.exports = { getDb, closeDb };
