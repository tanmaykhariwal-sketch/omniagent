# OmniAgent Core — Design Spec

Date: 2026-09-08

## Purpose

OmniAgent is a single-identity chat product that routes user requests to one of several backend text-generation AIs, with automatic fallback, while presenting itself to the user only as "OmniAgent" — no backend names, routing logic, or provider identity ever surfaced.

This spec covers **core only**: chat, auth, routing/fallback across text backends, and logging. Deferred to later specs: image generation, speech-to-text, translation, and finance/news scraping.

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
Adapters: thin per-backend clients (Claude, OpenAI, Gemini, Mistral, Cohere, Kimi, HF-text — whichever keys exist; plus two local Ollama adapters, no key, built via a shared factory, opt-in via LOCAL_CODING_MODEL / LOCAL_GENERAL_MODEL)
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

Every category's primary is a free local Ollama model; cloud backends are the fallback.

| Category | Keyword trigger examples | Primary backend |
|---|---|---|
| coding | code, function, debug, stack trace, python/js/ts/java/c++/c#/go/rust/ruby/php/swift/kotlin/sql/bash/html/css, algorithm, regex, refactor, syntax error, unit tests, \`\`\` fences | ollama-coding (local `qwen2.5-coder:7b`, opt-in) |
| summarization | summarize, summary, analyze, analysis | ollama-general (local `qwen2.5:7b`, opt-in) |
| creative | brainstorm, story, poem, creative, blog post | ollama-general |
| classification | classify, categorize | ollama-general |
| fast | quick, short answer | ollama-general |
| general | (no match — default) | ollama-general |

If the category's primary local model isn't configured/running, or its call fails, the router falls back through the remaining configured adapters in this fixed default order: OpenAI, Anthropic, Gemini, Kimi, Mistral, Cohere, Hugging Face, ollama-coding, ollama-general (skipping the one already tried). So any category still gets answered by a cloud backend if the corresponding local model isn't set up.

## Components

- **Adapters** (`server/adapters/*.js`): one file per cloud backend (Anthropic, OpenAI, Gemini, Mistral, Cohere, Kimi, Hugging Face), each exporting `{ name, isConfigured(), send(prompt) -> string }`, throwing on failure. Two local adapters (`ollama-coding`, `ollama-general`) are built from a shared factory (`server/local-adapter.js`) that hits a local Ollama server, gated by their own model env var rather than an API key. Adapter internals (API shape, base URL, model name) are fully encapsulated — router never sees provider specifics beyond a name used only for logging.
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

- All configured adapters fail → chat returns a single generic error message ("OmniAgent is temporarily unavailable, try again shortly"); no stack traces or provider errors shown to user.
- Missing/invalid session on `/chat` → 401, frontend redirects to login.
- No API keys configured at all → server fails fast at startup with a clear log message (developer-facing only).

## Testing

- Unit tests for classifier (each category's keywords map correctly, unmatched text maps to "general").
- Unit tests for router (primary specialist used when configured and it succeeds; falls through to next configured adapter on failure or when primary unconfigured; all throw → generic error).
- Unit tests for auth (register duplicate email rejected, login wrong password rejected, session persists).
- Manual browser check of chat flow end-to-end with at least one real backend key.

## Config

- `.env` (gitignored): `PORT`, `SESSION_SECRET`, and one env var per backend key: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `COHERE_API_KEY`, `KIMI_API_KEY`, `HF_API_KEY`. Category-to-backend mapping and default fallback order are fixed in code, filtered to keys actually present.
