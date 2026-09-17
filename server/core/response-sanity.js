// OpenRouter's free-tier "auto-router" models (e.g. openrouter/free) can
// land on a safety/moderation model instead of a real chat model. That
// model ignores whatever instruction it was given and returns its own
// fixed-format classification output (e.g. "User Safety: safe\nResponse
// Safety: safe") instead of an actual answer. Confirmed live: this hit a
// memory-extraction call first, and later a real user-facing chat answer.
// Detect that specific pattern so callers can treat it as a failed
// response and fall through to the next adapter, rather than accepting
// it as a genuine answer.
function isSafetyClassifierArtifact(text) {
  return /^(user|response)\s*safety\s*:/im.test(text);
}

module.exports = { isSafetyClassifierArtifact };
