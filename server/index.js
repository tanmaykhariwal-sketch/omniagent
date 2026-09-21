require('dotenv').config();
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const { SqliteSessionStore } = require('./core/sqlite-session-store');
const { authRouter } = require('./routes/auth');
const { chatRouter } = require('./routes/chat');
const { mediaRouter } = require('./routes/media');
const { filesRouter } = require('./routes/files');
const { financeNewsRouter } = require('./routes/finance-news');
const { authLimiter, chatLimiter, mediaLimiter } = require('./core/rate-limit');

const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  // Render (and most PaaS hosts) terminate TLS at a proxy in front of the
  // app; without this, express-session sees plain HTTP and a `secure`
  // cookie would never be sent back by the browser.
  if (isProduction) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use(express.json());
  app.use(session({
    store: new SqliteSessionStore(),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 },
  }));

  app.get('/health', (req, res) => res.json({ ok: true, identity: 'OmniAgent' }));
  app.use('/register', authLimiter);
  app.use('/login', authLimiter);
  app.use(['/chat', '/history', '/pinned', '/queries'], chatLimiter);
  app.use(['/generate-image', '/transcribe', '/analyze-file'], mediaLimiter);
  app.use(['/finance', '/news'], chatLimiter);
  app.use(authRouter);
  app.use(chatRouter);
  app.use(mediaRouter);
  app.use(filesRouter);
  app.use(financeNewsRouter);

  // Single-service deployment: serve the built React app from the same
  // Express process (client/dist, produced by `npm run build` in client/).
  // In local dev this directory won't exist -- the Vite dev server handles
  // the frontend instead, so this branch is skipped entirely.
  if (require('node:fs').existsSync(CLIENT_DIST)) {
    // Vite fingerprints built assets (assets/*.js, *.css) with content
    // hashes, so they're safe to cache indefinitely; only index.html (the
    // catch-all below) must always be revalidated.
    app.use(express.static(CLIENT_DIST, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  return app;
}

if (require.main === module) {
  // Validates type/format only (a typo'd PORT or malformed OLLAMA_BASE_URL
  // fails fast with a clear message); the two checks below are cross-field
  // business rules envalid's per-var validation can't express on its own.
  let env;
  try {
    env = require('./core/env').validateEnv();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  if (env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    console.error('SESSION_SECRET is required in production -- refusing to start with the public dev-secret fallback.');
    process.exit(1);
  }
  const hasLocalModel = !!env.LOCAL_CODING_MODEL || !!env.LOCAL_GENERAL_MODEL;
  const hasOpenRouter = !!env.OPENROUTER_API_KEY;
  if (!hasLocalModel && !hasOpenRouter) {
    console.error('No backend configured. Set LOCAL_CODING_MODEL/LOCAL_GENERAL_MODEL (Ollama) and/or OPENROUTER_API_KEY in .env before starting.');
    process.exit(1);
  }
  const app = createApp();
  app.listen(env.PORT, () => console.log(`OmniAgent server listening on ${env.PORT}`));
}

module.exports = { createApp };
