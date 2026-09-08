# Design

<!-- impeccable:design-schema 1 -->

## World

Command Palette. OmniAgent presents itself like a Spotlight/Raycast-style launcher, not a chat-bubble AI product: one centered floating palette, keyboard-first feel, no avatars, no gradients, no rounded chat bubbles.

Chosen via `new-work` direction round (seed key `4406971d`): assigned candidate was "Postal Sorting Office" (mail-routing metaphor); user picked the alternate own-grounded candidate, "Command Palette" ("Impeccable's pick"), over both the assigned direction and the standing conventional-chat-UI exit.

## Palette

- `--bg: #0b0c0e` — page ground
- `--surface: #131417` / `--surface-raised: #1b1d21` — card and chip backgrounds
- `--border: #26282d` / `--border-strong: #34363c` — hairline dividers, hover borders
- `--text: #ededef` — primary ink
- `--text-dim: #93959d` / `--text-faint: #5b5d64` — secondary/placeholder text
- `--accent: #6366f1` / `--accent-strong: #7b7ef5` — the one signal color, reserved for the active/routed state, focus, primary actions
- `--danger: #e5484d` on `--danger-soft` — error state only

Color strategy: Restrained (neutral ground + one accent), chosen because this is an Operate-mode personal daily-driver tool — expression must not outrank task legibility.

## Type

- UI/body: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` (system stack — Operate surfaces are well served by workhorse UI faces, not a display face).
- Monospace: `ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace` — used only for keyboard-shortcut chips (`⌥1`, `⌥2`, `⌥3`) and the row-label caps (`YOU`, `OMNIAGENT`), never as decoration.

## Components

- `.auth-card` — 400px card, hairline border, soft offset shadow (not a flat SaaS card).
- `.palette` — the chat surface: fixed input row on top, a **fixed** quick-action chip row beneath it (this row never reorders or scrolls based on usage — it is static "terrain"), then a scrolling conversation log below.
- Conversation rows (`.row`) are addressed list rows, not chat bubbles: a small mono uppercase label (`YOU` / `OMNIAGENT`) plus body text, separated by 1px hairlines.
- `.ticks` — the one authored motion moment: a 3-segment stepped marker (sent → routed → answered) that lights up in discrete steps, not a spinner fade. Donated from an instrument-panel/nixie-counter discipline considered during the direction round.
- Quick-action chips never wrap their label text; on narrow viewports the row scrolls horizontally instead of squeezing.

## States implemented

Login: default, focus, hover, busy/disabled ("Please wait…"), inline error banner.
Chat: empty state, sending (ticks stepping), answered, error (inline, in the same row shape as an answer — never a modal).

## Constraints carried from PRODUCT.md

- No backend AI name, logo, or provider identity may ever appear in any UI string, label, or asset. Enforced at the API layer too (`/chat` returns only `{ response }`).
- No icons/gimmicks beyond the wordmark and functional chip icons (kbd hints only).

## Known gap / disclosed substitution

This build skipped the full comp-generation and dedicated `impeccable-finish-reviewer` / `impeccable-documenter` subagent pipeline (no image-generation tool was available in this session, and the full multi-agent review was judged disproportionate to a two-screen personal-tool MVP). Verification instead: manual desktop + mobile screenshots, the mechanical `detect.mjs` pass (zero findings), and this DESIGN.md written directly rather than by the documenter agent. Flag for a fuller pass if this surface grows past the two current screens.
