const { fetchWithTimeout } = require('../core/fetch-timeout');

const NAME = 'hf-image';
const DEFAULT_BASE_URL = 'https://router.huggingface.co/hf-inference/models';
const IMAGE_TIMEOUT_MS = 60000;

module.exports = {
  name: NAME,
  isConfigured: () => !!process.env.HF_API_KEY,
  // Returns a base64 PNG/JPEG string (no data: prefix), not text -- image
  // generation doesn't fit the chat send(prompt) -> string contract used by
  // the text adapters, so this is called directly by server/media.js rather
  // than through server/router.js.
  async generate(prompt) {
    const model = process.env.HF_IMAGE_MODEL || 'stabilityai/stable-diffusion-3-medium-diffusers';
    const baseUrl = process.env.HF_INFERENCE_BASE_URL || DEFAULT_BASE_URL;
    const res = await fetchWithTimeout(
      `${baseUrl}/${model}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.HF_API_KEY}`,
        },
        body: JSON.stringify({ inputs: prompt }),
      },
      IMAGE_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`${NAME} http ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      // The Inference API returns JSON (usually a "model loading" error)
      // instead of image bytes when something went wrong.
      const body = await res.text();
      throw new Error(`${NAME} did not return an image: ${body.slice(0, 200)}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { base64: buffer.toString('base64'), mimeType: contentType };
  },
};
