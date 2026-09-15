const { classify } = require('./classify');
const { decideCategories, synthesize } = require('./lead');
const ollamaCoding = require('./adapters/ollama-coding');
const ollamaGeneral = require('./adapters/ollama-general');
const openrouterCoding = require('./adapters/openrouter-coding');
const openrouterGeneral = require('./adapters/openrouter-general');
const openrouterHy3 = require('./adapters/openrouter-hy3');

// Local Ollama adapters are tried first when configured (free, instant, no
// rate limit -- ideal for local dev). OpenRouter's free-tier adapters are
// listed after them, so on a host with no local model configured (e.g. a
// Render deployment, which has no Ollama server) they pick up automatically
// -- same code path, no environment-specific branching. openrouter-hy3 is
// opt-in (OPENROUTER_HY3_MODEL unset by default) and sits last: one more
// free-tier fallback for when the primary OpenRouter models are rate-limited.
const DEFAULT_ADAPTERS = [ollamaCoding, ollamaGeneral, openrouterCoding, openrouterGeneral, openrouterHy3];

// Category -> primary specialist. If the primary isn't configured/running,
// or its call fails, the router falls through the rest of DEFAULT_ADAPTERS.
const CATEGORY_PRIMARY = {
  coding: 'ollama-coding',
  summarization: 'ollama-general',
  creative: 'ollama-general',
  classification: 'ollama-general',
  translation: 'ollama-general',
  fast: 'ollama-general',
  general: 'ollama-general',
};

function buildRouter(adapters, options = {}) {
  const classifyFn = options.classify || classify;
  const categoryPrimary = options.categoryPrimary || CATEGORY_PRIMARY;
  const decideCategoriesFn = options.decideCategories || decideCategories;
  const synthesizeFn = options.synthesize || synthesize;

  async function answerCategory(prompt, category, configured) {
    const primaryName = categoryPrimary[category];
    const primary = configured.find((a) => a.name === primaryName);
    const rest = configured.filter((a) => a.name !== primaryName);
    const order = primary ? [primary, ...rest] : rest;

    for (const adapter of order) {
      try {
        const text = await adapter.send(prompt);
        return { category, text, backendUsed: adapter.name };
      } catch (err) {
        console.warn(`[router] ${adapter.name} failed for category "${category}": ${err.message}`);
        continue;
      }
    }
    return null;
  }

  return {
    async route(prompt) {
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
        const result = await answerCategory(prompt, category, configured);
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

module.exports = { buildRouter, route: defaultRouter.route, CATEGORY_PRIMARY };
