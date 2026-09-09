const { createLocalAdapter } = require('../local-adapter');

module.exports = createLocalAdapter({
  name: 'ollama-general',
  modelEnvVar: 'LOCAL_GENERAL_MODEL',
  systemPrompt: 'You are OmniAgent, a helpful, knowledgeable, and direct assistant. Give clear, accurate, well-organized answers.',
});
