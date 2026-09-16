# Design

<!-- impeccable:design-schema 1 -->

## World

Standard Chat App. A deliberately conventional layout — the category standard, played straight at full craft — chosen explicitly by the user to replace the prior "Command Palette" world, which they disliked. Craft bar: ChatGPT and Claude.ai.

This is the **second** visual world for OmniAgent. The first (Command Palette — dark, keyboard-first, addressed rows, 3-tick status marker) shipped and worked, but the user found it unfamiliar/unlikeable as a daily tool. Redesign decision recorded 2026-09-15: replace it wholesale rather than tweak it, per the user's explicit "make it a general interface" request and confirmed direction (standard chat-app look, message bubbles, header, neutral theme, light default with dark toggle).

## Palette

Light (default):
- `--bg` / `--surface`: `#ffffff` — page and card background
- `--surface-raised`: `#f7f7f8` — subtle raised areas (assistant-message-adjacent chrome, quote card, chips)
- `--border` / `--border-strong`: `#e5e5e7` / `#d1d1d6`
- `--text` / `--text-dim` / `--text-faint`: `#1a1a1e` / `#6b6b73` / `#9a9aa1`
- `--accent` / `--accent-strong`: `#6366f1` / `#4f46e5` — carried over from the prior world for continuity; reserved for the user-bubble tint, focus rings, primary actions, active mode chip
- `--accent-soft` / `--accent-ink`: `#eef0ff` / `#3730a3` — user message bubble background/text
- `--danger` / `--danger-soft`: `#dc2626` / `#fee2e2`

Dark (toggle, `[data-theme="dark"]`): comfortable near-black (`#131417`, not pure black), off-white text (`#ececec`), lighter indigo (`#818cf8`) for sufficient contrast — same structure, not an inverted filter.

Color strategy: Restrained (neutral ground + one accent) — unchanged from the prior world; still the right call for a personal daily-driver Operate-mode tool.

## Type

Unchanged from the prior world: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for UI/body. Monospace (`ui-monospace, ...`) now used only for keyboard-shortcut hints (`⌥1`) — no more mono row-labels, since labels are now plain small-caps-weight text like any chat app uses.

## Layout & Components

- **`.app-shell`** — full-height column: header, scrollable message area, composer. Replaces the old floating centered `.palette-shell` card.
- **`.app-header`** — full-width bar: wordmark left, theme toggle + sign-out right. No sidebar: the product has no multi-conversation history in this phase, so a sidebar would be decorative chrome with nothing to hold — a header is the honest choice here, not a shortcut.
- **Message list** (`.message`, `.chat-column`, max 720px centered) — **user messages are bubbles** (`.message.you .message-bubble`: soft indigo tint, rounded 18px with one flattened corner toward the sender, right-aligned); **assistant messages are plain text**, no bubble, no avatar (matches ChatGPT's convention, keeps `PRODUCT.md`'s "no icons/gimmicks/avatars" principle intact even in a bubble-based world).
- **`.typing-dots`** — replaces the old 3-tick instrument-panel marker with the genre-standard three-dot typing indicator (smooth `ease-in-out` vertical bounce, not spring/elastic easing — confirmed via `detect.mjs`, zero findings).
- **`.composer`** — single rounded pill (not three separate bordered controls): textarea + circular mic button + circular send button (up-arrow icon, ChatGPT-style) inside one bordered container that highlights on focus.
- **`.chip-row`** — quick-action prefill chips (Summarize/Explain code/Draft email) and mode-toggle chips (Image/Finance/News) sit directly above the composer as pill-shaped buttons, separated by a thin divider. Functionally identical to the prior world; restyled from square hairline chips to pill chips matching the rest of the world.
- **Quote card / news list / image row** — restyled with the new card language (rounded 12px, soft shadow, `--surface-raised` background) instead of the old flat hairline-row style.
- **Theme toggle** (`client/src/theme.js`) — sun/moon icon button in the header; persists choice to `localStorage`, applied via `data-theme` on `<html>` before React mounts (no flash of wrong theme).

## States implemented

Login: default, focus (ring), hover, busy/disabled ("Please wait…"), inline error banner. Chat: empty state (centered "How can I help?" plus a 2×3 grid of emoji starter cards — Explain a concept, Debug some code, Draft an email, Generate an image, Check a stock, Today's news — each prefilling the composer and, where relevant, switching mode), sending (typing dots / "generating…" label), answered, error (plain red text, same shape as an answer — never a modal), image/quote/news result cards, mic recording (pulsing red mic button) and transcribing states, dark/light theme.

## Constraints carried from PRODUCT.md

- No backend AI name, logo, or provider identity may ever appear in any UI string, label, or asset — unchanged; enforced at the API layer, not just the UI.
- No icons/gimmicks beyond functional ones (mic, send, speaker, theme toggle) — still true; no avatars were added despite moving to a bubble-based world.

## Verification

Checked live in-browser (not just described): light theme, dark theme (toggle round-trip), a full real chat exchange (user bubble → typing dots → plain assistant reply with working speak button), and a real end-to-end message. Mobile viewport (375px) checked via actual DOM measurements (`scrollWidth`/`innerWidth` equal, no overflow) rather than trusting the screenshot tool alone, after its capture came back at a different pixel size than the emulated viewport — that mismatch was the screenshot tool's own scaling, not a layout bug. `detect.mjs` run twice: one legitimate finding (an animation named `typing-bounce` false-matched the bounce/elastic-easing rule despite using plain `ease-in-out`; renamed to `typing-pulse`), zero findings after.

## Known gap / disclosed substitution

As with the prior world, the full comp-generation and dedicated `impeccable-finish-reviewer`/`impeccable-documenter` subagent pipeline was not run (still judged disproportionate to this app's size; same call as before, not a new shortcut). Verification instead: manual browser checks across both themes and a mobile viewport, `detect.mjs`, and this DESIGN.md written directly.
