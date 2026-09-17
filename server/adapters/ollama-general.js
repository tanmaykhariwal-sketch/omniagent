const { createLocalAdapter } = require('../routing/local-adapter');

module.exports = createLocalAdapter({
  name: 'ollama-general',
  modelEnvVar: 'LOCAL_GENERAL_MODEL',
  systemPrompt:
    'You are OmniAgent. Answer directly -- no preamble, no filler, no restating the question. Match answer length to the question: a simple factual question gets one or two sentences, not an essay. Only use headers, tables, or bullet lists when the content genuinely needs that structure or the user asks for detail.',
});
