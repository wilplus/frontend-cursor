# AGENTS.md — read this first

This file exists so that ANY coding agent — whatever filename its harness
conventions look for — finds the house rules before touching this repo.

**The operating doctrine lives in [`CLAUDE.md`](CLAUDE.md). Read it before
any work.** It is canonical there on purpose (single home, anti-drift): do
not fork or paraphrase its content into this file. It carries:

- the north star (F1 / F2) and the LOCKED choices (L1 / L2 / L3),
- the FENCES — AC-9, CONSTRUCT, BLIND COACH, LIVE LOOP, NORTH-STAR LOCK,
- the **WILLAB DECISION FILTER**, to be run on EVERY task before work
  starts (feature, refactor, bugfix, copy, infra — everything),
- how the filter applies to this frontend specifically (surfacing layer;
  most FE work is F1-SURFACE or SCAFFOLDING; the fences are where FE
  decisions most often must stop).

The filter is kept **identical** to the backend repo's copy on purpose —
a divergence between the two is itself drift. Same rule applies here:
this pointer must never grow a competing version of the doctrine.

Project state, system map, shipping mechanics, and the maintainer
checklist: [`docs/HANDOFF.md`](docs/HANDOFF.md) here, and the system-level
[`docs/HANDOFF.md`](https://github.com/wilplus/backend-cursor/blob/main/docs/HANDOFF.md)
in `backend-cursor`.
