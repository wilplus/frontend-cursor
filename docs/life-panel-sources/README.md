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

**What was built without it:** nothing. There is no weekly-review view. `life_weeks`
is in the data model and L-2b routes the batch of three proposals to it, but no
FE item specifies the surface and none was invented.

**What lands here:** `weekly.md`.

**What changes when it does:** a new `/panel/week` view, built from the
template's own sections. It is the last unbuilt view in the spec.

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

## Before committing the two documents, read this

They are not code. They contain the founder's anchor, bets, goals, distractions
and habits. Committing them puts that in git history permanently, readable by
anyone with repo access, and git history is not something you can quietly amend
later.

**The default should be that they never get committed.** The card only needs the
FRAME: section order, exact labels, the wording of the fixed parts. The content
is rendered from `life_days` at runtime. So:

- **Preferred** — paste the documents in chat. The frame is extracted into
  `copy.ts` and the Today view; the personal content is not written to any file.
- **If you want them in the repo anyway** — that is your call, it is your repo,
  and the spec's own privacy fence (§2) covers the `life_*` corpus rather than
  these. Say so explicitly and they get committed here.

The timeline HTML has no such question. It is code.
