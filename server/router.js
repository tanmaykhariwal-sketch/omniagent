const { classify } = require('./classify');
const anthropic = require('./adapters/anthropic');
const openai = require('./adapters/openai');
const gemini = require('./adapters/gemini');
const mistral = require('./adapters/mistral');
const cohere = require('./adapters/cohere');
const kimi = require('./adapters/kimi');
const huggingface = require('./adapters/huggingface');
const ollamaCoding = require('./adapters/ollama-coding');
const ollamaGeneral = require('./adapters/ollama-general');

const DEFAULT_ADAPTERS = [openai, anthropic, gemini, kimi, mistral, cohere, huggingface, ollamaCoding, ollamaGeneral];

// Free local models (Ollama) are the default everywhere; cloud backends are
// the fallback if a local model isn't configured/running or its call fails.
const CATEGORY_PRIMARY = {
  coding: 'ollama-coding',
  summarization: 'ollama-general',
  creative: 'ollama-general',
  classification: 'ollama-general',
  fast: 'ollama-general',
  general: 'ollama-general',
};

function buildRouter(adapters, options = {}) {
  const classifyFn = options.classify || classify;
  const categoryPrimary = options.categoryPrimary || CATEGORY_PRIMARY;

  return {
    async route(prompt) {
      const configured = adapters.filter((a) => a.isConfigured());
      const category = classifyFn(prompt);
      const primaryName = categoryPrimary[category];
      const primary = configured.find((a) => a.name === primaryName);
      const rest = configured.filter((a) => a.name !== primaryName);
      const order = primary ? [primary, ...rest] : rest;

      for (const adapter of order) {
        try {
          const text = await adapter.send(prompt);
          return { text, backendUsed: adapter.name, category };
        } catch (err) {
          console.warn(`[router] ${adapter.name} failed for category "${category}": ${err.message}`);
          continue;
        }
      }
      throw new Error('all backends unavailable');
    },
  };
}

const defaultRouter = buildRouter(DEFAULT_ADAPTERS);

module.exports = { buildRouter, route: defaultRouter.route, CATEGORY_PRIMARY };
