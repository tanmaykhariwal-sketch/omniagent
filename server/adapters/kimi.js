const NAME = 'kimi';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.KIMI_API_KEY,
  async send(prompt) {
    const res = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'kimi-k2-0711-preview',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`kimi http ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },
};
