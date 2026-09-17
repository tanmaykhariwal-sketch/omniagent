const ollamaGeneral = require('./adapters/ollama-general');
const openrouterGeneral = require('./adapters/openrouter-general');

// Cloud first, same reasoning as router.js and memory.js.
const SUGGESTION_ADAPTERS = [openrouterGeneral, ollamaGeneral];

const MAX_SUGGESTIONS = 3;
const MAX_SUGGESTION_LENGTH = 120;
// Each adapter's own send() already has its own ~20s HTTP timeout, but a
// "nice to have" feature riding on the same response the user is waiting
// on shouldn't get anywhere near that -- cap it much shorter so a slow
// suggestions call degrades to an empty list quickly instead of adding
// real delay on top of an already-completed main answer.
const SUGGESTION_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(''), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const SUGGEST_SYSTEM_PROMPT =
  `Based on this exchange, suggest up to ${MAX_SUGGESTIONS} short, natural follow-up questions the user might want to ask next. Reply with ONLY a JSON array of strings, nothing else -- no explanation, no markdown fences. If no good follow-up exists, reply with an empty array: []`;

function parseSuggestions(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((s) => typeof s === 'string' && s.trim().length > 0 && s.length <= MAX_SUGGESTION_LENGTH)
    .slice(0, MAX_SUGGESTIONS);
}

// Never throws -- a failure here must never break the chat response it
// rides alongside. Reuses whichever adapter just answered (see
// server/memory.js for why: a fresh pick can land on an unrelated model
// that ignores the instruction entirely).
async function getFollowUpSuggestions(prompt, response, preferredAdapter) {
  const pool = preferredAdapter ? [preferredAdapter, ...SUGGESTION_ADAPTERS] : SUGGESTION_ADAPTERS;
  const seen = new Set();
  const configured = pool.filter((a) => a.isConfigured() && !seen.has(a.name) && seen.add(a.name));
  const exchange = `User: ${prompt}\nAssistant: ${response}`;

  for (const adapter of configured) {
    try {
      const raw = await withTimeout(adapter.send(exchange, SUGGEST_SYSTEM_PROMPT), SUGGESTION_TIMEOUT_MS);
      const suggestions = parseSuggestions(raw);
      if (suggestions.length > 0) return suggestions;
    } catch {
      continue;
    }
  }
  return [];
}

module.exports = { getFollowUpSuggestions, parseSuggestions, MAX_SUGGESTIONS };
