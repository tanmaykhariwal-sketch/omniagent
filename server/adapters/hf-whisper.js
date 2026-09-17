const { fetchWithTimeout } = require('../core/fetch-timeout');

const NAME = 'hf-whisper';
const DEFAULT_BASE_URL = 'https://router.huggingface.co/hf-inference/models';
const AUDIO_TIMEOUT_MS = 60000;

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.HF_API_KEY,
  // Takes raw audio bytes + its mime type, returns transcribed text. Doesn't
  // fit the chat send(prompt) -> string contract (input is audio, not a
  // prompt string), so it's called directly by server/media.js.
  async transcribe(audioBuffer, mimeType) {
    const model = process.env.HF_STT_MODEL || 'openai/whisper-large-v3-turbo';
    const baseUrl = process.env.HF_INFERENCE_BASE_URL || DEFAULT_BASE_URL;
    const res = await fetchWithTimeout(
      `${baseUrl}/${model}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': mimeType || 'audio/wav',
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
        },
        body: audioBuffer,
      },
      AUDIO_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`${NAME} http ${res.status}`);
    const data = await res.json();
    return data.text || '';
  },
};
