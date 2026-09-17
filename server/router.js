const { classify } = require('./classify');
const { decideCategories, synthesize } = require('./lead');
const { isSafetyClassifierArtifact } = require('./response-sanity');
const ollamaCoding = require('./adapters/ollama-coding');
const ollamaGeneral = require('./adapters/ollama-general');
const openrouterCoding = require('./adapters/openrouter-coding');
const openrouterGeneral = require('./adapters/openrouter-general');
const openrouterHy3 = require('./adapters/openrouter-hy3');

// OpenRouter's free-tier adapters are tried first when configured: a
// reachable cloud API responds in a couple seconds, while a local Ollama
// call on modest (CPU-only) hardware can take 10-20s+ per attempt. Ollama
// adapters sit after them as the fallback -- if OpenRouter can't be reached
// at all (offline, or the service is down), that failure surfaces fast
// (DNS/connection error, not a slow timeout) and the router falls through to
// the local model, which keeps working with no internet. On a host with no
// local model configured at all (e.g. a Render deployment, which has no
// Ollama server), Ollama is simply never in the configured list -- same code
// path, no environment-specific branching. openrouter-hy3 is opt-in
// (OPENROUTER_HY3_MODEL unset by default) and sits last: one more free-tier
// fallback for when the primary OpenRouter models are rate-limited.
const DEFAULT_ADAPTERS = [openrouterCoding, openrouterGeneral, ollamaCoding, ollamaGeneral, openrouterHy3];

// Category -> ordered list of specialist candidates (cloud first, then the
// local equivalent -- see DEFAULT_ADAPTERS above for why). The router uses
// the first NAME in this list that's actually configured -- e.g. on a host
// with no local model, "coding" resolves straight to openrouter-coding. If
// that resolved primary still fails at request time, the router falls
// through the rest of DEFAULT_ADAPTERS as before.
const CATEGORY_PRIMARY = {
  coding: ['openrouter-coding', 'ollama-coding'],
  summarization: ['openrouter-general', 'ollama-general'],
  creative: ['openrouter-general', 'ollama-general'],
  classification: ['openrouter-general', 'ollama-general'],
  translation: ['openrouter-general', 'ollama-general'],
  fast: ['openrouter-general', 'ollama-general'],
  general: ['openrouter-general', 'ollama-general'],
};

function buildRouter(adapters, options = {}) {
  const classifyFn = options.classify || classify;
  const categoryPrimary = options.categoryPrimary || CATEGORY_PRIMARY;
  const decideCategoriesFn = options.decideCategories || decideCategories;
  const synthesizeFn = options.synthesize || synthesize;

  async function answerCategory(prompt, category, configured, memoryContext) {
    const candidateNames = categoryPrimary[category] || [];
    const primary = candidateNames
      .map((name) => configured.find((a) => a.name === name))
      .find((a) => a);
    const rest = configured.filter((a) => a !== primary);
    const order = primary ? [primary, ...rest] : rest;

    for (const adapter of order) {
      try {
        const text = await adapter.send(prompt, memoryContext);
        // OpenRouter's free auto-router can land on a safety/moderation
        // model instead of a real one, which ignores the prompt entirely
        // and returns its own fixed-format output. Treat that the same as
        // any other adapter failure -- fall through rather than hand the
        // user a broken answer.
        if (isSafetyClassifierArtifact(text)) {
          console.warn(`[router] ${adapter.name} returned a safety-classifier artifact for category "${category}", falling through`);
          continue;
        }
        return { category, text, backendUsed: adapter.name };
      } catch (err) {
        console.warn(`[router] ${adapter.name} failed for category "${category}": ${err.message}`);
        continue;
      }
    }
    return null;
  }

  return {
    async route(prompt, memoryContext) {
      const configured = adapters.filter((a) => a.isConfigured());

      let categories;
      try {
        categories = await decideCategoriesFn(prompt, configured);
      } catch (err) {
        console.warn(`[router] lead dispatch failed, falling back to keyword classifier: ${err.message}`);
        categories = [classifyFn(prompt)];
      }

      const results = [];
      for (const category of categories) {
        const result = await answerCategory(prompt, category, configured, memoryContext);
        if (result) results.push(result);
      }

      if (results.length === 0) throw new Error('all backends unavailable');

      if (results.length === 1) {
        return { text: results[0].text, backendUsed: results[0].backendUsed, category: results[0].category };
      }

      try {
        const text = await synthesizeFn(prompt, results, configured);
        return {
          text,
          backendUsed: results.map((r) => r.backendUsed).join('+'),
          category: results.map((r) => r.category).join('+'),
        };
      } catch (err) {
        console.warn(`[router] synthesis failed, returning first specialist's answer alone: ${err.message}`);
        return { text: results[0].text, backendUsed: results[0].backendUsed, category: results[0].category };
      }
    },
  };
}

const defaultRouter = buildRouter(DEFAULT_ADAPTERS);

module.exports = { buildRouter, route: defaultRouter.route, CATEGORY_PRIMARY, DEFAULT_ADAPTERS };
