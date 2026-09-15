require('dotenv').config();
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const { SqliteSessionStore } = require('./sqlite-session-store');
const { authRouter } = require('./auth');
const { chatRouter } = require('./chat');
const { mediaRouter } = require('./media');
const { financeNewsRouter } = require('./finance-news');
const { authLimiter, chatLimiter, mediaLimiter } = require('./rate-limit');

const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  // Render (and most PaaS hosts) terminate TLS at a proxy in front of the
  // app; without this, express-session sees plain HTTP and a `secure`
  // cookie would never be sent back by the browser.
  if (isProduction) app.set('trust proxy', 1);

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
  app.use('/chat', chatLimiter);
  app.use(['/generate-image', '/transcribe'], mediaLimiter);
  app.use(['/finance', '/news'], chatLimiter);
  app.use(authRouter);
  app.use(chatRouter);
  app.use(mediaRouter);
  app.use(financeNewsRouter);

  // Single-service deployment: serve the built React app from the same
  // Express process (client/dist, produced by `npm run build` in client/).
  // In local dev this directory won't exist -- the Vite dev server handles
  // the frontend instead, so this branch is skipped entirely.
  if (require('node:fs').existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
  }

  return app;
}

if (require.main === module) {
  const hasLocalModel = ['LOCAL_CODING_MODEL', 'LOCAL_GENERAL_MODEL'].some((k) => !!process.env[k]);
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  if (!hasLocalModel && !hasOpenRouter) {
    console.error('No backend configured. Set LOCAL_CODING_MODEL/LOCAL_GENERAL_MODEL (Ollama) and/or OPENROUTER_API_KEY in .env before starting.');
    process.exit(1);
  }
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`OmniAgent server listening on ${port}`));
}

module.exports = { createApp };
