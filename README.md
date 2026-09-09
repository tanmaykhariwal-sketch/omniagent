# OmniAgent

Single-identity chat app that classifies each request and routes it to whichever backend AI is best suited (coding, summarization, creative, classification, fast, general), with automatic fallback across the rest. Backend identity is never exposed to the user.

## Stack

- Backend: Node.js, Express, `node:sqlite` (built-in, no native compiler needed), `bcryptjs` (pure JS), `express-session` with a custom SQLite-backed store, `express-rate-limit`.
- Frontend: React (Vite), plain CSS — no UI framework.

Note: the original plan called for `better-sqlite3`/`bcrypt`/`connect-sqlite3`, but those need a native C++ toolchain (node-gyp/Visual Studio Build Tools). This machine doesn't have one, so the app uses Node's built-in `node:sqlite` and the pure-JS `bcryptjs` instead — same behavior, zero native dependencies.

## Setup

1. `cp .env.example .env` and fill in `SESSION_SECRET` plus at least one backend API key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `COHERE_API_KEY`, `KIMI_API_KEY`, `HF_API_KEY`) — or set up the local coding model below.
2. `npm install`
3. `npm start` — runs the API server on `PORT` (default 3000). Refuses to start if no backend (cloud key or local model) is configured.
4. In a second terminal: `cd client && npm install && npm run dev` — runs the frontend dev server, proxying `/register`, `/login`, `/logout`, `/chat` to the backend.

## Tests

`npm test` runs the backend test suite. Each `test/*.test.js` file is executed directly as its own process (not via `node --test`, which has a broken flag on this machine's node install) — `scripts/run-tests.js` handles that.

## Routing

Prompts are classified by keyword heuristics (`server/classify.js`) into one of: coding, summarization, creative, classification, fast, general. Each category has a primary backend (Ollama-local, Anthropic, Gemini, Cohere, Mistral, OpenAI respectively); if that backend isn't configured or its call fails, the router falls through the rest of the configured backends (cloud and local) in a fixed default order. See `DESIGN.md` for the routing table and UI direction.

## Local coding model (Ollama)

The `coding` category defaults to a local model via [Ollama](https://ollama.com) instead of a cloud API — no key, no per-request cost, runs on your machine.

1. Install Ollama (`winget install Ollama.Ollama` on Windows, or download from ollama.com).
2. `ollama pull qwen2.5-coder:7b`
3. Set `LOCAL_CODING_MODEL=qwen2.5-coder:7b` in `.env` (and `OLLAMA_BASE_URL` if Ollama isn't on the default `http://localhost:11434`).

If Ollama isn't running or the model isn't pulled, coding requests fall through to Kimi (or whichever other backend is configured) automatically — no code change needed either way.

## Hardening notes

- `/register` and `/login` share a rate limit (20 attempts / 15 min / IP); `/chat` is capped at 30 requests / minute / IP.
- Email addresses are trimmed and lowercased before storage/lookup, so case doesn't create duplicate accounts.
- Passwords must be at least 8 characters (enforced server-side).
- Chat prompts are trimmed, rejected if empty, and capped at 4000 characters.
- Unexpected errors in auth routes return a generic 500 rather than hanging or leaking internals.
