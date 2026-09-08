const NAME = 'mistral';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.MISTRAL_API_KEY,
  async send(prompt) {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`mistral http ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },
};
