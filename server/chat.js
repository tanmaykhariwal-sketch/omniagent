const express = require('express');
const { requireAuth } = require('./auth');
const { route } = require('./router');
const { getDb } = require('./db');

const chatRouter = express.Router();

const MAX_PROMPT_LENGTH = 4000;

chatRouter.post('/chat', requireAuth, async (req, res) => {
  const raw = req.body || {};
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: `prompt too long (max ${MAX_PROMPT_LENGTH} characters)` });
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
