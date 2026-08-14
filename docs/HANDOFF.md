# HANDOFF — frontend (willab), 2026-08-14

State-of-the-world for a maintainer picking this repo up cold. The
**system-level handoff** (product goal, backend architecture, billing,
deploy, parked work) lives in `backend-cursor/docs/HANDOFF.md` — read that
first. This file is the FE half only.

**Before any work: read [`CLAUDE.md`](../CLAUDE.md)** (the doctrine — north
star, fences, the WILLAB DECISION FILTER that gates every task). `AGENTS.md`
at the repo root is a pointer to it for non-Claude agent harnesses.

## What this repo is

Next.js (App Router, TypeScript) — the surfacing layer at
willpowerlab.com. The backend (`backend-cursor`, Flask on Railway) is
reached ONLY through the BFF proxy routes under `src/app/api/v2/*`; the
browser never calls the backend origin directly, and backend secrets
(e.g. the pipeline sweep secret) must never reach the client — a server
route may hold them, the page may not.

Hosting is configured outside this repo (no deploy config is checked in).
Confirm platform access (domain, env vars, build hooks) as part of the
handoff.

## Load-bearing FE contracts (each has a single home)

- **User-facing copy is founder-signed (LIVE LOOP fence).** The backend
  sends KEYS; the FE holds the copy, one home per vocabulary:
  `src/lib/willab/trackedChangeWhy.ts` (change "why" lines, incl.
  `CONFIDENT_VOICE_WHY`). Never surface a score, ratio, or classifier
  output (AC-9 / CONSTRUCT fences).
- **Lane display mapping**: `src/components/willab/displayKind.ts` —
  source-before-kind precedence (acoustic_swap → Delivery,
  confident_voice → Confident Voice, …). The backend twin is
  `services/ideal_decision_ledger.py::lane_class`; a contract test pins
  the two against each other — change them together or not at all.
- **Deck scroll/grain model**: `src/lib/willab/deckScroll.ts` — pure
  functions (slide → screen → chunk hierarchy, `SCREEN_MAX_CHUNKS`,
  bubbling, edge detection). UI components consume it; logic changes go
  here, not in components.
- **API validation**: `src/services/api/*.ts` parse backend payloads
  field-by-field (e.g. `bestPresentation.ts::fetchVoiceAlbum`) — unknown
  fields are dropped by construction, which is how AC-9 stays enforceable
  on the wire. Keep that style.

## Key surfaces (post-cleanup, 2026-08-14)

- `/game` — the labelling game (rounds render in payload order — the
  backend owns queue order) + the **Voice album** tab (mirror of the
  three-way aligned moments; founder-signed empty state).
- The deck/transcript review stage — `TranscriptReviewDeck.tsx`
  (three-tier rail, optimistic lock), `PresentationInput.tsx` (binary
  upload screen: dropzone + Proceed/Skip only).
- `/admin/tokens` — the ONLY admin page left (`/admin/pipeline` and
  `/admin/learning` were deleted 2026-08-14; `AdminGate` stays for
  tokens). Admin access is keyed to the `admin_users` table (backend).

## How to ship

Branch off fresh `origin/main` → PR → CI (`.github/workflows/tests.yml`)
→ squash-merge. When GitHub Actions is out of allowance minutes
(runner-allocation failures — see the backend HANDOFF for the full
story), the founder-ruled fallback is local evidence, documented in the
squash commit: `npm run lint`, `npx tsc --noEmit`, `npm test`,
`npm run check:bff`, and the Playwright e2e where feasible.

## Parked FE work (spec exists, build not ordered)

- **§11.5 / §11.6 modal auto-open + smart re-triggering policy** — specced
  in `backend-cursor/docs/SPEC-parts-locking-and-layers.md`; FE build not
  yet ordered (locked chunks drop interruption priority; Corrections >
  Swap > Style precedence).
- **e2e `continue-on-error` flip** — planned once the deck e2e shows a
  quiet green track record.

Everything else that looks unfinished is listed (with owners and
preconditions) in the backend HANDOFF's "Parked work" section.
