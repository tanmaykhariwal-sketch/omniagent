const VALID_CATEGORIES = ['coding', 'summarization', 'creative', 'classification', 'fast', 'general'];

const LEAD_SYSTEM_PROMPT = `You are a routing coordinator for a multi-specialist AI system with these categories:
- coding: programming, debugging, or technical code questions
- summarization: summarizing or analyzing text
- creative: brainstorming, stories, or creative writing
- classification: categorizing or labeling data
- fast: quick, simple factual questions
- general: anything else

Read the user's message below and decide which 1 or 2 categories of specialist should answer it. Respond with ONLY a JSON object, nothing else, in this exact shape: {"categories": ["coding"]} or {"categories": ["coding", "summarization"]}. Never list more than 2 categories.

User message:
`;

const SYNTHESIS_SYSTEM_PROMPT = `Combine the following expert responses into one single, clear, well-organized final answer for the user's original question below. Do not mention that multiple sources, specialists, or AI models were involved. Do not name any AI model or provider.

Original question:
`;

function parseCategories(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('lead response had no JSON');
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
    throw new Error('lead response had no categories');
  }
  const categories = [...new Set(parsed.categories.filter((c) => VALID_CATEGORIES.includes(c)))].slice(0, 2);
  if (categories.length === 0) throw new Error('lead response had no valid categories');
  return categories;
}

async function decideCategories(prompt, adapters) {
  for (const adapter of adapters) {
    try {
      const raw = await adapter.send(`${LEAD_SYSTEM_PROMPT}${prompt}`);
      return parseCategories(raw);
    } catch (err) {
      continue;
    }
  }
  throw new Error('no lead adapter available');
}

async function synthesize(prompt, results, adapters) {
  const labeled = results.map((r, i) => `Response ${i + 1}:\n${r.text}`).join('\n\n');
  const combinedPrompt = `${SYNTHESIS_SYSTEM_PROMPT}${prompt}\n\n${labeled}`;
  for (const adapter of adapters) {
    try {
      return await adapter.send(combinedPrompt);
    } catch (err) {
      continue;
    }
  }
  throw new Error('no adapter available for synthesis');
}

module.exports = { decideCategories, synthesize, parseCategories, VALID_CATEGORIES, LEAD_SYSTEM_PROMPT, SYNTHESIS_SYSTEM_PROMPT };
