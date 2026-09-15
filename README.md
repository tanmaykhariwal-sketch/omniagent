# OmniAgent

Single-identity chat app: a lead model decides which specialist "subagent(s)" should answer each request (coding, summarization, creative, classification, translation, fast, general), dispatches to them, and — if more than one was needed — synthesizes their answers into one response. Runs on free local Ollama models when available (e.g. your own machine), and automatically falls back to free-tier OpenRouter cloud models when no local model is configured (e.g. deployed to Render). Backend identity is never exposed to the user.

## Stack

- Backend: Node.js, Express, `node:sqlite` (built-in, no native compiler needed), `bcryptjs` (pure JS), `express-session` with a custom SQLite-backed store, `express-rate-limit`.
- Frontend: React (Vite), plain CSS — no UI framework.

Note: the original plan called for `better-sqlite3`/`bcrypt`/`connect-sqlite3`, but those need a native C++ toolchain (node-gyp/Visual Studio Build Tools). This machine doesn't have one, so the app uses Node's built-in `node:sqlite` and the pure-JS `bcryptjs` instead — same behavior, zero native dependencies.

## Setup

1. `cp .env.example .env` and fill in `SESSION_SECRET`, then set up at least one local model below.
2. `npm install`
3. `npm start` — runs the API server on `PORT` (default 3000). Refuses to start if no local model is configured.
4. In a second terminal: `cd client && npm install && npm run dev` — runs the frontend dev server, proxying `/register`, `/login`, `/logout`, `/chat` to the backend.

## Tests

`npm test` runs the backend test suite. Each `test/*.test.js` file is executed directly as its own process (not via `node --test`, which has a broken flag on this machine's node install) — `scripts/run-tests.js` handles that.

## Routing: lead + subagents

Every request goes through a **lead dispatch** step (`server/lead.js`) before anything else: the lead model reads the prompt and decides which 1-2 of six categories (coding, summarization, creative, classification, fast, general) should handle it, as a JSON decision. Each category's specialist adapter (the "subagent") then answers independently; if two categories were dispatched, one more call synthesizes both answers into a single final response. If the lead call itself fails, the app falls back to the original keyword classifier (`server/classify.js`) as a safety net, always picking exactly one category.

Each category tries a free local Ollama model first (if configured), then falls through to a free-tier OpenRouter model. On a host with no local model at all (e.g. Render), the local adapters are simply excluded and OpenRouter serves every category — same code, no per-environment branching. See `docs/superpowers/specs/2026-09-08-omniagent-core-design.md` ("Multi-agent dispatch") for the full design, and `DESIGN.md` for the UI direction.

This costs more per request than plain single-backend routing (1-4 model calls instead of 1) — an explicit tradeoff for handling multi-part prompts better, not an oversight.

## Local models (Ollama)

No API key, no cost, runs entirely on your machine, via [Ollama](https://ollama.com).

1. Install Ollama (`winget install Ollama.Ollama` on Windows, or download from ollama.com).
2. Pull the models you want:
   - `ollama pull qwen2.5-coder:7b` — powers the `coding` category.
   - `ollama pull qwen2.5:7b` — powers every other category (general, creative, summarization, classification, fast).
3. Set `LOCAL_CODING_MODEL=qwen2.5-coder:7b` and/or `LOCAL_GENERAL_MODEL=qwen2.5:7b` in `.env` (and `OLLAMA_BASE_URL` if Ollama isn't on the default `http://localhost:11434`).

Either one is optional independently.

## OpenRouter (free-tier cloud fallback / hosted deployments)

Used automatically whenever the corresponding local model isn't configured, isn't running, or its call fails. Required for a hosted deployment (e.g. Render) since there's no Ollama server there.

1. Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys) — no billing needed for free-tier models.
2. Set `OPENROUTER_API_KEY` in `.env`.
3. `OPENROUTER_CODING_MODEL` and `OPENROUTER_GENERAL_MODEL` default to `cohere/north-mini-code:free` and `openrouter/free` (OpenRouter's own auto-router across whatever's currently free — more resilient than pinning one slug). Free-tier availability changes often; verify live with `curl -s https://openrouter.ai/api/v1/models | jq -r '.data[] | select(.pricing.prompt=="0" and .pricing.completion=="0") | .id'` rather than trusting search results or blog posts, which go stale fast.

The server refuses to start only if **neither** a local model **nor** `OPENROUTER_API_KEY` is configured.

## Deploying to Render

`render.yaml` is set up for a single web service that builds and serves both the API and the React frontend from one Express process:

1. Push this repo to GitHub, then create a new Render Web Service from it (Render will read `render.yaml` automatically).
2. Set `OPENROUTER_API_KEY` in the Render dashboard (marked `sync: false` in `render.yaml`, so it's not stored in the repo). Leave `LOCAL_CODING_MODEL`/`LOCAL_GENERAL_MODEL` unset — Render has no Ollama server, so OpenRouter handles every category.
3. **No persistent disk on the free plan**: the SQLite file lives on ephemeral storage and resets (accounts, sessions, chat logs all wiped) on every redeploy or restart. That's fine for a demo; if you need data to survive deploys, add a paid-plan disk or swap `server/db.js` for a hosted DB (e.g. Turso, Supabase).
4. `npm run build` (run automatically by Render) builds `client/dist`; `server/index.js` serves it directly when that directory exists, so there's no separate frontend deploy or Vite dev server in production.

## Hardening notes

- `/register` and `/login` share a rate limit (20 attempts / 15 min / IP); `/chat` is capped at 30 requests / minute / IP.
- Email addresses are trimmed and lowercased before storage/lookup, so case doesn't create duplicate accounts.
- Passwords must be at least 8 characters (enforced server-side).
- Chat prompts are trimmed, rejected if empty, and capped at 4000 characters.
- Unexpected errors in auth routes return a generic 500 rather than hanging or leaking internals.
