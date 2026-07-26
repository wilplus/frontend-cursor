# Life Panel — source artifacts still outside the repo

Two parts of the panel were built from a **description** rather than from the
original, because the originals live on the founder's machine and have never
been in this repo (checked: no file, no git history, nothing in `cache/` or
`docs/archive/`).

Until they land, both are marked in `docs/life-panel-fe-status.md` as invented.
This directory is where they go.

---

## 1. The daily governance document

**Where it is now:** the founder's machine. `docs/life-panel-spec.md` §4.1 lists
it as "the two documents pasted in this thread"; it did not reach the repo.

**What was built without it:** `src/app/panel/today/page.tsx`. The `life_days`
columns in spec §3.3 gave the field list, and FE-6 gave the section order. The
wording, the framing and the layout are written to fit those, not ported.

**What lands here:** `daily.md` — the template as you actually use it.

**What changes when it does**

| File | Change |
|---|---|
| `src/lib/life/copy.ts` → `DAY` | Every label replaced with yours, verbatim. Section headings, the one-thing wording, the closing question. |
| `src/app/panel/today/page.tsx` → `MorningCard` | Section order and grouping matched to the template. |
| `src/lib/life/types.ts` → `LifeDayMorning` | Only if the template carries a field `life_days` has no column for. That is a backend change too, so flag it rather than adding it quietly. |

---

## 2. The weekly governance document

**Where it is now:** same.

**What was built without it:** `/panel/week`, against the live
`GET`/`POST /v2/life/week` contract (BE #262): habits that failed and why, goals
that moved and what is next, the main distraction, the one environmental change,
the becoming sentence, the L-2b batch of three, and the untagged-note read.

**What lands here:** `weekly.md`.

**What changes when it does:** labels and section order only. An earlier version
of this file called the weekly view blocked on the document. It was not: the
data contract was already there.

---

## 3. The timeline renderer

**Where it is now:** `~/Documents/timeline/index.html` on the founder's machine.
Single file, no build, no dependencies.

**What was built without it:** `src/components/life/TimelineCanvas.tsx`. The
mechanics described in FE-8 are all implemented (drag to pan, cursor-anchored
wheel zoom, pinch, tap for detail, per-bet hide, three tiers, bets as bands,
goals as markers). Whether they *feel* like the original is unverified.

**What lands here:** `timeline-original.html`, committed as reference and never
imported by the app.

**What changes when it does:** `TimelineCanvas.tsx` is diffed against it, and
anything the original does better is taken. The styling stays the app's, per
FE-8; only the interaction model is up for adoption.

**No personal data.** The events live in `localStorage` / Firestore, not in the
file, so this one is safe to commit as-is.

---

## Do not commit the two documents

Not just risky, **redundant** (backend session, 2026-07-26). The content already
has a designed home: `life_strategy` rows behind RLS, one version per horizon,
written either by setup generation or by `plan_strategy` in the importer.
Committing the documents would put a second, permanent, unprotected copy of that
material in git history, readable by anyone with repo access, of exactly the
class of data the schema exists to protect.

**The frame belongs in `copy.ts`. The content belongs in a table with RLS on it.**

So: **paste the documents in chat for frame extraction only.** Section order,
exact labels, the wording of the fixed parts get written into `copy.ts` and the
views; nothing personal is written to any file. The runtime content comes from
`life_days` / `life_weeks` / `life_strategy` where it already lives.

The timeline HTML has no such question. It is code, the events are not in it,
and it can be committed here normally.
