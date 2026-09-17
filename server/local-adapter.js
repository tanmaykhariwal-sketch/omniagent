const { fetchWithTimeout } = require('./fetch-timeout');

const BASE_URL_ENV = 'OLLAMA_BASE_URL';

function createLocalAdapter({ name, modelEnvVar, systemPrompt }) {
  return {
    name,
    isConfigured: () => !!process.env[modelEnvVar],
    async send(prompt, extraContext) {
      const baseUrl = process.env[BASE_URL_ENV] || 'http://localhost:11434';
      const model = process.env[modelEnvVar];
      const res = await fetchWithTimeout(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: extraContext ? `${systemPrompt}\n\n${extraContext}` : systemPrompt },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`${name} http ${res.status}`);
      const data = await res.json();
      return data.message?.content || '';
    },
  };
}

module.exports = { createLocalAdapter };
