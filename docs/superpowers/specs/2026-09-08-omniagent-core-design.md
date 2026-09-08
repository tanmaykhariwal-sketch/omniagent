# OmniAgent Core — Design Spec

Date: 2026-09-08

## Purpose

OmniAgent is a single-identity chat product that routes user requests to one of several backend text-generation AIs, with automatic fallback, while presenting itself to the user only as "OmniAgent" — no backend names, routing logic, or provider identity ever surfaced.

This spec covers **core only**: chat, auth, routing/fallback across text backends, and logging. Deferred to later specs: image generation, speech-to-text, translation, and finance/news scraping.

## Scope (this spec)

- Web app: React (Vite) frontend, Node/Express backend, single repo.
- Email/password auth with hashed passwords and server-side sessions.
- Chat interface: single conversation view, send message, get unified response.
- Router: ordered list of enabled text-generation backends, selected from which API keys are present in environment config. On failure (error, rate limit, timeout) of the current backend, automatically retries the next one in order, transparently to the user.
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
Router module: ordered adapter list built from env keys present
   -> tries adapter[0].send(prompt); on failure -> adapter[1]...; on all fail -> generic error to user
Adapters: thin per-backend clients (Claude, OpenAI, Gemini, Mistral, Cohere, HF-text — whichever keys exist)
```

## Components

- **Adapters** (`server/adapters/*.js`): one file per backend, each exporting `send(prompt) -> string`, throwing on failure. Adapter internals (API shape, base URL, model name) are fully encapsulated — router never sees provider specifics beyond a name used only for logging.
- **Router** (`server/router.js`): reads which adapters are configured (API key env var present), builds ordered list (order configurable, default = order keys were given), exposes `route(prompt) -> { text, backendUsed }`. Backend name is logged to DB but never returned to the frontend.
- **Auth** (`server/auth.js`): register/login/logout using bcrypt password hashing, express-session with SQLite session store.
- **DB** (`server/db.js`): better-sqlite3, schema below, synchronous simple queries (fine at this scale).
- **Frontend** (`client/`): React + Vite. Pages: Login/Register, Chat. Chat page: message list, input box, 3-4 quick-action buttons that prefill input text. No icons/branding beyond "OmniAgent" wordmark.

## Data model (SQLite)

```sql
users(id INTEGER PK, email TEXT UNIQUE, password_hash TEXT, created_at TEXT)
queries(id INTEGER PK, user_id INTEGER, prompt TEXT, response TEXT, backend_used TEXT, created_at TEXT)
-- sessions table auto-managed by connect-sqlite3 session store
```

## Error handling

- All configured adapters fail → chat returns a single generic error message ("OmniAgent is temporarily unavailable, try again shortly"); no stack traces or provider errors shown to user.
- Missing/invalid session on `/chat` → 401, frontend redirects to login.
- No API keys configured at all → server fails fast at startup with a clear log message (developer-facing only).

## Testing

- Unit tests for router fallback logic (mock adapters: first throws, second succeeds → correct response + correct logged backend; all throw → generic error).
- Unit tests for auth (register duplicate email rejected, login wrong password rejected, session persists).
- Manual browser check of chat flow end-to-end with at least one real backend key.

## Config

- `.env` (gitignored): `PORT`, `SESSION_SECRET`, and one env var per backend key, e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `COHERE_API_KEY`, `HF_API_KEY`. Router order = a fixed priority list in code, filtered to keys actually present.
