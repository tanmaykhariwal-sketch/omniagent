const express = require('express');
const { requireAuth } = require('./auth');
const { route, DEFAULT_ADAPTERS } = require('../routing/router');
const { getDb } = require('../core/db');
const { getMemoryContext, extractAndSaveMemory } = require('../services/memory');
const { getPersonaInstruction } = require('../services/personas');
const { getFollowUpSuggestions } = require('../services/suggestions');
const { getWebGroundingContext } = require('../services/web-grounding');

const chatRouter = express.Router();

const MAX_PROMPT_LENGTH = 4000;

const MAX_HISTORY = 50;

chatRouter.get('/history', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, prompt, response, created_at, pinned, feedback FROM queries WHERE user_id = ? ORDER BY created_at ASC LIMIT ?')
    .all(req.session.userId, MAX_HISTORY);
  res.json({ history: rows });
});

chatRouter.get('/pinned', requireAuth, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, prompt, response, created_at FROM queries WHERE user_id = ? AND pinned = 1 ORDER BY created_at DESC LIMIT ?')
    .all(req.session.userId, MAX_HISTORY);
  res.json({ pinned: rows });
});

chatRouter.post('/queries/:id/pin', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'invalid query id' });
  }
  if (typeof (req.body && req.body.pinned) !== 'boolean') {
    return res.status(400).json({ error: 'pinned must be a boolean' });
  }
  const pinned = req.body.pinned ? 1 : 0;
  const db = getDb();
  const result = db
    .prepare('UPDATE queries SET pinned = ? WHERE id = ? AND user_id = ?')
    .run(pinned, id, req.session.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'query not found' });
  }
  res.json({ ok: true });
});

chatRouter.post('/queries/:id/feedback', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'invalid query id' });
  }
  const feedback = req.body && req.body.feedback;
  if (feedback !== 'up' && feedback !== 'down' && feedback !== null) {
    return res.status(400).json({ error: "feedback must be 'up', 'down', or null" });
  }
  const db = getDb();
  const result = db
    .prepare('UPDATE queries SET feedback = ? WHERE id = ? AND user_id = ?')
    .run(feedback, id, req.session.userId);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'query not found' });
  }
  res.json({ ok: true });
});

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
    const memoryContext = getMemoryContext(req.session.userId);
    const personaInstruction = getPersonaInstruction(raw.persona);
    const grounding = raw.webSearch === true ? await getWebGroundingContext(prompt) : null;
    const extraContext =
      [personaInstruction, grounding?.context, memoryContext].filter(Boolean).join('\n\n') || null;
    const { text, backendUsed, category } = await route(prompt, extraContext);
    const db = getDb();
    const insertResult = db
      .prepare('INSERT INTO queries (user_id, prompt, response, backend_used, category, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.session.userId, prompt, text, backendUsed, category, new Date().toISOString());
    // Reuse whichever adapter just answered (a known-working model) for both
    // memory extraction and follow-up suggestions, rather than an unrelated
    // fresh pick -- see server/memory.js for why that matters.
    const preferredAdapter = DEFAULT_ADAPTERS.find((a) => a.name === backendUsed);
    const suggestions = await getFollowUpSuggestions(prompt, text, preferredAdapter).catch(() => []);
    res.json({
      response: text,
      suggestions,
      queryId: Number(insertResult.lastInsertRowid),
      sources: grounding?.sources || [],
    });
    // Fire-and-forget: extracting a durable fact is a "nice to have" that
    // must never delay or break the response the user is waiting on.
    extractAndSaveMemory(req.session.userId, prompt, text, preferredAdapter).catch(() => {});
  } catch (err) {
    res.status(503).json({ error: 'OmniAgent is temporarily unavailable, try again shortly' });
  }
});

module.exports = { chatRouter };
