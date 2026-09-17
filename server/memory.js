const { getDb } = require('./db');
const ollamaGeneral = require('./adapters/ollama-general');
const openrouterGeneral = require('./adapters/openrouter-general');

// Cloud first, same reasoning as router.js: fast when reachable, and a
// second try locally if it's not.
const MEMORY_ADAPTERS = [openrouterGeneral, ollamaGeneral];

const MAX_MEMORIES = 20;

const EXTRACT_SYSTEM_PROMPT =
  'Extract at most one short, durable fact about the user from this exchange that is worth remembering for future, separate conversations (their role, preferences, ongoing projects, identity, etc). Durable means it would still be true and useful weeks from now -- not a one-off request or the content of the assistant\'s answer. Reply with just the fact as one short sentence, or reply exactly NONE if there is nothing durable worth remembering.';

// Returns a compact "what we know about this user" block to prepend to a
// chat request's system prompt, or null if nothing is stored yet.
function getMemoryContext(userId) {
  const db = getDb();
  const rows = db
    .prepare('SELECT fact FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, MAX_MEMORIES);
  if (rows.length === 0) return null;
  return `What you already know about this user from past conversations:\n${rows.map((r) => `- ${r.fact}`).join('\n')}`;
}

// OpenRouter's free-tier "auto-router" models (e.g. openrouter/free) can
// land on a safety/moderation model instead of a normal chat model, which
// ignores the extraction instruction and returns its own fixed-format
// output (e.g. "User Safety: safe"). Reject anything that looks like that
// rather than a natural-language sentence.
function looksLikeFact(text) {
  if (/^(user|response)\s*safety\s*:/im.test(text)) return false;
  if (text.length > 300) return false;
  return true;
}

// Fire-and-forget: looks at one exchange and saves a fact if there's a
// durable one. Never throws -- a failure here must never break the chat
// response it runs alongside. `preferredAdapter`, when given, is tried
// first -- it's the adapter that just successfully answered the user, so
// it's a known-working model rather than a fresh, unpredictable pick.
async function extractAndSaveMemory(userId, prompt, response, preferredAdapter) {
  const pool = preferredAdapter ? [preferredAdapter, ...MEMORY_ADAPTERS] : MEMORY_ADAPTERS;
  const seen = new Set();
  const configured = pool.filter((a) => a.isConfigured() && !seen.has(a.name) && seen.add(a.name));
  const exchange = `User: ${prompt}\nAssistant: ${response}`;

  for (const adapter of configured) {
    try {
      const raw = await adapter.send(exchange, EXTRACT_SYSTEM_PROMPT);
      const fact = raw.trim();
      if (!fact || /^none\.?$/i.test(fact) || !looksLikeFact(fact)) return;

      const db = getDb();
      db.prepare('INSERT INTO memories (user_id, fact, created_at) VALUES (?, ?, ?)').run(
        userId,
        fact,
        new Date().toISOString()
      );
      return;
    } catch (err) {
      continue;
    }
  }
}

module.exports = { getMemoryContext, extractAndSaveMemory, EXTRACT_SYSTEM_PROMPT };
