const NAME = 'openai';

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.OPENAI_API_KEY,
  async send(prompt) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`openai http ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  },
};
