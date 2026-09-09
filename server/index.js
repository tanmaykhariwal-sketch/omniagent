require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { SqliteSessionStore } = require('./sqlite-session-store');
const { authRouter } = require('./auth');
const { chatRouter } = require('./chat');
const { authLimiter, chatLimiter } = require('./rate-limit');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    store: new SqliteSessionStore(),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 },
  }));

  app.get('/health', (req, res) => res.json({ ok: true, identity: 'OmniAgent' }));
  app.use('/register', authLimiter);
  app.use('/login', authLimiter);
  app.use('/chat', chatLimiter);
  app.use(authRouter);
  app.use(chatRouter);

  return app;
}

if (require.main === module) {
  const hasAnyModel = ['LOCAL_CODING_MODEL', 'LOCAL_GENERAL_MODEL'].some((k) => !!process.env[k]);
  if (!hasAnyModel) {
    console.error('No local model configured. Set LOCAL_CODING_MODEL and/or LOCAL_GENERAL_MODEL in .env (see README) before starting.');
    process.exit(1);
  }
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`OmniAgent server listening on ${port}`));
}

module.exports = { createApp };
