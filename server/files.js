const express = require('express');
const multer = require('multer');
const { requireAuth } = require('./auth');
const { extractText } = require('./file-extract');
const { route, DEFAULT_ADAPTERS } = require('./router');
const { getDb } = require('./db');
const { getMemoryContext, extractAndSaveMemory } = require('./memory');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const MAX_QUESTION_LENGTH = 1000;

const filesRouter = express.Router();

filesRouter.post('/analyze-file', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });

  const raw = req.body || {};
  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `question too long (max ${MAX_QUESTION_LENGTH} characters)` });
  }

  let documentText;
  try {
    documentText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const prompt = `Document (${req.file.originalname}):\n\n${documentText}\n\n${question || 'Summarize this document.'}`;

  try {
    const memoryContext = getMemoryContext(req.session.userId);
    const { text, backendUsed, category } = await route(prompt, memoryContext);
    const db = getDb();
    const displayPrompt = `[${req.file.originalname}] ${question || 'Summarize this document.'}`;
    db.prepare('INSERT INTO queries (user_id, prompt, response, backend_used, category, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.session.userId, displayPrompt, text, backendUsed, category, new Date().toISOString());
    res.json({ response: text });
    const preferredAdapter = DEFAULT_ADAPTERS.find((a) => a.name === backendUsed);
    extractAndSaveMemory(req.session.userId, displayPrompt, text, preferredAdapter).catch(() => {});
  } catch (err) {
    res.status(503).json({ error: 'OmniAgent is temporarily unavailable, try again shortly' });
  }
});

module.exports = { filesRouter };
