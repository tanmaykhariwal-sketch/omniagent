const { cleanEnv, str, port, url } = require('envalid');

// Validates the shape/type of env vars OmniAgent actually reads (a typo'd
// PORT or malformed OLLAMA_BASE_URL now fails fast with a clear message
// instead of surfacing as a confusing runtime error later). This only
// covers type/format validation -- the cross-field business rules (at
// least one backend configured, SESSION_SECRET required in production)
// stay in server/index.js since envalid validates each var independently.
function validateEnv(env = process.env) {
  // Some PaaS platforms materialize an unset env var as an empty string
  // rather than omitting the key -- envalid's `default` only kicks in when
  // a var is `undefined`, so OLLAMA_BASE_URL="" would otherwise fail the
  // url() validator instead of falling back to the local default.
  const normalizedEnv = { ...env };
  if (normalizedEnv.OLLAMA_BASE_URL === '') delete normalizedEnv.OLLAMA_BASE_URL;

  return cleanEnv(
    normalizedEnv,
    {
      NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
      PORT: port({ default: 3000 }),
      SESSION_SECRET: str({ default: 'dev-secret' }),
      OLLAMA_BASE_URL: url({ default: 'http://localhost:11434' }),
      LOCAL_CODING_MODEL: str({ default: '' }),
      LOCAL_GENERAL_MODEL: str({ default: '' }),
      LOCAL_VISION_MODEL: str({ default: '' }),
      OPENROUTER_API_KEY: str({ default: '' }),
      HF_API_KEY: str({ default: '' }),
    },
    {
      // envalid's default reporter calls process.exit(1) on failure, which
      // would kill the test runner rather than let it assert the failure --
      // throw instead, and let the one real caller (server/index.js's boot
      // sequence) decide how to exit.
      reporter: ({ errors }) => {
        const messages = Object.entries(errors).map(([key, err]) => `${key}: ${err.message}`);
        if (messages.length > 0) throw new Error(`Invalid environment variables:\n${messages.join('\n')}`);
      },
    }
  );
}

module.exports = { validateEnv };
