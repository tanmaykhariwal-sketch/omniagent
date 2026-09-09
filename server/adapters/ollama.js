const { fetchWithTimeout } = require('../fetch-timeout');

const NAME = 'ollama';
const BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL = process.env.LOCAL_CODING_MODEL;

const SYSTEM_PROMPT =
  'You are a senior, professional software engineer, expert in every widely-used programming language and its idioms, tooling, and best practices. Give correct, idiomatic, well-explained answers for whichever language the question involves.';

module.exports = {
  name: NAME,
  isConfigured: () => !!MODEL,
  async send(prompt) {
    const res = await fetchWithTimeout(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`ollama http ${res.status}`);
    const data = await res.json();
    return data.message?.content || '';
  },
};
