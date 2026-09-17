const { createCloudAdapter } = require('../routing/cloud-adapter');

module.exports = createCloudAdapter({
  name: 'openrouter-hy3',
  modelEnvVar: 'OPENROUTER_HY3_MODEL',
  systemPrompt: 'You are OmniAgent, a helpful, knowledgeable, and direct assistant. Give clear, accurate, well-organized answers.',
});
