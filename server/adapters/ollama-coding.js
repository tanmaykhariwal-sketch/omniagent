const { createLocalAdapter } = require('../local-adapter');

module.exports = createLocalAdapter({
  name: 'ollama-coding',
  modelEnvVar: 'LOCAL_CODING_MODEL',
  systemPrompt:
    'You are a senior, professional software engineer, expert in every widely-used programming language and its idioms, tooling, and best practices. Give correct, idiomatic, well-explained answers for whichever language the question involves.',
});
