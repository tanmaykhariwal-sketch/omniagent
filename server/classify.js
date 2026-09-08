const RULES = [
  { category: 'coding', pattern: /```|\bcode\b|\bfunction\b|\bdebug\b|\bstack trace\b|\bpython\b|\bjavascript\b|\balgorithm\b/i },
  { category: 'summarization', pattern: /\bsummarize\b|\bsummary\b|\banalyz(e|is)\b/i },
  { category: 'creative', pattern: /\bbrainstorm\b|\bstory\b|\bpoem\b|\bcreative\b|\bblog post\b/i },
  { category: 'classification', pattern: /\bclassify\b|\bcategoriz(e|ation)\b/i },
  { category: 'fast', pattern: /\bquick\b|\bshort answer\b/i },
];

function classify(prompt) {
  for (const rule of RULES) {
    if (rule.pattern.test(prompt)) return rule.category;
  }
  return 'general';
}

module.exports = { classify };
