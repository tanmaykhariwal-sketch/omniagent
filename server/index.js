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
  const hasAnyKey = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'MISTRAL_API_KEY', 'COHERE_API_KEY', 'KIMI_API_KEY', 'HF_API_KEY', 'LOCAL_CODING_MODEL']
    .some((k) => !!process.env[k]);
  if (!hasAnyKey) {
    console.error('No backend configured. Set at least one API key, or LOCAL_CODING_MODEL for a local Ollama model, in .env before starting.');
    process.exit(1);
  }
  const app = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`OmniAgent server listening on ${port}`));
}

module.exports = { createApp };
