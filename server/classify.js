const RULES = [
  {
    category: 'coding',
    pattern:
      /```|\bcode\b|\bfunction\b|\bdebug(ging)?\b|\bstack trace\b|\balgorithm\b|\bregex\b|\brefactor\b|\bcompile\b|\bsyntax error\b|\bunit test(s)?\b|\bexception\b|\b(npm|pip) install\b|\bpython\b|\bjavascript\b|\btypescript\b|\bjava\b|\bc\+\+\b|\bc#\b|\bgolang\b|\brust\b|\bruby\b|\bphp\b|\bswift\b|\bkotlin\b|\bsql\b|\bbash\b|\bshell script\b|\bhtml\b|\bcss\b/i,
  },
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
