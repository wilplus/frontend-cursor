# FE handoff — the setup wizard fills itself from an uploaded document

**Pair:** [PROMPT-life-panel.md](PROMPT-life-panel.md) · [PROMPT-FE-life-panel.md](PROMPT-FE-life-panel.md)
**Date:** 2026-07-30 · **Status:** backend shipped, FE not started
**Founder ask:** *"like a CV you upload and all the forms are filled — create the
goals from the document for each section of the principles onboarding."*

> **FE status, 2026-07-30: BUILT.** See §"What the FE did with this", at the
> bottom, and `docs/life-panel-fe-status.md` §8. One thing in this handoff was
> declined on purpose and needs a backend decision: **`save: true`**. The
> reason is in §"Saving", answered inline.

Item 9 already let the user upload their current strategy document and get a flat,
tickable list of drafted rows. This is the rest of it: the same reading, **bucketed
into the wizard's own steps**, so the Weekly step opens with the weekly goals already
in it instead of empty next to a list the user has to re-sort by hand.

---

## The one new call

```
POST /v2/life/setup/prefill-from-document
{ "document_id": null,      // optional — defaults to the newest processed upload
  "save": false }           // optional — see "Saving", below
```

`200` →

```jsonc
{
  "document": { "id": "…", "file_name": "strategy.docx", "status": "processed",
                "char_count": 8123, "created_at": "…" },

  "sections": {                       // ALWAYS all eight keys, in wizard order
    "daily":       [ /* rows */ ],
    "weekly":      [ { "kind": "goal",
                       "title": "Three deep-work blocks",
                       "body": "",
                       "horizon": null,          // the life_items horizon, may be null
                       "due_label": "[Aug]",     // the user's own notation, verbatim
                       "due_at": "2026-08-01",   // parsed only where unambiguous
                       "bet": "company",         // life | company | dream | null
                       "section": "weekly",
                       "external_id": "goal:…",
                       "order_key": 1000.0,
                       "source": "document",     // ← N5: this row is the model's
                       "confirmed": false } ],
    "monthly": [], "quarterly": [], "yearly": [],
    "five_year": [], "ten_year": [], "twenty_year": []
  },

  "unplaced":      [ /* same row shape, section: null */ ],
  "habits":        [ /* kind: "habit" */ ],
  "distractions":  [ /* kind: "distraction"; body IS the environmental response */ ],
  "bets":          [ /* the three, at their locked rank in order_key */ ],

  "counts": { "goals": 12, "placed": 10, "unplaced": 2,
              "habits": 3, "distractions": 1 },
  "setup_sections": ["daily", "weekly", "monthly", "quarterly",
                     "yearly", "five_year", "ten_year", "twenty_year"],
  "saved": false,
  "merged": { "added": {}, "skipped": [] },
  "written": false
}
```

`400 NO_DOCUMENT` when there is no readable upload to draft from (nothing uploaded
yet, or the extraction failed) — show the upload step, not an error toast.

`GET /v2/life/setup` now also returns `setup_sections`, so the step→key mapping comes
from the server rather than a second list on the client that drifts.

---

## How to wire it

1. **Upload step** — unchanged: `POST /v2/life/setup/document` (multipart `file`,
   `.pdf` / `.docx` / `.txt` / `.md`, ≤15 MB).
2. Right after a successful upload, call **prefill-from-document** once and keep the
   payload in form state.
3. Each goal step renders `sections[<its key>]` **already in the list**, above the
   `+ Add a goal` button. The user edits, deletes, adds, and taps Next exactly as
   today — `PUT /v2/life/setup` on every step is unchanged.
4. Show `unplaced` on the **first** goal step (or wherever it reads best) under its
   own heading: these are goals the document did not file under a horizon, and they
   must be visible somewhere or they are lost. One tap should move one into a step.
5. `POST /v2/life/setup/complete` at the end, unchanged.

**Nothing about the existing flow breaks.** `/setup/propose-from-document` (the flat
review list) still works and is untouched — use whichever fits the screen. Both share
one extraction, so calling only the one you render costs one model call, not two.

### Saving

`save: false` (the default) writes **nothing**: the payload is form state and the
user's own Next saves each step.

`save: true` merges the drafted rows into the saved setup answers, so the prefill
survives closing the wizard — which is what the step's own copy ("Saved. You can
close this and come back to it.") already promises. The merge is non-destructive:

- a step the user already answered **keeps what they typed**; drafted rows are
  appended after it, never in place of it;
- a goal whose title is already in the step is not added twice, so re-running the
  prefill converges instead of accumulating;
- a step whose saved value cannot be appended to (it holds a string, say) is left
  **exactly** as it is and named in `merged.skipped`;
- `_step` and every other key you own are carried through untouched.

`merged.added` is `{ "<section>": <how many rows were added> }` — use it if you want
to say "12 goals from your document" after the upload.

The shape written for a step that had no saved answer is `{"goals": [...]}`; a step
already saved as a bare list stays a bare list. If your wizard stores a step under a
different shape, tell the backend and we widen `merge_prefill_answers` — do not
work around it by re-writing the slot on the client.

> **FE answer, 2026-07-30: this wizard stores a different shape, so `save: true`
> is not called.** `SetupFlow` does not hold a slot per step. It holds ONE object,
> `{bets, horizons: {<section>: [...]}, unplaced}`, and PUTs the whole of it on
> every step; `step` on the wire is only the resume marker. A server-side merge
> under `save: true` would therefore write **top-level** `answers["weekly"] =
> {"goals": [...]}`, which `coerceSetupAnswers` never reads — it reads
> `answers.horizons.weekly`. The prefill would report itself saved and come back
> empty on resume, which is worse than not saving at all.
>
> Taking you at your word rather than reshaping the slot here: **the FE declines
> `save: true` and leaves the default.** Nothing is lost by it. The merged payload
> is written straight back through the ordinary `PUT /v2/life/setup` the moment it
> lands, which persists all eight steps at once through the path the rest of the
> form already uses, and gives the same survives-a-close guarantee `save: true`
> was for.
>
> **The ask:** widen `merge_prefill_answers` to write into `answers["horizons"]
> [<section>]` when the saved answers carry a `horizons` map, and keep `unplaced`
> as a passthrough key. Then `save: true` becomes usable and the FE will switch to
> it. Until then, the durability is honest and comes from the FE.

---

## The rules this has to respect on your side

| | |
|---|---|
| **N5 — nothing appears already accepted** | Every prefilled row carries `source: "document"` and `confirmed: false`. A prefilled goal must be **visually distinct** from one the user typed (a badge, a tint — your call) until they keep or edit it. This is the one non-negotiable in the list. |
| **No scores** | The payload has none, and `counts` is a count of rows, not a rating. Do not render it as progress, completeness, or a percentage (AC-9). |
| **Copy is founder-signed** | The response carries **keys only**, deliberately. Section labels ("Weekly", …) stay yours; any new user-facing string on this screen needs founder sign-off. |
| **The bets are locked** | `bets` comes back at rank 1 The Life · 2 The Company · 3 The Dream (L-2a). The document may word a bet; it can never reorder them, and neither can the client. |
| **The unplaced are not decoration** | `unplaced` is goals the user actually wrote. Dropping them silently is the one failure this feature cannot afford. |

## What the backend does *not* do

- It does **not** create `life_items` rows. A prefilled row becomes a real item only
  through `POST /v2/life/setup/apply-proposed` with exactly the rows the user ticked,
  or through the ordinary `/setup/complete` path. The rows here are already in the
  shape `apply-proposed` accepts — send them back unchanged.
- It does **not** invent goals. The extraction prompt is a transcriber: "never
  invent, never complete, never add an ambition they did not state." If a step comes
  back empty, the document said nothing for that horizon.
- It does **not** guess a step. A goal is placed by what the document filed it under,
  then by its horizon, and otherwise goes to `unplaced`. A "[NOW]" goal is unplaced on
  purpose — daily vs weekly is exactly what the document did not say.

## No migration

Uses `life_setup` and `life_setup_documents` as they are. `add_life_setup_documents.sql`
still needs to have been run (item 9) for the upload step to work at all.

---

## What the FE did with this (2026-07-30)

`FILTER: JUSTIFIED-SCAFFOLDING — cat {SCAFFOLDING} — fences {clear, AC-9 held by
rendering counts as rows only; new copy needs sign-off} — locks {clear} — redirect:
tighten word→slide bucketing at the two-clocks boundary`

**Wired as specified**, with five decisions worth naming:

1. **One call, not two.** The wizard renders the bucketed read and takes the
   habits, distractions and bet wording out of the *same* payload for the tick
   list, so an upload costs one model call. `proposeFromDocument` was **deleted
   from the FE client** for that reason — the endpoint is live and unchanged, but
   a client function nothing calls reads as shipped behaviour in every review it
   survives. `copy.test.ts` holds copy to that rule; this applies it one layer
   down.

2. **The prefill runs automatically on upload.** Filling is the point of the
   upload. That is safe here for exactly one reason: nothing is created. Every row
   lands `source: "document"`, `confirmed: false`, and the steps it fills are all
   still ahead of the user. The manual `✨ Draft from my document` button remains
   for the other door — somebody who uploaded in an earlier sitting.

3. **N5 is rendered, not just stored.** An unconfirmed drafted row is dashed and
   tinted, carries a `From your document` badge and a line saying it was not
   written by them, and offers `Keep`. Editing any field counts as keeping —
   asking somebody to press Keep on a line they have just rewritten is asking
   twice. The badge survives a save and a resume, because `coerceSetupAnswers`
   round-trips `source`/`confirmed`; rows saved before this feature existed
   default to the user's own, so no old draft gets marked.

4. **The unplaced ride in the answers, and are shown twice.** They live at
   `answers.unplaced` so every step's PUT saves them, and they render on the first
   goal step (the screen straight after the upload) *and* again above Finish while
   any remain. A row still sitting there at Finish becomes nothing, so nobody
   should reach that button without having seen them. A section key with no step
   in this build is parked there too rather than dropped.

5. **`due_at` is ignored on purpose.** `due_label` is the source of truth (spec
   §3.2); writing the parsed date into the form would replace "[Aug]" with a day
   nobody chose. `body` on a goal is kept as a `note` and rendered when non-empty
   — almost always it is empty, but the alternative is silently discarding words
   the user wrote.

**Verified:** 768 tests pass (57 files), including the `copy.ts` fence suite;
`tsc --noEmit` clean; `next lint` clean on all four changed files. The production
build compiles and the app's own pages generate; the build cannot be completed in
CI here because unrelated routes need `OPENAI_API_KEY` and Supabase credentials.

**Not verified:** nothing was exercised against a live backend. Every shape above
is read defensively, but the first real payload is still the first real payload.
