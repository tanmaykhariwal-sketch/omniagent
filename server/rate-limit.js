const rateLimit = require('express-rate-limit');

// Generous enough not to trip during normal use or tests, tight enough to
// blunt brute-force login attempts and runaway free-tier quota burn on /chat.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many attempts, try again later' },
});

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many requests, slow down' },
});

module.exports = { authLimiter, chatLimiter };
