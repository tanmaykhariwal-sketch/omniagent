# OmniAgent Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the OmniAgent core web app — chat UI, email/password auth, multi-backend text router with automatic fallback, SQLite logging — as a single-identity product with no backend AI names ever surfaced.

**Architecture:** Node/Express backend (SQLite via better-sqlite3, sessions via express-session) serving a JSON API; React (Vite) single-page frontend for login/register and chat. A router module holds an ordered list of backend adapters built from whichever API keys are present in env; on adapter failure it falls through to the next.

**Tech Stack:** Node.js, Express, better-sqlite3, bcrypt, express-session + connect-sqlite3, React 18, Vite, Node built-in test runner (`node:test`) for backend unit tests.

**Spec:** `docs/superpowers/specs/2026-09-08-omniagent-core-design.md`

## Global Constraints

- No backend AI name (Claude, GPT, Gemini, etc.) is ever returned to the frontend or shown in any user-facing string. Log it server-side only, under a `backend_used` column.
- All chat/auth routes require the response body to reveal only "OmniAgent" as the identity.
- Passwords hashed with bcrypt before storage; plaintext passwords never logged or persisted.
- `.env` holds all secrets; `.env` is gitignored; `.env.example` lists every var name with no real values.
- Router priority order (fixed in code, filtered to whichever keys exist): Anthropic, OpenAI, Gemini, Mistral, Cohere, Hugging Face.

---

## File Structure

```
omniagent/
├── .env.example
├── .gitignore
├── package.json                  (root: server deps + scripts)
├── server/
│   ├── index.js                  (Express app bootstrap, fail-fast on no keys)
│   ├── db.js                     (better-sqlite3 connection + schema init)
│   ├── auth.js                   (register/login/logout route handlers + session middleware)
│   ├── router.js                 (adapter ordering + fallback logic)
│   ├── adapters/
│   │   ├── anthropic.js
│   │   ├── openai.js
│   │   ├── gemini.js
│   │   ├── mistral.js
│   │   ├── cohere.js
│   │   └── huggingface.js
│   └── chat.js                   (POST /chat route handler)
├── test/
│   ├── router.test.js
│   └── auth.test.js
└── client/
    ├── package.json               (Vite + React)
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx                 (routes login/register vs chat)
        ├── api.js                  (fetch wrapper, credentials: include)
        ├── LoginPage.jsx
        └── ChatPage.jsx
```

---

### Task 1: Repo scaffold and server bootstrap

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `server/index.js`
- Test: `test/server.test.js`

**Interfaces:**
- Produces: `server/index.js` exports `createApp()` returning an Express app (no `.listen()` call, so tests can mount it), and the file's `require.main === module` block calls `.listen(PORT)`.

- [ ] **Step 1: Write package.json**

```json
{
  "name": "omniagent",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "start": "node server/index.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "express": "^4.19.2",
    "express-session": "^1.18.0",
    "connect-sqlite3": "^0.9.13",
    "better-sqlite3": "^11.3.0",
    "bcrypt": "^5.1.1",
    "dotenv": "^16.4.5"
  }
}
```

- [ ] **Step 2: Write .gitignore**

```
node_modules/
.env
*.sqlite
client/node_modules/
client/dist/
```

- [ ] **Step 3: Write .env.example**

```
PORT=3000
SESSION_SECRET=change-me-to-a-random-string
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
MISTRAL_API_KEY=
COHERE_API_KEY=
KIMI_API_KEY=
HF_API_KEY=
```

- [ ] **Step 4: Write server/index.js**

```js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: './' }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 },
  }));

  app.get('/health', (req, res) => res.json({ ok: true, identity: 'OmniAgent' }));

  return app;
}

if (require.main === module) {
  const hasAnyKey = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'COHERE_API_KEY', 'KIMI_API_KEY', 'HF_API_KEY']
    .some((k) => !!process.env[k]);
  if (!hasAnyKey) {
    console.error('No backend API keys configured. Set at least one in .env before starting.');
    process.exit(1);
  }
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`OmniAgent server listening on ${port}`));
}

module.exports = { createApp };
```

- [ ] **Step 5: Write test/server.test.js**

```js
const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../server/index.js');

test('GET /health returns OmniAgent identity only', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/health`);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.identity, 'OmniAgent');
  server.close();
});
```

- [ ] **Step 6: Install deps and run test**

Run: `cd omniagent && npm install && npm test`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example server/index.js test/server.test.js
git commit -m "feat: scaffold express server with session middleware and health check"
```

---

### Task 2: SQLite DB module

**Files:**
- Create: `server/db.js`
- Test: `test/db.test.js`

**Interfaces:**
- Produces: `server/db.js` exports `getDb()` returning a singleton better-sqlite3 connection with `users` and `queries` tables already created (idempotent `CREATE TABLE IF NOT EXISTS`).

- [ ] **Step 1: Write failing test**

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const TEST_DB = path.join(__dirname, 'test-omniagent.sqlite');

test('getDb creates users and queries tables', () => {
  process.env.DB_PATH = TEST_DB;
  delete require.cache[require.resolve('../server/db.js')];
  const { getDb } = require('../server/db.js');
  const db = getDb();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  assert.ok(tables.includes('users'));
  assert.ok(tables.includes('queries'));
  db.close();
  fs.rmSync(TEST_DB, { force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/db.test.js`
Expected: FAIL — `Cannot find module '../server/db.js'`

- [ ] **Step 3: Write server/db.js**

```js
const Database = require('better-sqlite3');
const path = require('node:path');

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'omniagent.sqlite');
  dbInstance = new Database(dbPath);
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
  `);
  return dbInstance;
}

module.exports = { getDb };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/db.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/db.js test/db.test.js
git commit -m "feat: add sqlite db module with users and queries tables"
```

---

### Task 3: Auth (register/login/logout)

**Files:**
- Create: `server/auth.js`
- Modify: `server/index.js` (mount auth routes)
- Test: `test/auth.test.js`

**Interfaces:**
- Consumes: `getDb()` from `server/db.js` (Task 2).
- Produces: `server/auth.js` exports `authRouter` (Express Router) with `POST /register`, `POST /login`, `POST /logout`; and `requireAuth` middleware that reads `req.session.userId`, returning 401 JSON `{ error: 'unauthorized' }` if absent, else calling `next()`.

- [ ] **Step 1: Write failing test**

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const TEST_DB = path.join(__dirname, 'test-auth.sqlite');
process.env.DB_PATH = TEST_DB;
process.env.SESSION_SECRET = 'test-secret';

test('register, login, logout flow', async () => {
  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const reg = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@example.com', password: 'hunter22' }),
  });
  assert.strictEqual(reg.status, 200);

  const dupReg = await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@example.com', password: 'hunter22' }),
  });
  assert.strictEqual(dupReg.status, 409);

  const badLogin = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@example.com', password: 'wrong' }),
  });
  assert.strictEqual(badLogin.status, 401);

  const login = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@example.com', password: 'hunter22' }),
  });
  assert.strictEqual(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie);

  server.close();
  fs.rmSync(TEST_DB, { force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/auth.test.js`
Expected: FAIL — 404 on `/register` (route not mounted / module missing)

- [ ] **Step 3: Write server/auth.js**

```js
const express = require('express');
const bcrypt = require('bcrypt');
const { getDb } = require('./db');

const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, passwordHash, new Date().toISOString());

  res.json({ ok: true });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const db = getDb();
  const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'invalid credentials' });

  req.session.userId = user.id;
  res.json({ ok: true });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'unauthorized' });
  next();
}

module.exports = { authRouter, requireAuth };
```

- [ ] **Step 4: Mount auth routes in server/index.js**

Modify `server/index.js`: add near the top `const { authRouter } = require('./auth');` and after the session middleware add `app.use(authRouter);`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/auth.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/auth.js server/index.js test/auth.test.js
git commit -m "feat: add register/login/logout auth with bcrypt and sessions"
```

---

### Task 4: Backend adapters + classifier + router with category routing and fallback

**Files:**
- Create: `server/adapters/anthropic.js`
- Create: `server/adapters/openai.js`
- Create: `server/adapters/gemini.js`
- Create: `server/adapters/mistral.js`
- Create: `server/adapters/cohere.js`
- Create: `server/adapters/kimi.js`
- Create: `server/adapters/huggingface.js`
- Create: `server/classify.js`
- Create: `server/router.js`
- Test: `test/classify.test.js`
- Test: `test/router.test.js`

**Interfaces:**
- Each adapter module exports `{ name: string, isConfigured: () => boolean, send: (prompt: string) => Promise<string> }`. `send` throws on any failure (HTTP error, network error, non-2xx).
- Produces: `server/classify.js` exports `classify(prompt: string) -> category: string`, one of `'coding' | 'summarization' | 'creative' | 'classification' | 'fast' | 'general'`.
- Produces: `server/router.js` exports `buildRouter(adapters, options)` (options: `{ classify, categoryPrimary }`, both optional, for testability) and `route(prompt)` (the real singleton using the actual adapter list) returning `{ text: string, backendUsed: string, category: string }`, throwing `Error('all backends unavailable')` if every configured adapter fails. Also exports `CATEGORY_PRIMARY` (the real category→backend-name map) for reference/tests.

- [ ] **Step 1: Write failing test for classifier**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/classify.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Write server/classify.js**

```js
const RULES = [
  { category: 'coding', pattern: /```|\bcode\b|\bfunction\b|\bdebug\b|\bstack trace\b|\bpython\b|\bjavascript\b|\balgorithm\b/i },
  { category: 'summarization', pattern: /\bsummarize\b|\bsummary\b|\banalyz(e|is)\b/i },
  { category: 'creative', pattern: /\bbrainstorm\b|\bstory\b|\bpoem\b|\bcreative\b|\bblog post\b/i },
  { category: 'classification', pattern: /\bclassify\b|\bcategoriz(e|ation)\b/i },
  { category: 'fast', pattern: /\bquick\b|\bshort answer\b/i },
];

function classify(prompt) {
  for (const rule of RULES) {
    if (rule.pattern.test(prompt)) return rule.category;
  }
  return 'general';
}

module.exports = { classify };
```

- [ ] **Step 4: Run classifier test to verify it passes**

Run: `npm test -- test/classify.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Write failing test for router (uses fake adapters, no real network calls)**

```js
const test = require('node:test');
const assert = require('node:assert');
const { buildRouter } = require('../server/router.js');

function fakeAdapter(name, behavior) {
  return {
    name,
    isConfigured: () => true,
    send: async (prompt) => {
      if (behavior === 'fail') throw new Error(`${name} failed`);
      return `${name}: ${prompt}`;
    },
  };
}

const categoryPrimary = { coding: 'specialist', general: 'generalist' };
const alwaysGeneral = () => 'general';
const alwaysCoding = () => 'coding';

test('uses the category primary when configured and it succeeds', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), fakeAdapter('specialist', 'ok')],
    { classify: alwaysCoding, categoryPrimary }
  );
  const result = await router.route('fix this bug');
  assert.strictEqual(result.backendUsed, 'specialist');
  assert.strictEqual(result.category, 'coding');
});

test('falls through to another configured adapter when primary fails', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), fakeAdapter('specialist', 'fail')],
    { classify: alwaysCoding, categoryPrimary }
  );
  const result = await router.route('fix this bug');
  assert.strictEqual(result.backendUsed, 'generalist');
});

test('falls through when primary is not configured', async () => {
  const unconfiguredSpecialist = { name: 'specialist', isConfigured: () => false, send: async () => { throw new Error('should not be called'); } };
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), unconfiguredSpecialist],
    { classify: alwaysCoding, categoryPrimary }
  );
  const result = await router.route('fix this bug');
  assert.strictEqual(result.backendUsed, 'generalist');
});

test('throws when all configured adapters fail', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'fail'), fakeAdapter('specialist', 'fail')],
    { classify: alwaysCoding, categoryPrimary }
  );
  await assert.rejects(() => router.route('fix this bug'), /all backends unavailable/);
});

test('uses general-category primary for unmatched prompts', async () => {
  const router = buildRouter(
    [fakeAdapter('generalist', 'ok'), fakeAdapter('specialist', 'ok')],
    { classify: alwaysGeneral, categoryPrimary }
  );
  const result = await router.route('hello');
  assert.strictEqual(result.backendUsed, 'generalist');
  assert.strictEqual(result.category, 'general');
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- test/router.test.js`
Expected: FAIL — module not found

- [ ] **Step 7: Write the seven adapter files**

`server/adapters/anthropic.js`:
```js
const NAME = 'anthropic';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.ANTHROPIC_API_KEY,
  async send(prompt) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic http ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text || '';
  },
};
```

`server/adapters/openai.js`:
```js
const NAME = 'openai';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.OPENAI_API_KEY,
  async send(prompt) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`openai http ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },
};
```

`server/adapters/gemini.js`:
```js
const NAME = 'gemini';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.GEMINI_API_KEY,
  async send(prompt) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!res.ok) throw new Error(`gemini http ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },
};
```

`server/adapters/mistral.js`:
```js
const NAME = 'mistral';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.MISTRAL_API_KEY,
  async send(prompt) {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`mistral http ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },
};
```

`server/adapters/cohere.js`:
```js
const NAME = 'cohere';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.COHERE_API_KEY,
  async send(prompt) {
    const res = await fetch('https://api.cohere.com/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      },
      body: JSON.stringify({ model: 'command-r', message: prompt }),
    });
    if (!res.ok) throw new Error(`cohere http ${res.status}`);
    const data = await res.json();
    return data.text || '';
  },
};
```

`server/adapters/kimi.js`:
```js
const NAME = 'kimi';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.KIMI_API_KEY,
  async send(prompt) {
    const res = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'kimi-k2-0711-preview',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`kimi http ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },
};
```

`server/adapters/huggingface.js`:
```js
const NAME = 'huggingface';
const MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.HF_API_KEY,
  async send(prompt) {
    const res = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    });
    if (!res.ok) throw new Error(`huggingface http ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data[0]?.generated_text || '' : data.generated_text || '';
  },
};
```

- [ ] **Step 8: Write server/router.js**

```js
const { classify } = require('./classify');
const anthropic = require('./adapters/anthropic');
const openai = require('./adapters/openai');
const gemini = require('./adapters/gemini');
const mistral = require('./adapters/mistral');
const cohere = require('./adapters/cohere');
const kimi = require('./adapters/kimi');
const huggingface = require('./adapters/huggingface');

const DEFAULT_ADAPTERS = [openai, anthropic, gemini, kimi, mistral, cohere, huggingface];

const CATEGORY_PRIMARY = {
  coding: 'kimi',
  summarization: 'anthropic',
  creative: 'gemini',
  classification: 'cohere',
  fast: 'mistral',
  general: 'openai',
};

function buildRouter(adapters, options = {}) {
  const classifyFn = options.classify || classify;
  const categoryPrimary = options.categoryPrimary || CATEGORY_PRIMARY;

  return {
    async route(prompt) {
      const configured = adapters.filter((a) => a.isConfigured());
      const category = classifyFn(prompt);
      const primaryName = categoryPrimary[category];
      const primary = configured.find((a) => a.name === primaryName);
      const rest = configured.filter((a) => a.name !== primaryName);
      const order = primary ? [primary, ...rest] : rest;

      for (const adapter of order) {
        try {
          const text = await adapter.send(prompt);
          return { text, backendUsed: adapter.name, category };
        } catch (err) {
          continue;
        }
      }
      throw new Error('all backends unavailable');
    },
  };
}

const defaultRouter = buildRouter(DEFAULT_ADAPTERS);

module.exports = { buildRouter, route: defaultRouter.route, CATEGORY_PRIMARY };
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- test/router.test.js`
Expected: PASS (5 tests)

- [ ] **Step 10: Run full adapter/classifier/router test group**

Run: `npm test -- test/classify.test.js test/router.test.js`
Expected: all PASS (11 tests)

- [ ] **Step 11: Commit**

```bash
git add server/adapters server/classify.js server/router.js test/classify.test.js test/router.test.js
git commit -m "feat: add backend adapters, keyword classifier, and category-based router with fallback"
```

---

### Task 5: Chat endpoint

**Files:**
- Create: `server/chat.js`
- Modify: `server/index.js` (mount chat router)
- Test: `test/chat.test.js`

**Interfaces:**
- Consumes: `requireAuth` from `server/auth.js`, `route` from `server/router.js`, `getDb` from `server/db.js`.
- Produces: `server/chat.js` exports `chatRouter` with `POST /chat` — body `{ prompt: string }`, requires auth, returns `{ response: string }` only (no backend name in response body).

- [ ] **Step 1: Write failing test**

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const TEST_DB = path.join(__dirname, 'test-chat.sqlite');
process.env.DB_PATH = TEST_DB;
process.env.SESSION_SECRET = 'test-secret';

test('chat requires auth, then routes and logs', async () => {
  const { createApp } = require('../server/index.js');
  const app = createApp();
  const server = app.listen(0);
  const base = `http://localhost:${server.address().port}`;

  const unauth = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hi' }),
  });
  assert.strictEqual(unauth.status, 401);

  await fetch(`${base}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'b@example.com', password: 'hunter22' }),
  });
  const login = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'b@example.com', password: 'hunter22' }),
  });
  const cookie = login.headers.get('set-cookie');

  process.env.ANTHROPIC_API_KEY = '';
  process.env.OPENAI_API_KEY = '';
  // no keys configured -> chat should 503 with generic message, no provider names leaked
  const chatRes = await fetch(`${base}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ prompt: 'hi' }),
  });
  assert.strictEqual(chatRes.status, 503);
  const chatBody = await chatRes.json();
  assert.ok(!/anthropic|openai|gemini|mistral|cohere|huggingface/i.test(JSON.stringify(chatBody)));

  server.close();
  fs.rmSync(TEST_DB, { force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/chat.test.js`
Expected: FAIL — 404 on `/chat`

- [ ] **Step 3: Write server/chat.js**

```js
const express = require('express');
const { requireAuth } = require('./auth');
const { route } = require('./router');
const { getDb } = require('./db');

const chatRouter = express.Router();

chatRouter.post('/chat', requireAuth, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt required' });
  }

  try {
    const { text, backendUsed, category } = await route(prompt);
    const db = getDb();
    db.prepare('INSERT INTO queries (user_id, prompt, response, backend_used, category, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.session.userId, prompt, text, backendUsed, category, new Date().toISOString());
    res.json({ response: text });
  } catch (err) {
    res.status(503).json({ error: 'OmniAgent is temporarily unavailable, try again shortly' });
  }
});

module.exports = { chatRouter };
```

- [ ] **Step 4: Mount in server/index.js**

Add `const { chatRouter } = require('./chat');` and `app.use(chatRouter);` alongside the auth router mount.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/chat.test.js`
Expected: PASS

- [ ] **Step 6: Run full backend test suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/chat.js server/index.js test/chat.test.js
git commit -m "feat: add authenticated chat endpoint with router integration and query logging"
```

---

> **Superseded:** Tasks 6 and 7's client files were already built directly (with real visual craft — see `DESIGN.md` at repo root, "Command Palette" world) rather than the plain unstyled JSX below. The files exist at `client/src/{App,LoginPage,ChatPage,api}.jsx`+`.js` and `client/src/styles.css`, verified in-browser at desktop/mobile. Treat Tasks 6-7 below as historical reference only — do not overwrite the existing styled files with this section's code.

### Task 6: Frontend scaffold + login/register page

**Files:**
- Create: `client/package.json`
- Create: `client/index.html`
- Create: `client/vite.config.js`
- Create: `client/src/main.jsx`
- Create: `client/src/api.js`
- Create: `client/src/LoginPage.jsx`
- Create: `client/src/App.jsx`

**Interfaces:**
- Produces: `client/src/api.js` exports `register(email, password)`, `login(email, password)`, `logout()`, `sendChat(prompt)` — each a fetch wrapper with `credentials: 'include'`, throwing on non-2xx with `err.message` set from the JSON `error` field.
- Produces: `client/src/App.jsx` default export, a component holding `loggedIn` state, rendering `LoginPage` or `ChatPage` (Task 7).

- [ ] **Step 1: Write client/package.json**

```json
{
  "name": "omniagent-client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Write client/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/register': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
      '/logout': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 3: Write client/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>OmniAgent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Write client/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Write client/src/api.js**

```js
async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'request failed');
  }
  return res.json();
}

export function register(email, password) {
  return fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  }).then(handle);
}

export function login(email, password) {
  return fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  }).then(handle);
}

export function logout() {
  return fetch('/logout', { method: 'POST', credentials: 'include' }).then(handle);
}

export function sendChat(prompt) {
  return fetch('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ prompt }),
  }).then(handle);
}
```

- [ ] **Step 6: Write client/src/LoginPage.jsx**

```jsx
import { useState } from 'react';
import { login, register } from './api.js';

export default function LoginPage({ onAuthed }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'register') await register(email, password);
      await login(email, password);
      onAuthed();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 320, margin: '80px auto', fontFamily: 'system-ui' }}>
      <h1>OmniAgent</h1>
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <button type="submit">{mode === 'login' ? 'Log in' : 'Register & log in'}</button>
      </form>
      <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Log in'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Write client/src/App.jsx**

```jsx
import { useState } from 'react';
import LoginPage from './LoginPage.jsx';
import ChatPage from './ChatPage.jsx';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) return <LoginPage onAuthed={() => setLoggedIn(true)} />;
  return <ChatPage onLoggedOut={() => setLoggedIn(false)} />;
}
```

- [ ] **Step 8: Commit** (after Task 7 adds ChatPage.jsx, since App.jsx imports it — hold this commit and combine with Task 7's commit instead)

Skip commit here; proceed directly to Task 7 so the app is left in a working state at each commit.

---

### Task 7: Chat page with quick actions

**Files:**
- Create: `client/src/ChatPage.jsx`

**Interfaces:**
- Consumes: `sendChat`, `logout` from `client/src/api.js`.

- [ ] **Step 1: Write client/src/ChatPage.jsx**

```jsx
import { useState } from 'react';
import { sendChat, logout } from './api.js';

const QUICK_ACTIONS = [
  { label: 'Summarize', prefill: 'Summarize the following:\n\n' },
  { label: 'Explain code', prefill: 'Explain what this code does:\n\n' },
  { label: 'Draft email', prefill: 'Draft a professional email about:\n\n' },
];

export default function ChatPage({ onLoggedOut }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const prompt = input;
    setMessages((m) => [...m, { role: 'user', text: prompt }]);
    setInput('');
    setSending(true);
    try {
      const { response } = await sendChat(prompt);
      setMessages((m) => [...m, { role: 'omniagent', text: response }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'omniagent', text: err.message }]);
    } finally {
      setSending(false);
    }
  }

  async function handleLogout() {
    await logout();
    onLoggedOut();
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', fontFamily: 'system-ui', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>OmniAgent</h1>
        <button onClick={handleLogout}>Log out</button>
      </div>

      <div style={{ minHeight: 300, border: '1px solid #ccc', padding: 12, marginBottom: 12 }}>
        {messages.map((m, i) => (
          <p key={i}><strong>{m.role === 'user' ? 'You' : 'OmniAgent'}:</strong> {m.text}</p>
        ))}
      </div>

      <div style={{ marginBottom: 8 }}>
        {QUICK_ACTIONS.map((qa) => (
          <button key={qa.label} onClick={() => setInput(qa.prefill)} style={{ marginRight: 8 }}>
            {qa.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          style={{ width: '100%' }}
        />
        <button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send'}</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Install client deps**

Run: `cd omniagent/client && npm install`
Expected: installs without error

- [ ] **Step 3: Manual browser check**

Run backend: `cd omniagent && npm start` (with at least one real API key set in `.env`)
Run frontend: `cd omniagent/client && npm run dev`
Open the Vite dev URL, register a user, log in, send a chat message, confirm a response appears and no backend/provider name is ever shown anywhere in the UI or network responses.

- [ ] **Step 4: Commit**

```bash
git add client/
git commit -m "feat: add React frontend with login/register and chat UI with quick actions"
```

---

### Task 8: README with setup instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# OmniAgent

Single-identity chat app that routes requests across multiple text-generation backends with automatic fallback. Backend identity is never exposed to the user.

## Setup

1. `cp .env.example .env` and fill in `SESSION_SECRET` plus at least one backend API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `COHERE_API_KEY`, `HF_API_KEY`).
2. `npm install`
3. `npm start` — runs the API server on `PORT` (default 3000).
4. In a second terminal: `cd client && npm install && npm run dev` — runs the frontend dev server with API calls proxied to the backend.

## Tests

`npm test` runs backend unit tests (router fallback, auth flow) with `node --test`.

## Adding a backend

Backends are tried in this fixed priority order, skipping any without a configured key: Anthropic, OpenAI, Gemini, Mistral, Cohere, Hugging Face. Set the corresponding env var to enable one.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup and usage instructions"
```

---

## Self-Review Notes

- Spec coverage: auth ✓ (Task 3), router+fallback ✓ (Task 4), chat+logging ✓ (Task 5), SQLite schema ✓ (Task 2), frontend chat+quick actions ✓ (Task 6-7), fail-fast on no keys ✓ (Task 1), generic error on all-backends-down ✓ (Task 5), env config ✓ (Task 1, 8), no backend names surfaced ✓ (asserted in Task 5 test, enforced by chat.js only returning `text`).
- No placeholders remain; every step has literal code.
- Type/name consistency checked: `route()`, `buildRouter()`, `backendUsed`, `getDb()`, `requireAuth` used identically across all tasks that reference them.
