# BE handoff: the Life Panel document dock (kind-aware drafting)

**From:** Frontend
**Date:** 2026-07-31
**Branch:** `claude/life-panel-ui-redesign-5nt1ze`
**Read first:** `docs/life-panel-fe-status.md` §4 (the assumed contract) and §8
(the chrome pass this came out of). `handoff-life-panel.md` is still the map of
what stands between the panel and launch; nothing here changes that list.

`FILTER: JUSTIFIED-SCAFFOLDING — cat {SCAFFOLDING} — fences {clear} — locks {clear} — redirect: tighten word→slide bucketing at the two-clocks boundary`

> ## ANSWERED — BE, 2026-07-31 (`claude/life-panel-doc-dock-be-m6e8rc`)
>
> Everything below was taken up. `kind` is honoured, `phrase` / `principle` /
> `win` are emitted, `apply-proposed` creates all of them from one shared tuple
> with a test asserting the two endpoints agree, drafted phrases carry
> `collection: "wall"`, and provenance was decided as a third origin column.
> One migration to run; no flag to flip.
>
> **What the FE did in response** (this branch, after the reply):
>
> | Their answer | Our change |
> |---|---|
> | `apply-proposed` takes an optional top-level `document_id` | `applyConfirmedItems(items, documentId)` sends it. The dock and setup both pass what they have. |
> | `propose` returns a `document` object | `proposeFromDocument` now returns `{documentId, items}`. This is what lets the **un-hinted** "draft from my document" press stamp provenance at all: it names no document, so only the response knows which one was read. |
> | A line over the limit arrives as `title` (the opening) + `body` (the whole thing) | The review row renders and edits the WHOLE line, as one text, and re-applies the same split on the way back out. See below. |
> | `count` can come back lower than the ticks | Expected and unused. Nothing on this side treats a short count as a partial failure. |
> | `kind` is validated; a tenth kind is a 400 | Unreachable from here: the FE sends only the nine, typed. The retry-without-the-field stays as insurance against an older deploy and, as you say, will not fire. |
> | `origin_document_id` rides `serialize_item` | Deliberately not read. No surface displays provenance, and a field nothing renders is a field that reads as shipped without being. Say the word if a surface should show it. |
>
> **A second read of this reply caught one more**, after the first pass shipped:
> `DraftList` was re-sorting the response. It led with a fixed
> `["bet", "goal", "habit", "distraction"]`, which was harmless while those were
> the only kinds a document could yield and wrong the moment there were more —
> a document opened from Phrases that also held goals rendered its GOALS first,
> **on the Phrases screen**, burying the rows you had deliberately put at the
> top. Groups are now ordered by first appearance, so the server's order is the
> order, and the rule lives in `lib/life/draftGroups.ts` with a test rather than
> in a list inside a component that the next kind would have to know to edit.
>
> **The title/body pair was the one answer that needed real work here**, and it
> is worth naming because it was an N5 hole rather than a nicety. The review row
> rendered `title` only. So a 600-character phrase was ticked on a 500-character
> row: the user approved less than what would be created. Worse, editing that
> row rewrote `title` while `body` kept the untouched original, and `body` is
> the field that carries the line — so the row that landed was not the row that
> was approved, in a flow whose whole claim is that it cannot be. Now a pair
> renders as one textarea holding the full line, and an edit re-applies the cut
> at the length the backend used, so an untouched row round-trips byte for byte.
> The cut is read off the payload, never assumed: 500 is yours to move.
>
> Nothing below is stale except where this box says otherwise. It is kept as
> the record of what was asked.

---

**One ask, three confirmations, and one thing that is deliberately not yours.**

Nothing here is a blocker for the FE branch: it is merged-ready and shipping it
ahead of this work cannot break anything that works today (§4 explains why). The
ask is what turns three of the nine panel views from a working affordance that
returns nothing into a working affordance that returns rows.

---

## 1. What changed on the FE, in one paragraph

The strategy-document upload used to have exactly one door, at the foot of
`/panel/goals`. It now sits in a dock under **every** panel view: upload a file,
the FE drafts rows from it, the user ticks the ones they want, presses Add, and
only those are created. Same three endpoints as before, same tick-and-Add
review, same "nothing is created without being shown first" (N5). What is new is
that the dock tells you **which view the user was standing on** when they handed
the document over.

## 2. The ask: honour `kind` on propose, and emit three more of them

### 2.1 The request the FE now sends

`POST /v2/life/setup/propose-from-document`

```jsonc
{
  "document_id": "uuid",   // optional, unchanged; absent = "the latest one", as today
  "kind": "phrase"         // NEW, optional
}
```

`kind` is one of the `/v2/life/items?kind=` taxonomy — spec §3's nine, same
spelling, no new vocabulary:

```
principle | win | phrase | bet | goal | task | habit | distraction | event
```

It is sent when, and only when, the user is standing on a view that holds a
single kind:

| View | `kind` sent |
|---|---|
| `/panel/principles`, `/panel/principles/:id` | `principle` |
| `/panel/phrases` | `phrase` |
| `/panel/wins` | `win` |
| `/panel/goals` | `goal` |
| `/panel/distractions` | `distraction` |
| `/panel/timeline` | `event` |
| `/panel/today`, `/panel/week`, `/panel/strategy`, `/panel/data` | *(omitted)* |

The mapping lives in `src/lib/life/uploadKind.ts` and is unit-tested. An omitted
`kind` must behave **exactly as the endpoint does today** — that is the request
every one of these views made before the dock existed, so a null is the original
case, not a degraded one.

### 2.2 What we need back

Today the endpoint emits `bet`, `goal`, `habit` and `distraction`. That means the
dock produces rows on Goals, Distractions and Timeline, and comes back empty on
**Phrases, Principles and Wins** — the three views the founder named when asking
for this.

So: **read the stored document text for the hinted kind and return rows of it.**
A phrases document is a list of lines the person wants back at the right moment;
a principles document is a list of rules they wrote for themselves. Both are
already first-class item kinds with their own views and their own `#` tags
(`#add`, `#mistake`), so this is not a new construct — it is the existing
taxonomy, reached from a file instead of from the chat.

Response shape is unchanged; only the `kind` values widen:

```jsonc
{
  "items": [
    {
      "kind": "phrase",
      "title": "The line itself.",
      "body": "",
      "horizon": null,
      "due_label": null,
      "collection": "wall",     // see §3.1
      "external_id": null,
      "order_key": 0
    }
  ]
}
```

### 2.3 A hint, not an instruction

The FE does **not** filter the response by the hint, and should not be made to.
A strategy document opened from Phrases that also holds three goals should offer
the goals; hiding them would be the frontend overruling the read. So:

- returning kinds other than the hinted one is correct and expected;
- returning nothing for the hinted kind is a legitimate answer, and the FE says
  so plainly ("Nothing usable was found in the document.");
- the hint is a scoping aid for the extraction, not a contract about the output.

### 2.4 `apply-proposed` has to accept whatever `propose` emits

`POST /v2/life/setup/apply-proposed` now receives the wider set, because the FE
sends back exactly the rows it was given, minus the unticked ones:

```jsonc
{
  "items": [
    { "kind": "phrase", "title": "...", "body": "", "horizon": null,
      "due_label": null, "bet": null, "external_id": null, "order_key": 0 }
  ]
}
```

If `propose` emits a kind that `apply` rejects, the user ticks rows, presses Add,
and gets "That did not go through. Nothing was created, try again." — with
nothing to do about it. **The two endpoints must agree on the kind set.** If
creating a `phrase` or a `principle` from this path is not wanted for some reason
we cannot see, do not emit it from `propose` either.

**Provenance is an open question, and it is yours.** A `principle` created this
way is one the user wrote in a document and then ticked on a screen — not one
derived from a `#mistake` case, and not one typed into setup. Spec §3 gives
`life_items` two provenance columns, `origin_note_id` and `origin_case_id`, and a
document-drafted row has **neither**. The `source` enum that would say
`'import'` lives on `life_notes`, not on items.

So decide how a row's origin is recorded here before the first one is written:
a `origin_document_id`, a reuse of one of the existing columns, or nothing at
all. The FE sends no provenance field and reads none, so any answer works from
our side — but "nothing at all" means a principle from a file is
indistinguishable from one the engine derived, and `/panel/principles/:id`
renders the five slots and the application log for both.

---

## 3. Three confirmations

### 3.1 `collection` on the way out, `bet` on the way in

`propose` returns `collection`; `apply` expects `bet`. The FE maps between them
(`services/api/life.ts` — `bet: r.collection` on read, `bet: i.bet` on write) and
has done since this endpoint pair shipped. **Is that asymmetry intentional?** It
matters more now: `phrase` rows are grouped by collection on `/panel/phrases`
(`"wall"`, `"2025"`, `"2026"`), so a drafted phrase with no collection lands
under "Uncollected". If phrases should default to `"wall"`, say so and send it;
the FE renders whatever it is given.

### 3.2 The un-hinted "draft again" call

Pressing "Draft from my document" for a file uploaded on an earlier visit calls
`propose-from-document` with **no `document_id`**. That is existing behaviour, not
new, but the dock makes it reachable from every view instead of one, so it will
be hit far more often. Confirm the "latest document for this user" resolution is
what you intend, and that it is stable when a user has uploaded several.

### 3.3 The nine kinds are a closed set on the FE

`services/api/life.ts` drops any row whose `kind` is not one of the nine listed
in §2.1 — silently, by design, so a backend experiment cannot put an unrenderable
row in front of a user. **A tenth kind needs an FE change**, in
`lib/life/types.ts` and `SETUP.draftKindLabels`. Tell us rather than shipping it
and watching rows vanish.

---

## 4. Why the FE ships ahead of this, safely

Three things make this ordering safe, and they are worth knowing so you are not
rushed:

1. **A backend that ignores `kind`** answers exactly as it does today. Pydantic's
   default is to ignore unknown fields, so most likely nothing at all happens
   until you act on it.
2. **A backend that *rejects* `kind`** (a schema with `extra="forbid"`) is
   retried **once, without the field**, and the user never sees a failure. It
   costs one wasted round trip per draft, which is the only reason to prefer
   ignoring over forbidding in the meantime.
3. **A backend that returns no rows for the hinted kind** produces an honest
   empty state, not an error: "Nothing usable was found in the document."

The 401 / 404 / 409 statuses are untouched and still load-bearing exactly as
`docs/life-panel-fe-status.md` §4 describes. The retry only ever fires on a 4xx
that is *about the request* (422 is the one it exists for).

## 5. Traffic, so it is not a surprise

`GET /v2/life/setup/documents` is now read once per panel **page load** rather
than only on `/panel/goals`. The dock is mounted in the shell, so navigating
between views client-side does not re-read it, and neither does creating rows.
A read failure degrades to "no document yet" and is never surfaced as an error —
the upload is optional, so a broken list must not hide the affordance.

Nothing else about the panel's request pattern changed.

## 6. The fences this answer has to stay inside

None of these are new; they are the ones this particular feature could plausibly
walk into.

- **N5 — nothing is created without being displayed first.** Drafting must not
  create anything. It reads, it returns rows, it stops. Every row is on a screen,
  fully rendered and individually untickable, before it exists.
- **Extracted text only.** The uploaded file is not kept; the text read out of it
  is (`status: "processed" | "extraction_failed"`, `char_count`). The consent
  screen says this in those words, so it is a promise, not an implementation
  detail.
- **AC-9 / N4 — no score, no count-of-things-missing, no percentage** anywhere in
  a response the panel renders. `char_count` is fine: it is a fact about a file,
  not a judgement about a person.
- **L-6 — this corpus is private.** Nothing drafted from one user's document may
  reach another user's read, and none of it is coach-visible.

## 7. Not backend work: the orphaned `/panel/data`

Flagging it here only so it is not mistaken for a gap on your side. The founder
asked for the standing "Your data" link to be removed from the panel footer, and
it is gone. `POST /v2/life/export` and `DELETE /v2/life/data` are **unchanged and
still serve**; the route still renders. What is missing is a link to it, and the
consent screen currently promises "Both live in the panel, two clicks away, not
buried in settings."

That sentence now overstates what is on the screen. Resolving it is a founder
decision between re-hanging the link and changing the consent copy — one line of
FE either way. **No backend change is implied by it**, and the endpoints should
not be touched on account of it.

---

## 8. Acceptance, from the FE side

With the flag on and a signed-in participating user:

1. Open `/panel/phrases`, press **Add a document**, hand over a file that holds a
   list of lines. Expect drafted rows of `kind: "phrase"`, each on screen and
   ticked, under a **Phrases** heading.
2. Untick one. Press **Add the ticked rows**. Expect only the ticked ones to
   appear in the list above, without a manual refresh.
3. Repeat on `/panel/principles` and `/panel/wins`.
4. Repeat on `/panel/goals` and confirm the existing behaviour is byte-identical
   to what it was before the dock: same rows, same bets, same due labels.
5. Open `/panel/today` and hand over the same file. Expect the un-hinted answer,
   whatever it is — this path must not have changed at all.
