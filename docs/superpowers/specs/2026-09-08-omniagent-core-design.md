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
Classifier: prompt -> category (keyword heuristics, no extra API call)
Router: category -> primary specialist adapter (if configured), else falls through
   remaining configured adapters in default order -> on all fail -> generic error to user
Adapters: thin per-backend clients (Claude, OpenAI, Gemini, Mistral, Cohere, Kimi, HF-text — whichever keys exist; plus a local Ollama adapter, no key, opt-in via LOCAL_CODING_MODEL)
```

## Task categories and specialist backends

| Category | Keyword trigger examples | Primary backend |
|---|---|---|
| coding | code, function, debug, stack trace, python/js/ts/java/c++/c#/go/rust/ruby/php/swift/kotlin/sql/bash/html/css, algorithm, regex, refactor, syntax error, unit tests, \`\`\` fences | Ollama (local `qwen2.5-coder:7b`, opt-in) |
| summarization | summarize, summary, analyze, analysis | Anthropic (Claude) |
| creative | brainstorm, story, poem, creative, blog post | Gemini |
| classification | classify, categorize | Cohere |
| fast | quick, short answer | Mistral |
| general | (no match — default) | OpenAI |

If the category's primary backend has no configured key/model, or its call fails, the router falls back through the remaining configured adapters in this fixed default order: OpenAI, Anthropic, Gemini, Kimi, Mistral, Cohere, Hugging Face, Ollama (skipping the one already tried). So a coding prompt with no local model set up (or Ollama not running) still gets answered — it falls through to Kimi and the rest.

## Components

- **Adapters** (`server/adapters/*.js`): one file per backend (Anthropic, OpenAI, Gemini, Mistral, Cohere, Kimi, Hugging Face), each exporting `{ name, isConfigured(), send(prompt) -> string }`, throwing on failure. Adapter internals (API shape, base URL, model name) are fully encapsulated — router never sees provider specifics beyond a name used only for logging.
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
