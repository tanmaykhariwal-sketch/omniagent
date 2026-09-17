// Persona instructions are defined server-side, not accepted as free-text
// from the client -- the client only ever sends a known id, keeping the
// actual system-prompt content out of user-controlled input.
const PERSONAS = {
  professional: 'Adopt a professional, formal tone: precise language, no slang, no emoji.',
  casual: 'Adopt a casual, friendly tone: relaxed language, contractions are fine, a bit of warmth.',
  creative: 'Adopt a creative, expressive tone: vivid language and imaginative framing, while staying accurate.',
  technical: 'Adopt a technical, expert-to-expert tone: precise terminology, assume a knowledgeable audience, skip beginner explanations unless asked.',
};

function getPersonaInstruction(id) {
  return PERSONAS[id] || null;
}

module.exports = { PERSONAS, getPersonaInstruction };
