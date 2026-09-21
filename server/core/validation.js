const { z } = require('zod');

const MAX_PROMPT_LENGTH = 4000;

const chatBodySchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'prompt required')
    .max(MAX_PROMPT_LENGTH, `prompt too long (max ${MAX_PROMPT_LENGTH} characters)`),
  persona: z.string().optional(),
  webSearch: z.boolean().optional(),
});

const pinBodySchema = z.object({
  pinned: z.boolean({ error: 'pinned must be a boolean' }),
});

const feedbackBodySchema = z.object({
  feedback: z.enum(['up', 'down'], { error: "feedback must be 'up', 'down', or null" }).nullable(),
});

// Express middleware: validates req.body against a zod schema, replacing
// req.body with the parsed (and, for prompt, trimmed) result on success, or
// responding 400 with the first validation issue's message on failure --
// centralizing the ad hoc `typeof x === 'string'` checks that were
// previously duplicated per-route.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body || {});
    if (!result.success) {
      return res.status(400).json({ error: result.error.issues[0].message });
    }
    req.body = result.data;
    next();
  };
}

module.exports = { MAX_PROMPT_LENGTH, chatBodySchema, pinBodySchema, feedbackBodySchema, validateBody };
