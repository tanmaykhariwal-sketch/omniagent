const { fetchWithTimeout } = require('../fetch-timeout');
const NAME = 'anthropic';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.ANTHROPIC_API_KEY,
  async send(prompt) {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic http ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text || '';
  },
};
