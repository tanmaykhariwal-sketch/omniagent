const { fetchWithTimeout } = require('../fetch-timeout');
const NAME = 'huggingface';
const MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.HF_API_KEY,
  async send(prompt) {
    const res = await fetchWithTimeout(`https://api-inference.huggingface.co/models/${MODEL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
      },
      body: JSON.stringify({ inputs: prompt }),
    });
    if (!res.ok) throw new Error(`huggingface http ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data[0]?.generated_text || '' : data.generated_text || '';
  },
};
