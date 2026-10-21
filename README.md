# WillpowerLab frontend

The Next.js frontend of WillpowerLab (willpowerlab.com, on Vercel). It talks to the backend,
[`wilplus/backend-cursor`](https://github.com/wilplus/backend-cursor) (Flask, Railway, Supabase), through
the BFF routes under `src/app/api/v2/*`.

## Start here

Every doc in both repos, with its label (In force, Reference, History or Archive), is listed in the
backend's master doc: **[`README.md` in `backend-cursor`](https://github.com/wilplus/backend-cursor/blob/main/README.md)** (backend N106).
The backend's `main` is the one source of truth (backend N95).

## This repo's own pages

**The rules (In force)**

- [`CLAUDE.md`](CLAUDE.md), and [`AGENTS.md`](AGENTS.md) for other coding agents
- [The Feedback walk and the chat](docs/flows/feedback-walk-and-chat.md)
- [The coach panel](docs/flows/coach-panel.md)

**How it works today (Reference)**

- [willab upload proxy (Cloudflare Worker)](cloudflare/upload-proxy/README.md)
- [The two coach feedback lanes](docs/COACH-FEEDBACK-LANES.md)
- [Designer brief — Wave 5 (October 2026)](docs/DESIGNER-BRIEF-wave5-2026-10.md)
- [WIL-74 principles (founder, 2026-10-20)](docs/PRINCIPLES-WIL-74.md)
- [Confidence recognizer — FE pointer](docs/SPEC-confidence-recognizer.md)
- [SPEC — the in-thread top-up card (Lounge)](docs/SPEC-lounge-topup-card.md)
- [Coach review flow — judgement first, one action per screen](docs/coach-review-flow/SPEC.md)
- [Ideal-text flow — how the app talks to the user between takes](docs/ideal-text-flow-communication.md)
- [Life Panel FE — what shipped, what it assumes, what is still open](docs/life-panel-fe-status.md)
- [Life Panel — source artifacts still outside the repo](docs/life-panel-sources/README.md)
- [The Life Panel — implementation document](docs/life-panel-spec.md)

History is listed in the backend's master doc. The archived notes left `main` on 2026-10-21
(backend N107); every one is in git history, at
[the last commit that had them](https://github.com/wilplus/frontend-cursor/tree/501da43874460770310b24fafc664c4f5e606114/docs).

## Setup

- `npm install`
- Copy `.env.example` to `.env.local` and set Supabase + API URL.
- `npm run dev`

## Scripts

- `npm run dev`: start the dev server
- `npm run build` / `npm run start`: production
- `bash scripts/local_ci.sh`: the merge gate, run locally before pushing (Node 22)

## Older tooling

This repo once tracked tasks with [Task Master](https://docs.task-master.dev/) (`.taskmaster/`); its
files are archived (backend N106). Its commands still work: `npx task-master next`, `npx task-master list`.
