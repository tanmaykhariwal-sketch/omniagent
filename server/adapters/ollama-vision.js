const { fetchWithTimeout } = require('../core/fetch-timeout');

const NAME = 'ollama-vision';
const BASE_URL_ENV = 'OLLAMA_BASE_URL';
const MODEL_ENV = 'LOCAL_VISION_MODEL';
const VISION_TIMEOUT_MS = 60000;

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env[MODEL_ENV],
  // Returns a plain-text description of the image -- image input doesn't
  // fit the chat send(prompt) -> string contract used by the text adapters,
  // so this is called directly by server/files.js. Requires a multimodal
  // Ollama model (e.g. `ollama pull llava`) set via LOCAL_VISION_MODEL --
  // there is no free cloud vision provider currently available on Hugging
  // Face's hf-inference tier (verified live: zero models for
  // image-to-text/visual-question-answering as of 2026-09-17), so this
  // stays local-only rather than reusing the hf-image.js cloud pattern.
  async caption(buffer, question) {
    const baseUrl = process.env[BASE_URL_ENV] || 'http://localhost:11434';
    const model = process.env[MODEL_ENV];
    const res = await fetchWithTimeout(
      `${baseUrl}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            {
              role: 'user',
              content: question || 'Describe this image in detail.',
              images: [buffer.toString('base64')],
            },
          ],
        }),
      },
      VISION_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`${NAME} http ${res.status}`);
    const data = await res.json();
    const text = data.message?.content;
    if (!text) throw new Error(`${NAME} returned no description`);
    return text;
  },
};
