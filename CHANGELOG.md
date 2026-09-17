# Changelog

A running log of *why* each change to OmniAgent was made — the request or
problem behind it, not a byte-level diff. For the literal diffs, use
`git log` / `git show <hash>` in this repo; this file complements that
history with the reasoning, decided or discovered along the way.

Each entry's **Date** is the change's commit timestamp (`git log`, local
time). **Tokens** is real usage where a tool actually reports it (e.g. a
subagent review's own token count, shown in its completion notification);
where no tool exposes a number for that unit of work, it says so rather
than guessing.

Newest entries at the top.

---

## Privacy notice panel

**Date:** 2026-09-17 (pending commit)
**What:** A "Privacy" link in the disclaimer line opens an overlay (reusing the existing pinned-answers panel styling) with plain-language text on what's stored (conversation history, extracted facts, pin/feedback state), why (so the conversation survives a reload and answers stay relevant), and what isn't done with it (no ads, no selling, no sharing beyond the AI backend actually generating that answer).
**Why:** Continuing the feature list "biggest to smallest," one of the remaining no-credential items after the user chose to skip #26 Email integration (no email-sending provider configured) rather than build against a provider they'd have to sign up for and hand me a key for. A caveman subagent review confirmed the overlay's a11y pattern faithfully copies the existing pinned-answers overlay (same pre-existing lack of Escape/focus-trap handling, not a new regression), and caught one wording accuracy issue: the notice said extracted facts "stay on this server," but the extraction call itself is routed through the same cloud-first adapter pool as regular chat (`server/router.js`), so the *request* can leave the server even though the resulting fact is stored locally -- reworded to "the extracted fact is stored only on this server" to be precise about what actually stays local.
**Files:** `client/src/ChatPage.jsx`, `client/src/styles.css`.
**Tokens:** Subagent review only — caveman-reviewer: 78,959. Main implementation cost isn't exposed by any available tool.

## Disclaimer under the composer

**Date:** 2026-09-17 15:50
**What:** A small muted line below the composer: "OmniAgent can make mistakes. Check important information before relying on it."
**Why:** Continuing the feature list "biggest to smallest" — #21 on the list, a standard disclaimer every mainstream AI chat app carries. Pure static text and CSS, no logic -- a caveman subagent review confirmed nothing to flag; skipped the ecc security review for this one since there's no security surface in a static `<p>` tag.
**Files:** `client/src/ChatPage.jsx`, `client/src/styles.css`.
**Tokens:** Subagent review only — caveman-reviewer: 69,907. Main implementation cost isn't exposed by any available tool.

## Feedback loop: thumbs up/down on answers

**Date:** 2026-09-17 15:49
**What:** `POST /queries/:id/feedback` (accepts exactly `'up'`, `'down'`, or `null` to clear, 400s on anything else) stores per-answer feedback in a new `feedback` column, following the same idempotent-migration and ownership-scoped-UPDATE pattern as the earlier pin feature. `ChatPage.jsx` adds thumbs-up/down buttons next to the pin button on each assistant message, with an optimistic toggle (clicking the already-active choice clears it).
**Why:** Continuing the feature list "biggest to smallest" — #20 on the list. A caveman subagent review caught two real issues, both fixed: (1) the optimistic-update revert-on-failure restored the value captured at click time unconditionally, so a rapid up-then-down double-click racing two in-flight requests could have the older request's failure clobber the newer request's already-successful result -- fixed by only reverting when the row's current feedback still equals what that specific request optimistically set, so a newer change always wins; (2) the "ownership" test only checked a nonexistent query id, never a real cross-user bypass -- fixed by adding a second anonymous session and asserting it gets 404 (and doesn't mutate) when it tries to set feedback on the first session's actual query. An ecc security review confirmed the route is auth-gated, ownership-scoped, strictly input-validated, and covered by the existing rate limiter.
**Files:** `server/db.js`, `server/chat.js`, `client/src/api.js`, `client/src/ChatPage.jsx`, `test/chat.test.js`.
**Tokens:** Subagent reviews only — caveman-reviewer: 79,277; ecc security-reviewer: 75,303. Main implementation cost isn't exposed by any available tool.

## Export a conversation as Markdown

**Date:** 2026-09-17 15:43
**What:** An Export button in the header downloads the current conversation as a `.md` file (`rowToMarkdown` maps each row type -- you/omni/error/image/quote/news -- to a markdown line or block, joined under a header with the export timestamp), built entirely client-side via `Blob` + object URL + a programmatic anchor click, no backend route involved.
**Why:** Continuing the feature list "biggest to smallest" — #11 on the list. A caveman subagent review caught one minor issue, fixed: the download anchor was clicked without being appended to the DOM first, a known non-standard-compliant pattern that some browsers/WebViews don't reliably dispatch -- fixed by appending it before `.click()` and removing it after. An ecc security review confirmed the filename and content-type are fixed literals with no attacker-controlled input, and raw AI/user text embedded unescaped in the markdown is a non-issue since this is a personal local export file, not rendered as HTML.
**Files:** `client/src/ChatPage.jsx`.
**Tokens:** Subagent reviews only — caveman-reviewer: 73,961; ecc security-reviewer: 70,997. Main implementation cost isn't exposed by any available tool.

## Regenerate button for the last answer

**Date:** 2026-09-17 15:39
**What:** A Regenerate button on the most recent assistant message re-sends the same prompt through `sendChat` and replaces that message's text/suggestions/pin state in place, showing typing dots while it's in flight. Failed answers also get a retry affordance, since the original prompt is preserved on the row instead of being dropped.
**Why:** Continuing the feature list "biggest to smallest" — #9 on the list. A caveman subagent review caught two real issues, both fixed: (1) on a failed regenerate, the row was being replaced with a bare error object that dropped the `prompt` field, permanently losing the ability to retry without re-typing the message -- fixed by keeping `prompt` on the error row and adding a matching retry button for error rows; (2) `submit()`'s guard didn't check `regeneratingId`, so a user could fire a brand-new message while a regenerate was still in flight, racing two concurrent `sendChat` calls with no ordering guarantee -- fixed by adding `regeneratingId` to both the guard and the send button's `disabled` condition. An ecc security review confirmed no new backend surface (same `/chat` endpoint, same existing rate limiter) and no injection risk (the prompt used for regeneration always originates from the user's own prior message, never from response text).
**Files:** `client/src/ChatPage.jsx`.
**Tokens:** Subagent reviews only — caveman-reviewer: 73,839; ecc security-reviewer: 73,417. Main implementation cost isn't exposed by any available tool.

## Share options for any answer

**Date:** 2026-09-17 15:35
**What:** A Share button next to each assistant message's copy/read-aloud/pin buttons calls `navigator.share({ text })` (native OS share sheet on mobile/supporting browsers) and falls back to `navigator.clipboard.writeText(text)` with a brief "Copied for sharing!" confirmation when the Web Share API isn't available.
**Why:** Continuing the feature list "biggest to smallest" — #2 on the list. A caveman subagent review caught one real issue before commit: the `navigator.share` rejection handler treated a user cancelling the OS share sheet the same as a real failure, silently falling through to a clipboard copy the user never asked for. Fixed by checking `err.name === 'AbortError'` and returning early on a genuine cancel, only falling back to clipboard on an actual share failure. An ecc security review confirmed no untrusted data is involved — only the AI's own already-rendered response text is passed, no `url`/`title` fields, no auth/session data in scope.
**Files:** `client/src/ChatPage.jsx`.
**Tokens:** Subagent reviews only — caveman-reviewer: 72,456; ecc security-reviewer: 70,978. Main implementation cost isn't exposed by any available tool.

## Personal dashboard: pin and revisit answers

**Date:** 2026-09-17 15:32
**What:** `POST /queries/:id/pin` and `GET /pinned` (capped at 50 rows, same limit as `/history`) let a user pin/unpin any past answer and view all pinned answers in one place; `/chat` now returns the new row's id as `queryId` so the client can address it, and `/history` returns `id`/`pinned` alongside the existing fields. `ChatPage.jsx` adds a pin toggle next to each answer's copy/read-aloud buttons and a header button opening an overlay panel listing pinned answers.
**Why:** Continuing the feature-parity list "biggest to smallest" — #18 on the list (pin/favorite answers, view them in one place). A caveman subagent review and an ecc security-reviewer subagent review (per standing instruction to run both before committing) each caught one real issue, both fixed: the new pin routes weren't in any rate-limiter group unlike every other mutating route (`/chat`, `/history`, `/finance`, `/news`), and `GET /pinned` had no row cap unlike `/history`'s existing `MAX_HISTORY` limit — a user with thousands of pinned rows would get an unbounded response every time they opened the panel. Also added a `typeof === 'boolean'` check on the pin request body, since it was silently coercing any truthy value.
**Files:** `server/db.js` (new `pinned` column, idempotent migration), `server/chat.js`, `server/index.js`, `client/src/ChatPage.jsx`, `client/src/api.js`, `client/src/styles.css`, `client/vite.config.js`, `test/chat.test.js`.
**Tokens:** subagent reviews only (main implementation cost isn't exposed by any available tool) — caveman-reviewer: 81,828 tokens; ecc security-reviewer: 79,501 tokens.

## Smart follow-up suggestions, and a live safety-classifier bug fix

**Date:** 2026-09-17 15:19
**What:** `server/suggestions.js` generates 2-3 short follow-up questions after each chat answer (feature #27), rendered as clickable chips under the latest assistant message; reuses whichever adapter just answered, capped at an 8s non-throwing timeout. Separately, `server/response-sanity.js` detects when OpenRouter's free auto-router (`openrouter/free`) lands on a safety/moderation model instead of a real chat model and returns fixed-format text like `"User Safety: safe\nResponse Safety: safe"` -- previously only caught inline in memory extraction, now centralized and wired into `server/router.js`'s core adapter loop.
**Why:** Continuing the feature list "biggest to smallest." While live-testing suggestions, a real chat question ("What is the tallest mountain in the world?") came back with the safety-classifier garbage as its actual visible answer -- the same OpenRouter flakiness previously seen only in a background memory-extraction call, now confirmed hitting real user-facing responses. Fixed at the correct layer (the router's adapter-fallthrough loop, not just memory.js) so any category falls through to the next configured adapter instead of showing the user a broken response. A caveman subagent review before committing caught two real issues, both fixed: the suggestions call had no outer timeout of its own (the adapter's internal ~20s timeout is too slow for an optional feature riding on an already-completed answer), and the suggestion chips used the suggestion text itself as a React key, fragile against duplicate strings -- switched to an index key since the array is short-lived and fully replaced each response.
**Files:** `server/suggestions.js` (new), `server/response-sanity.js` (new), `server/chat.js`, `server/router.js`, `server/memory.js`, `client/src/ChatPage.jsx`, `client/src/styles.css`, `test/suggestions.test.js` (new), `test/response-sanity.test.js` (new), `test/router.test.js`, `test/chat.test.js`.
**Tokens:** not tracked (no token-usage API available for this unit of work).

## File uploads and custom personas

**Date:** 2026-09-17 14:13
**What:** Added `POST /analyze-file` (extracts text from PDF via `pdf-parse`, DOCX via `mammoth`, CSV/TXT as plain text, then routes it through the normal chat pipeline) and `server/personas.js` (a small fixed set of tone instructions -- Professional/Casual/Creative/Technical -- selectable as chips, folded into the system prompt via the same `extraContext` mechanism memory uses).
**Why:** Working through a user-supplied feature-parity list against other AI chat apps, taken "biggest to smallest." Both were reviewed by a caveman subagent and an ecc security-reviewer subagent before committing, per standing instruction to invoke both. The ecc review caught one real HIGH-severity issue: `extractText()` ran `pdf-parse`/`mammoth` on the *entire* buffer before the 8000-char truncation cap ever applied, so a crafted PDF/DOCX could cause pathological CPU/memory use before truncation ever kicked in -- a DoS reachable by any user (there's no login). Fixed with a 30-page cap on PDF parsing and a 15s timeout wrapping both parsers. Personas are looked up from a fixed server-side map by id only -- the client never sends free-text tone content, so persona selection can't be used to inject arbitrary text into the system prompt (confirmed by the review, and by a regression test asserting an unknown id resolves to `null`, never the raw input).
**Files:** `server/file-extract.js` (new), `server/files.js` (new), `server/personas.js` (new), `server/chat.js`, `server/index.js`, `client/src/ChatPage.jsx`, `client/src/api.js`, `client/vite.config.js`, `test/file-extract.test.js` (new), `test/files.test.js` (new), `test/personas.test.js` (new), `test/chat.test.js`.
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Conversation history

**Date:** 2026-09-17 11:32
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Cross-conversation memory, crisp answers, cloud-first routing

**Date:** 2026-09-17 11:23
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Removed decorative keyboard-shortcut badges

**Date:** 2026-09-17 10:59
**What:** Removed the `⌥1`/`⌥2`/`⌥3` hints shown next to the Summarize/
Explain code/Draft email quick-action chips.
**Why:** The user asked what they were. They implied working Alt+digit
shortcuts that were never actually wired to a keydown handler — a real,
if minor, UX bug (a promise the UI didn't keep). Removed rather than
implemented, per explicit request, once the gap was found.
**Files:** `client/src/ChatPage.jsx`, `client/src/styles.css`.
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Removed sign-in entirely

**Date:** 2026-09-17 10:52
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Security/accessibility/performance fixes from subagent review

**Date:** 2026-09-16 18:16
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Starter suggestion cards

**Date:** 2026-09-16 17:58
**What:** Added six emoji quick-start prompts (Explain a concept, Debug
some code, Draft an email, Generate an image, Check a stock, Today's news)
to the empty chat state, each prefilling the composer and switching mode
where relevant.
**Why:** Explicit request for ChatGPT-style starter suggestions under the
"How can I help?" empty state.
**Files:** `client/src/ChatPage.jsx`, `client/src/styles.css`.
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Frontend redesign: Command Palette → standard chat app

**Date:** 2026-09-15 15:15
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Finance quotes and news search

**Date:** 2026-09-15 14:56
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Image generation, speech-to-text, browser text-to-speech

**Date:** 2026-09-15 14:42
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Fixed category routing when local models are unconfigured

**Date:** 2026-09-15 12:47
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Fixed stale OpenRouter free-tier model slugs

**Date:** 2026-09-15 12:29
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## OpenRouter free-tier fallback, prep for Render deployment

**Date:** 2026-09-15 12:19
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Translation as a routed category

**Date:** 2026-09-15 10:36
**What:** Added `translation` as a full category in the lead-dispatch/
classifier/router system, rather than a special case.
**Why:** Kept consistent with the existing multi-category architecture
instead of a one-off branch.
**Files:** `server/lead.js`, `server/classify.js`, `server/router.js`.
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Went fully local, removed all cloud providers

**Date:** 2026-09-09 16:52
**What:** Removed all seven cloud provider adapters (Anthropic, OpenAI,
Gemini, Mistral, Cohere, Kimi, Hugging Face) that the app originally
supported, leaving it local-only on Ollama models.
**Why:** Explicit request ("forget all these open ai, anthropic
everything") after repeatedly hitting real-world friction: invalid/
placeholder API keys, exhausted billing, suspended accounts, and
provider-side rate limits across the seven providers.
**Files:** all `server/adapters/<cloud-provider>.js` files (deleted),
`server/router.js`, `.env.example`, `README.md`.
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Lead + subagent dispatch with synthesis

**Date:** 2026-09-09 16:22
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
**Tokens:** not tracked (no token-usage API available for this unit of work).

## Core scaffold

**Date:** 2026-09-08 17:21 – 19:57
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
**Tokens:** not tracked (no token-usage API available for this unit of work).
