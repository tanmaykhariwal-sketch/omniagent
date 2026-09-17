const express = require('express');
const multer = require('multer');
const { requireAuth } = require('./auth');
const { extractText } = require('./file-extract');
const ollamaVision = require('./adapters/ollama-vision');
const { route, DEFAULT_ADAPTERS } = require('./router');
const { getDb } = require('./db');
const { getMemoryContext, extractAndSaveMemory } = require('./memory');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const MAX_QUESTION_LENGTH = 1000;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const filesRouter = express.Router();

filesRouter.post('/analyze-file', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required' });

  const raw = req.body || {};
  const question = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (question.length > MAX_QUESTION_LENGTH) {
    return res.status(400).json({ error: `question too long (max ${MAX_QUESTION_LENGTH} characters)` });
  }

  const isImage = IMAGE_MIME_TYPES.has(req.file.mimetype);
  if (isImage && !ollamaVision.isConfigured()) {
    return res.status(503).json({
      error: 'Image analysis needs a local vision model -- set LOCAL_VISION_MODEL (e.g. after `ollama pull llava`)',
    });
  }

  const defaultQuestion = isImage ? 'Describe this image.' : 'Summarize this document.';
  const displayPrompt = `[${req.file.originalname}] ${question || defaultQuestion}`;

  // Images take a different path from documents: the local vision model
  // answers the question directly from the image bytes (no separate
  // caption-then-route step needed, unlike the text-extraction path below),
  // so it never goes through server/router.js and its adapter fallback.
  if (isImage) {
    try {
      const text = await ollamaVision.caption(req.file.buffer, question || defaultQuestion);
      const db = getDb();
      db.prepare('INSERT INTO queries (user_id, prompt, response, backend_used, category, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.session.userId, displayPrompt, text, ollamaVision.name, 'vision', new Date().toISOString());
      res.json({ response: text });
    } catch (err) {
      res.status(503).json({ error: 'OmniAgent image analysis is temporarily unavailable, try again shortly' });
    }
    return;
  }

  let prompt;
  try {
    const documentText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    prompt = `Document (${req.file.originalname}):\n\n${documentText}\n\n${question || defaultQuestion}`;
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const memoryContext = getMemoryContext(req.session.userId);
    const { text, backendUsed, category } = await route(prompt, memoryContext);
    const db = getDb();
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
