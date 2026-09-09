# OmniAgent

Single-identity, fully local chat app: a lead model decides which specialist "subagent(s)" should answer each request (coding, summarization, creative, classification, fast, general), dispatches to them, and — if more than one was needed — synthesizes their answers into one response. Runs entirely on free local Ollama models; there is no cloud dependency. Backend identity is never exposed to the user.

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

Every category runs on a free local Ollama model — **there is no cloud backend at all**. If a category's local model isn't configured/running, or every configured local model fails, that request gets the generic "unavailable" error rather than falling back to any cloud API. See `docs/superpowers/specs/2026-09-08-omniagent-core-design.md` ("Multi-agent dispatch") for the full design, and `DESIGN.md` for the UI direction.

This costs more per request than plain single-backend routing (1-4 local model calls instead of 1) — an explicit tradeoff for handling multi-part prompts better, not an oversight. All calls are local, so there's no per-request money cost either way.

## Local models (Ollama)

No API key, no cost, runs entirely on your machine, via [Ollama](https://ollama.com).

1. Install Ollama (`winget install Ollama.Ollama` on Windows, or download from ollama.com).
2. Pull the models you want:
   - `ollama pull qwen2.5-coder:7b` — powers the `coding` category.
   - `ollama pull qwen2.5:7b` — powers every other category (general, creative, summarization, classification, fast).
3. Set `LOCAL_CODING_MODEL=qwen2.5-coder:7b` and/or `LOCAL_GENERAL_MODEL=qwen2.5:7b` in `.env` (and `OLLAMA_BASE_URL` if Ollama isn't on the default `http://localhost:11434`).

Either one is optional independently, but with neither set the server refuses to start.

## Hardening notes

- `/register` and `/login` share a rate limit (20 attempts / 15 min / IP); `/chat` is capped at 30 requests / minute / IP.
- Email addresses are trimmed and lowercased before storage/lookup, so case doesn't create duplicate accounts.
- Passwords must be at least 8 characters (enforced server-side).
- Chat prompts are trimmed, rejected if empty, and capped at 4000 characters.
- Unexpected errors in auth routes return a generic 500 rather than hanging or leaking internals.
