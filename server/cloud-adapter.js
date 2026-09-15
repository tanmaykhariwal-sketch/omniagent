const { fetchWithTimeout } = require('./fetch-timeout');

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

function createCloudAdapter({ name, modelEnvVar, systemPrompt }) {
  return {
    name,
    isConfigured: () => !!process.env.OPENROUTER_API_KEY && !!process.env[modelEnvVar],
    async send(prompt) {
      const model = process.env[modelEnvVar];
      const baseUrl = process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL;
      const res = await fetchWithTimeout(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://omniagent.local',
          'X-Title': 'OmniAgent',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`${name} http ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    },
  };
}

module.exports = { createCloudAdapter };
