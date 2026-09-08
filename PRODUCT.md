# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Node/Express backend (better-sqlite3, express-session), React (Vite) frontend. User-decided (not delegated).

## Users

Primary user: the builder themself, as a personal daily-driver chat tool — replacing the habit of juggling multiple AI provider tabs/sites for different kinds of tasks. Not designed around anonymous public signups for this phase, though the login screen exists.

## Product Purpose

OmniAgent is a single chat interface that silently routes each request to whichever backend AI is best suited to it (coding, summarization, creative writing, classification, quick answers, general Q&A), with automatic fallback if a backend is unavailable. The user never sees or chooses a backend — they just get an answer.

## Positioning

One tool, best-fit answers, no juggling: the user never has to decide which AI to open for a given task, and the app doesn't go down when one provider does. The mechanism (category classification + specialist routing + fallback chain) is the product's core claim, not just a chat UI skin over one model.

## Operating Context

Single running conversation per session (no multi-conversation history in this phase). Desktop/browser use, logged in via email+password.

## Capabilities and Constraints

- Confirmed: chat with unified responses, quick-action prompt presets (summarize / explain code / draft email), email+password auth.
- Explicitly out of scope for this phase: image generation, speech-to-text, translation, live finance/news data, OAuth/SSO, password reset, multi-conversation history, streaming responses.
- Hard constraint: no backend AI name, logo, or routing detail is ever shown to the user anywhere in the UI.

## Brand Commitments

Name: "OmniAgent". No other backend AI names/icons/branding may appear anywhere in the UI — this is a binding identity constraint, not just a copy preference.

## Evidence on Hand

None (no existing screenshots, testimonials, or content assets). Do not fabricate any.

## Product Principles

- Identity is singular: every visible surface says "OmniAgent," never a provider name.
- Invisible intelligence: the routing/classification mechanism should feel like reliability, not be exposed as a feature the user configures.
- Minimal by default: no icons, gimmicks, or decorative chrome beyond what a chat + auth flow needs.
- Personal tool first: designed for daily solo use, not onboarding funnels or growth loops.

## Accessibility & Inclusion

No specific standard requested; follow standard web accessibility basics (keyboard nav, contrast, focus states) as baseline.
