const { fetchWithTimeout } = require('../fetch-timeout');
const NAME = 'cohere';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.COHERE_API_KEY,
  async send(prompt) {
    const res = await fetchWithTimeout('https://api.cohere.com/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
      },
      body: JSON.stringify({ model: 'command-r', message: prompt }),
    });
    if (!res.ok) throw new Error(`cohere http ${res.status}`);
    const data = await res.json();
    return data.text || '';
  },
};
