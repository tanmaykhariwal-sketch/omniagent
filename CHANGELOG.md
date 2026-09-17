# Changelog

A running log of *why* each change to OmniAgent was made — the request or
problem behind it, not a byte-level diff. For the literal diffs, use
`git log` / `git show <hash>` in this repo; this file complements that
history with the reasoning, decided or discovered along the way.

Newest entries at the top.

---

## Conversation history

**What:** Added `GET /history`, which returns this session's past text-chat
exchanges from the `queries` table (already being logged, never read back).
`ChatPage` loads it on mount so a page reload no longer wipes the
conversation.
**Why:** Requested directly ("what about memory??? y r u missing out on
points and features?"). Scoped to text chat only — image generation,
finance quotes, and news search stay session-only, since silently
re-showing a stale stock quote or headline after time has passed would be
misleading, not useful. Also fixed a local-dev-only bug along the way:
`vite.config.js`'s proxy list was missing `/history`, so the request
silently hit Vite's own fallback HTML instead of the backend (production is
unaffected — no separate dev proxy there, one Express origin serves both).
**Files:** `server/chat.js`, `server/index.js`, `client/src/ChatPage.jsx`,
`client/src/api.js`, `client/vite.config.js`, `test/chat.test.js`.

## Cross-conversation memory, crisp answers, cloud-first routing

**What:** Three fixes from the same live-testing pass:
- Built `server/memory.js` to extract and remember durable facts about the
  user (role, preferences, ongoing projects) across separate conversations,
  injected into future system prompts via a new optional `extraContext`
  parameter on both adapter factories.
- Rewrote the general/coding system prompts. The old wording ("well-
  organized", "well-explained") was producing essay-length, over-structured
  answers even to simple questions — confirmed live when "what all ai's are
  working in the backend" returned an 8-section generic essay about AI
  infrastructure in general, nothing about OmniAgent's own actual backend.
  New prompts explicitly demand matching answer length to the question and
  no unsolicited structure.
- Reordered `DEFAULT_ADAPTERS`/`CATEGORY_PRIMARY` in `server/router.js` to
  try OpenRouter before Ollama (previously the reverse).
**Why:** The memory feature was explicitly requested after the crispness
issue surfaced. The reorder was a direct fix for a live-diagnosed problem:
local Ollama on this CPU-only laptop (0% GPU utilization, confirmed) was
taking 10-20s+ per attempt, and the lead-dispatch step makes *two* such
local calls per message (classify, then answer) — up to ~40s of timeouts
before ever reaching a cloud answer that would have come back in seconds
anyway. This also happens to deliver "online use the online tools, offline
use the offline tools" for free, with no explicit connectivity detection: a
reachable cloud call just answers fast, an unreachable one fails fast
(DNS/connection error) rather than timing out slowly, so the local fallback
engages quickly on a genuinely offline machine. Also fixed, found live: the
memory-extraction call initially used OpenRouter's free auto-router, which
landed on a safety/moderation model instead of a real chat model and
returned `"User Safety: safe"` as a stored "fact" — fixed by reusing
whichever adapter had just successfully answered, instead of a fresh,
unpredictable pick.
**Files:** `server/memory.js` (new), `server/router.js`, `server/chat.js`,
`server/local-adapter.js`, `server/cloud-adapter.js`,
`server/adapters/*-general.js`, `server/adapters/*-coding.js`, `server/db.js`
(new `memories` table), `test/memory.test.js` (new), `test/db.test.js`.

## Removed decorative keyboard-shortcut badges

**What:** Removed the `⌥1`/`⌥2`/`⌥3` hints shown next to the Summarize/
Explain code/Draft email quick-action chips.
**Why:** The user asked what they were. They implied working Alt+digit
shortcuts that were never actually wired to a keydown handler — a real,
if minor, UX bug (a promise the UI didn't keep). Removed rather than
implemented, per explicit request, once the gap was found.
**Files:** `client/src/ChatPage.jsx`, `client/src/styles.css`.

## Removed sign-in entirely

**What:** `requireAuth` now silently provisions an anonymous session (a
synthetic `anon-<uuid>@omniagent.local` row) on first request instead of
rejecting with 401. `LoginPage` and all register/login/logout UI wiring
removed from the frontend; the backend endpoints still exist, unused.
**Why:** Explicit request ("i want no signin required... all free"). Note:
this was implemented once, reverted once when the user asked for email+
password login back instead, then explicitly re-requested and kept.
**Files:** `server/auth.js`, `client/src/App.jsx`, `client/src/ChatPage.jsx`,
`client/src/api.js`, `client/src/LoginPage.jsx` (deleted),
`test/chat.test.js`, `test/finance-news.test.js`, `test/media.test.js`.

## Security/accessibility/performance fixes from subagent review

**What:** Dispatched a 4-agent review team (security, React/frontend,
accessibility, performance) against the whole codebase. Fixes applied:
production now refuses to start with the public `dev-secret` session
fallback if `SESSION_SECRET` is unset; static assets get long-lived cache
headers (content-hashed filenames) with `index.html` forced no-cache;
an untrusted news-API link is validated as http(s) before being rendered
as an `<a href>` (an unvalidated URL from a third-party feed is a real
injection-adjacent risk); the news list uses a stable key instead of array
index; the mic stream is released if you navigate away mid-recording; an
app-level error boundary was added so one bad render can't blank the whole
app; a missing `quote.price` no longer crashes `QuoteCard`; chat history
capped at 200 rows to bound memory growth in long sessions; aria-labels and
live regions added throughout for screen readers.
**Why:** Explicit request ("make a team and work with subagents to make
the website better"). Each fix maps to a concrete finding from the review,
not a subjective style pass.
**Files:** `server/index.js`, `client/src/App.jsx`, `client/src/ChatPage.jsx`,
`client/src/LoginPage.jsx`.

## Starter suggestion cards

**What:** Added six emoji quick-start prompts (Explain a concept, Debug
some code, Draft an email, Generate an image, Check a stock, Today's news)
to the empty chat state, each prefilling the composer and switching mode
where relevant.
**Why:** Explicit request for ChatGPT-style starter suggestions under the
"How can I help?" empty state.
**Files:** `client/src/ChatPage.jsx`, `client/src/styles.css`.

## Frontend redesign: Command Palette → standard chat app

**What:** Full visual-world replacement of the original dark, keyboard-
first "Command Palette" UI (addressed rows, mono labels, 3-tick status
marker) with a conventional chat-bubble layout: header with wordmark and
theme toggle, message bubbles, a bottom composer with quick-action chips.
Light theme by default, dark toggle persisted to `localStorage`.
**Why:** The user explicitly disliked the original interface ("i dont like
the interface, make it a general interface"). Confirmed direction: standard
chat-app look, craft bar named as "ChatGPT + Claude.ai". Treated as a
redesign (replace the old world) rather than a refinement, since the
direction itself was rejected, not just its execution.
**Files:** `client/src/App.jsx`, `client/src/ChatPage.jsx` (rewritten),
`client/src/LoginPage.jsx`, `client/src/styles.css` (rewritten),
`client/src/theme.js` (new), `client/src/main.jsx`, `PRODUCT.md`, `DESIGN.md`.

## Finance quotes and news search

**What:** Added `GET /finance` (Yahoo Finance's public chart API) and
`GET /news` (Google News RSS, custom XML parser) — both free, no API key.
**Why:** Completed the original spec's category list — the last of the
7 planned capabilities (after confirming the 7 text categories were solid
before building the remaining 3 non-text ones: image, STT, and this).
Provider names never appear in the UI, consistent with the OmniAgent
single-identity rule that governs every other integration in this project.
**Files:** `server/finance-news.js` (new), `server/adapters/yahoo-finance.js`
(new), `server/adapters/google-news.js` (new), `server/index.js`,
`client/src/ChatPage.jsx`, `client/src/api.js`.

## Image generation, speech-to-text, browser text-to-speech

**What:** Added `POST /generate-image` and `POST /transcribe` via Hugging
Face's free Inference API (`hf-inference` provider). Text-to-speech uses
the browser's built-in Web Speech Synthesis API instead of a backend route.
**Why:** The app's target shifted from local-only to a real deployed
website, where local-only tools (a local vision model, Piper TTS) can't
help a visitor hitting the deployed site. TTS specifically went
browser-side after confirming live (querying HF's own model-listing API)
that hf-inference has zero free text-to-speech models — the browser API is
a better fit here, not a workaround. Also hit and fixed during this work:
`api-inference.huggingface.co` (the URL most guides reference) is fully
decommissioned — switched to `router.huggingface.co/hf-inference`; and the
originally-chosen image model (`FLUX.1-schnell`) returns 410 on that
provider — switched to `stable-diffusion-3-medium-diffusers`, confirmed
live.
**Files:** `server/media.js` (new), `server/adapters/hf-image.js` (new),
`server/adapters/hf-whisper.js` (new), `client/src/speech.js` (new),
`client/src/ChatPage.jsx`, `client/src/api.js`, `server/index.js`.

## Fixed category routing when local models are unconfigured

**What:** `CATEGORY_PRIMARY` changed from a flat string map (only
`ollama-*` names) to an ordered list of named candidates per category.
**Why:** Real bug, found via a properly isolated live test: on a host with
no local model configured (like Render), every category was silently
falling through to whichever cloud adapter happened to be listed first in
`DEFAULT_ADAPTERS`, ignoring the actual requested category entirely. An
earlier claim that this had been verified via a "Render simulation" was
inaccurate (the test wasn't properly isolated) — self-corrected once a
genuinely isolated test (local model env vars explicitly cleared) exposed
the real bug.
**Files:** `server/router.js`, `test/router.test.js`.

## Fixed stale OpenRouter free-tier model slugs

**What:** Replaced `qwen/qwen3-coder:free` (now 404s — "unavailable for
free, use qwen/qwen3-coder instead") with `cohere/north-mini-code:free` for
coding, and `openrouter/free` (OpenRouter's own auto-router across free
models) for general. Added `tencent/hy3:free` as an optional, disabled-by-
default fallback after verifying live that it is not actually free despite
some 2026 coverage claiming otherwise.
**Why:** Model slugs found via search results/blog posts go stale fast.
Verified live against OpenRouter's own `/api/v1/models` endpoint
(`pricing.prompt=="0"`) rather than trusting documentation, per an explicit
standing preference established after repeated instances of stale info in
this project (established when the user asked "y r u missing out on"
certain models and a live check settled the question either way).
**Files:** `server/adapters/openrouter-coding.js`,
`server/adapters/openrouter-general.js`,
`server/adapters/openrouter-hy3.js` (new), `.env.example`.

## OpenRouter free-tier fallback, prep for Render deployment

**What:** Reintroduced a cloud tier (`server/cloud-adapter.js`,
`openrouter-coding`/`openrouter-general`) sitting after the local Ollama
adapters in the same fallback chain, rather than as a separate code path.
**Why:** The user decided to deploy OmniAgent as a real website (target:
Render), which has no Ollama server available. Treating local and cloud as
two tiers of one fallback chain means a host with no `LOCAL_*_MODEL` set
simply has those adapters excluded from `isConfigured()` filtering — no
environment-specific branching. OpenRouter's free-tier models need no
billing, preserving the "no paid-provider dependency" decision from
earlier in the project.
**Files:** `server/cloud-adapter.js` (new),
`server/adapters/openrouter-coding.js` (new),
`server/adapters/openrouter-general.js` (new), `server/router.js`,
`render.yaml` (new), `.env.example`.

## Translation as a routed category

**What:** Added `translation` as a full category in the lead-dispatch/
classifier/router system, rather than a special case.
**Why:** Kept consistent with the existing multi-category architecture
instead of a one-off branch.
**Files:** `server/lead.js`, `server/classify.js`, `server/router.js`.

## Went fully local, removed all cloud providers

**What:** Removed all seven cloud provider adapters (Anthropic, OpenAI,
Gemini, Mistral, Cohere, Kimi, Hugging Face) that the app originally
supported, leaving it local-only on Ollama models.
**Why:** Explicit request ("forget all these open ai, anthropic
everything") after repeatedly hitting real-world friction: invalid/
placeholder API keys, exhausted billing, suspended accounts, and
provider-side rate limits across the seven providers.
**Files:** all `server/adapters/<cloud-provider>.js` files (deleted),
`server/router.js`, `.env.example`, `README.md`.

## Lead + subagent dispatch with synthesis

**What:** Redesigned routing from flat keyword-based classification to a
lead model deciding which 1-2 of the categories should handle each prompt
(as a JSON decision), each category's specialist answering independently,
with a synthesis call combining both answers when two are dispatched. Falls
back to the original keyword classifier if the lead call itself fails.
**Why:** Explicit request to route via a "team leader" model choosing the
best-suited specialist(s), rather than simple flat keyword-only routing,
so multi-part prompts spanning two categories get handled properly instead
of forced into one bucket.
**Files:** `server/lead.js` (new), `server/router.js`, `test/lead.test.js`
(new), `test/router.test.js`.

## Core scaffold

**What:** Initial build: Express app with `node:sqlite`-backed sessions
(`SqliteSessionStore`, avoiding a native-compiler dependency),
email+password auth (`bcryptjs`), a `users`/`queries`/`sessions` schema,
keyword-based category classifier, category-to-backend router with
fallback, authenticated `/chat` endpoint with query logging, request
timeouts on every adapter call, input validation, rate limiting.
**Why:** Followed the original spec and plan
(`docs/superpowers/specs/2026-09-08-omniagent-core-design.md`,
`docs/superpowers/plans/2026-09-08-omniagent-core.md`). `node:sqlite` and
`bcryptjs` specifically chosen over `better-sqlite3`/`bcrypt` because this
machine has no Visual Studio Build Tools installed, and the native
alternatives failed to install; the pure-JS/built-in equivalents avoid that
dependency entirely.
**Files:** `server/index.js`, `server/db.js`, `server/sqlite-session-store.js`,
`server/auth.js`, `server/chat.js`, `server/classify.js`, `server/router.js`,
`server/rate-limit.js`, `server/validate.js`, `server/fetch-timeout.js`.
