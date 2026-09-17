const express = require('express');
const multer = require('multer');
const { requireAuth } = require('./auth');
const hfImage = require('../adapters/hf-image');
const hfWhisper = require('../adapters/hf-whisper');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const MAX_IMAGE_PROMPT_LENGTH = 1000;

const mediaRouter = express.Router();

// Text-to-speech is deliberately NOT a backend route: Hugging Face's free
// hf-inference provider has zero text-to-speech models available (confirmed
// live against https://huggingface.co/api/models?pipeline_tag=text-to-speech
// &inference_provider=hf-inference -- empty list). The browser's built-in
// Web Speech Synthesis API (client/src/speech.js) covers this instead: free,
// no API key, no server round-trip, works on any deployed host.

mediaRouter.post('/generate-image', requireAuth, async (req, res) => {
  const raw = req.body || {};
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (prompt.length > MAX_IMAGE_PROMPT_LENGTH) {
    return res.status(400).json({ error: `prompt too long (max ${MAX_IMAGE_PROMPT_LENGTH} characters)` });
  }
  if (!hfImage.isConfigured()) {
    return res.status(503).json({ error: 'OmniAgent image generation is temporarily unavailable' });
  }

  try {
    const { base64, mimeType } = await hfImage.generate(prompt);
    res.json({ image: `data:${mimeType};base64,${base64}` });
  } catch (err) {
    console.warn(`[media] image generation failed: ${err.message}`);
    res.status(503).json({ error: 'OmniAgent image generation is temporarily unavailable, try again shortly' });
  }
});

mediaRouter.post('/transcribe', requireAuth, upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'audio file required' });
  if (!hfWhisper.isConfigured()) {
    return res.status(503).json({ error: 'OmniAgent transcription is temporarily unavailable' });
  }

  try {
    const text = await hfWhisper.transcribe(req.file.buffer, req.file.mimetype);
    res.json({ text });
  } catch (err) {
    console.warn(`[media] transcription failed: ${err.message}`);
    res.status(503).json({ error: 'OmniAgent transcription is temporarily unavailable, try again shortly' });
  }
});

module.exports = { mediaRouter };
