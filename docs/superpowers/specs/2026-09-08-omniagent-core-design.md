# OmniAgent Core — Design Spec

Date: 2026-09-08

## Purpose

OmniAgent is a single-identity chat product that routes user requests to whichever local specialist AI (subagent) is best suited, with automatic fallback and multi-subagent synthesis, while presenting itself to the user only as "OmniAgent" — no backend names, routing logic, or provider identity ever surfaced.

**History of the backend strategy:** the app originally supported seven cloud providers (Anthropic, OpenAI, Gemini, Mistral, Cohere, Kimi, Hugging Face). All seven were removed by explicit user request (2026-09-09) after repeatedly hitting real-world friction (invalid/placeholder keys, exhausted billing, suspended accounts, provider-side rate limits), leaving the app local-only on Ollama models.

**Reintroduced cloud fallback for hosted deployment (decision recorded 2026-09-15):** the user decided to deploy OmniAgent as a real website (target: Render), where no Ollama server is available. Rather than a second cloud-provider removal-and-reinstatement cycle, the design now treats local and cloud as two tiers of the *same* fallback chain: local Ollama adapters (`ollama-coding`, `ollama-general`) are tried first when configured, and two new OpenRouter free-tier adapters (`openrouter-coding`, `openrouter-general`, via `server/cloud-adapter.js`) sit after them in `DEFAULT_ADAPTERS`. A host with no `LOCAL_*_MODEL` set (e.g. Render) simply has those adapters excluded from `isConfigured()` filtering, and OpenRouter picks up every category automatically — no environment-specific code path. This preserves the "no paid-provider dependency" spirit (OpenRouter's free-tier models need no billing) while making the app deployable anywhere.

This spec covers **core only**: chat, auth, routing/fallback across text backends, and logging. Deferred to later specs: finance/news scraping. Translation was folded into core routing as a category; image generation and speech-to-text were added (2026-09-15) as separate non-chat routes rather than router categories, since their input/output isn't text-in/text-out — see "Media capabilities" below.

## Media capabilities (image generation, STT, TTS)

**Decision recorded 2026-09-15.** Once the app needed to run as a deployed website (not just locally), image generation and speech-to-text needed a free *hosted* backend — local-only tools (e.g. a local Ollama vision model, Piper TTS) don't help a visitor hitting a Render deployment. Hugging Face's free Inference API (the `hf-inference` provider specifically, via `router.huggingface.co/hf-inference`) covers both:

- **`POST /generate-image`** (`server/media.js`, `server/adapters/hf-image.js`) — text-to-image, default model `stabilityai/stable-diffusion-3-medium-diffusers`. Verified live end-to-end through the actual UI.
- **`POST /transcribe`** (multipart audio upload, `server/adapters/hf-whisper.js`) — `openai/whisper-large-v3-turbo`. Verified live with a real generated WAV file, transcribed correctly.
- **Text-to-speech has no backend route at all.** Checked live against Hugging Face's own model-listing API (`/api/models?pipeline_tag=text-to-speech&inference_provider=hf-inference`) — it returned an empty list. There is currently no free TTS model on `hf-inference`. Rather than reach for a paid provider, TTS uses the browser's built-in Web Speech Synthesis API (`client/src/speech.js`) instead: free, zero API key, zero server cost, works on any host. This is a better fit than a backend call would have been, not a workaround.

**A real endpoint migration was hit and fixed during this work**: `api-inference.huggingface.co` (the URL every "how to use HF Inference API" guide references) is fully decommissioned — the hostname doesn't even resolve via DNS anymore. All three adapters use `router.huggingface.co/hf-inference/models/<model>` instead. Not every model that used to work on the old host works under the new `hf-inference` provider (`black-forest-labs/FLUX.1-schnell` returns 410 — it's been moved to a different, paid-only provider) — model choices here were verified live against the real API, not carried over from search results or older documentation, which are stale.

These are separate authenticated routes rather than router categories/adapters, because the router's adapter contract (`send(prompt) -> string`) assumes text in, text out; image bytes in/out and audio bytes in/text out don't fit that shape without a larger interface change that wasn't judged worth it for two routes.

## Scope (this spec)

- Web app: React (Vite) frontend, Node/Express backend, single repo.
- Email/password auth with hashed passwords and server-side sessions.
- Chat interface: single conversation view, send message, get unified response.
- Router: classifies each prompt into a task category (coding, summarization, creative, classification, fast/simple, general) via keyword heuristics, sends it to the backend specialist for that category, and falls back through remaining configured backends (in a fixed default order) on failure — transparently to the user.
- SQLite persistence: users, sessions, and a log of every query/response/backend-used/timestamp.
- Minimal UI: chat + a few quick-action prompt presets (e.g. "Summarize", "Explain code", "Draft email") that just pre-fill the input — no separate feature pages.

## Out of scope (this spec)

- Image generation, speech-to-text, translation, live finance/news data — separate specs later.
- OAuth/SSO, email verification, password reset flows.
- Multi-conversation history / conversation list (single running chat per session for MVP).
- Streaming token-by-token responses (MVP returns full response at once).

## Architecture

```
React SPA (chat UI, login/register)
        |
        v  HTTP (fetch, session cookie)
Express server
   ├── /auth/register, /auth/login, /auth/logout  (bcrypt + express-session)
   ├── /chat  (POST message -> routed response)
   └── SQLite (better-sqlite3): users, sessions, queries
        |
        v
Lead dispatch: prompt -> lead model call -> 1-2 categories (JSON decision)
   on lead failure/bad output -> keyword classifier (server/classify.js) as fallback, always 1 category
Router: each decided category -> its primary specialist adapter (if configured),
   else falls through remaining configured adapters in default order
   -> 1 category answered: return its text directly
   -> 2 categories answered: one synthesis call combines both into one final answer
      (synthesis failure -> return the first category's answer alone, never an error)
   -> 0 categories answered: generic error to user
Adapters: two local Ollama adapters (ollama-coding, ollama-general), no API key, built via a shared factory (server/local-adapter.js), each gated by its own model env var (LOCAL_CODING_MODEL / LOCAL_GENERAL_MODEL). No cloud adapters exist.
```

## Multi-agent dispatch (lead + specialists)

**Decision, recorded here as the durable architecture — do not revert to pure keyword routing without updating this section.** Every chat request first goes through a *lead* dispatch step (`server/lead.js`), not straight to the keyword classifier:

1. The lead sends the user's prompt, wrapped in a routing-coordinator system prompt, to the first available configured adapter (tried in the same fallback order as everything else). It asks for a strict JSON decision: `{"categories": ["coding"]}` or up to two categories, e.g. `{"categories": ["coding", "summarization"]}`.
2. Each decided category is answered by its own specialist chain exactly as before (primary local/cloud adapter, falling through the rest on failure) — these specialist adapters are the "subagents."
3. If exactly one category produced an answer, that answer is returned as-is (no extra cost).
4. If two categories both produced answers, one more call *synthesizes* them (`synthesize()` in `lead.js`) into a single final answer, with an explicit instruction never to mention multiple sources/specialists/AI names. If synthesis itself fails, the first specialist's answer is returned alone rather than erroring.
5. If the lead call fails entirely (parse failure, no adapter available, timeout), the router falls back to the original single-category keyword classifier (`server/classify.js`) — this keeps the classifier as a permanent safety net, not dead code.

**Cost/latency tradeoff, accepted deliberately:** a request now costs 1 (single-category, lead failed) to 4 (lead + 2 specialists + synthesis) model calls instead of always 1. This was an explicit user choice, prioritizing capability on complex/multi-part prompts over minimizing latency and per-request cost.

**Adapter interface unchanged:** `send(prompt)` still takes one string; lead/synthesis instructions are prepended into that single string rather than a separate system-prompt parameter, since some adapters (the local Ollama ones) already bake in their own fixed system prompt. This is a known minor limitation, not a bug — accepted for now rather than changing every adapter's signature.

## Task categories and specialist backends

Every category's primary is a free local Ollama model. There is no cloud fallback.

| Category | Keyword trigger examples | Primary backend |
|---|---|---|
| coding | code, function, debug, stack trace, python/js/ts/java/c++/c#/go/rust/ruby/php/swift/kotlin/sql/bash/html/css, algorithm, regex, refactor, syntax error, unit tests, \`\`\` fences | ollama-coding (local `qwen2.5-coder:7b`, opt-in) |
| summarization | summarize, summary, analyze, analysis | ollama-general (local `qwen2.5:7b`, opt-in) |
| creative | brainstorm, story, poem, creative, blog post | ollama-general |
| classification | classify, categorize | ollama-general |
| fast | quick, short answer | ollama-general |
| general | (no match — default) | ollama-general |

If the category's primary local model isn't configured/running, or its call fails, the router falls back to the other local adapter (`ollama-coding` and `ollama-general` each cover for the other, skipping the one already tried). If neither is configured or both fail, the request gets the generic "unavailable" error — there is no cloud backend to fall back to.

## Components

- **Adapters** (`server/adapters/*.js`): two local adapters (`ollama-coding`, `ollama-general`), each exporting `{ name, isConfigured(), send(prompt) -> string }`, throwing on failure. Both are built from a shared factory (`server/local-adapter.js`) that hits a local Ollama server, gated by their own model env var (`LOCAL_CODING_MODEL` / `LOCAL_GENERAL_MODEL`) rather than an API key. No cloud adapters exist — they were deliberately removed (see Purpose).
- **Classifier** (`server/classify.js`): pure function `classify(prompt) -> category`, keyword/regex based, no network call.
- **Router** (`server/router.js`): classifies the prompt, picks the configured primary specialist for that category, falls back through the rest of the configured adapters in default order, exposes `route(prompt) -> { text, backendUsed, category }`. Backend name and category are logged to DB but never returned to the frontend.
- **Auth** (`server/auth.js`): register/login/logout using bcrypt password hashing, express-session with SQLite session store.
- **DB** (`server/db.js`): better-sqlite3, schema below, synchronous simple queries (fine at this scale).
- **Frontend** (`client/`): React + Vite. Pages: Login/Register, Chat. Chat page: message list, input box, 3-4 quick-action buttons that prefill input text. No icons/branding beyond "OmniAgent" wordmark.

## Data model (SQLite)

```sql
users(id INTEGER PK, email TEXT UNIQUE, password_hash TEXT, created_at TEXT)
queries(id INTEGER PK, user_id INTEGER, prompt TEXT, response TEXT, backend_used TEXT, category TEXT, created_at TEXT)
-- sessions table auto-managed by connect-sqlite3 session store
```

## Error handling

- Both local adapters fail (or neither is configured) → chat returns a single generic error message ("OmniAgent is temporarily unavailable, try again shortly"); no stack traces or provider errors shown to user.
- Missing/invalid session on `/chat` → 401, frontend redirects to login.
- Neither `LOCAL_CODING_MODEL` nor `LOCAL_GENERAL_MODEL` set → server fails fast at startup with a clear log message (developer-facing only).

## Testing

- Unit tests for classifier (each category's keywords map correctly, unmatched text maps to "general").
- Unit tests for router (primary specialist used when configured and it succeeds; falls through to next configured adapter on failure or when primary unconfigured; all throw → generic error).
- Unit tests for auth (register duplicate email rejected, login wrong password rejected, session persists).
- Manual browser check of chat flow end-to-end with at least one local model configured and Ollama running.

## Config

- `.env` (gitignored): `PORT`, `SESSION_SECRET`, `OLLAMA_BASE_URL` (defaults to `http://localhost:11434`), `LOCAL_CODING_MODEL`, `LOCAL_GENERAL_MODEL`. No cloud API keys exist. Category-to-backend mapping and fallback order are fixed in code, filtered to whichever local model env vars are actually set.
