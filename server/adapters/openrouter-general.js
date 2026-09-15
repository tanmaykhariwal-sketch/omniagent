const { createCloudAdapter } = require('../cloud-adapter');

module.exports = createCloudAdapter({
  name: 'openrouter-general',
  modelEnvVar: 'OPENROUTER_GENERAL_MODEL',
  systemPrompt: 'You are OmniAgent, a helpful, knowledgeable, and direct assistant. Give clear, accurate, well-organized answers.',
});
