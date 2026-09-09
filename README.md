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

Prompts are classified by keyword heuristics (`server/classify.js`) into one of: coding, summarization, creative, classification, fast, general. **Every category defaults to a free local Ollama model**; cloud API keys are the fallback if a local model isn't configured/running or its call fails. See `DESIGN.md` for the UI direction.

## Local models (Ollama)

No API key, no per-request cost, runs entirely on your machine, via [Ollama](https://ollama.com).

1. Install Ollama (`winget install Ollama.Ollama` on Windows, or download from ollama.com).
2. Pull the models you want:
   - `ollama pull qwen2.5-coder:7b` — powers the `coding` category.
   - `ollama pull qwen2.5:7b` — powers every other category (general, creative, summarization, classification, fast).
3. Set `LOCAL_CODING_MODEL=qwen2.5-coder:7b` and/or `LOCAL_GENERAL_MODEL=qwen2.5:7b` in `.env` (and `OLLAMA_BASE_URL` if Ollama isn't on the default `http://localhost:11434`).

Either one is optional independently. If a local model isn't configured, isn't running, or its call fails, that category falls through to whichever cloud backends are configured — no code change needed either way.

## Hardening notes

- `/register` and `/login` share a rate limit (20 attempts / 15 min / IP); `/chat` is capped at 30 requests / minute / IP.
- Email addresses are trimmed and lowercased before storage/lookup, so case doesn't create duplicate accounts.
- Passwords must be at least 8 characters (enforced server-side).
- Chat prompts are trimmed, rejected if empty, and capped at 4000 characters.
- Unexpected errors in auth routes return a generic 500 rather than hanging or leaking internals.
