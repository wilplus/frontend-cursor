# Handoff — The Life Panel (FE)

**State:** on `main` as of `463430a`. Built, verified, and **dark**. No user sees
anything until the backend exists and `LIFE_PANEL_ENABLED=1`.

**Read first:** `docs/life-panel-spec.md` (spec of record, holds L-1…L-6),
`docs/life-panel-fe-prompt.md` (the build prompt, holds N1…N6),
`docs/life-panel-fe-status.md` (what shipped, the assumed contract, deviations).
This file is what to *do* next; that one is the reference.

`FILTER: JUSTIFIED-SCAFFOLDING — cat {SCAFFOLDING} — fences {clear} — locks {clear} — redirect: tighten word→slide bucketing at the two-clocks boundary`

---

## 1. Why nothing is visible

`GET /v2/life/state` 404s while the flag is off, and on a 404:

- the hamburger renders no panel entries,
- `/panel/*` renders a 404,
- the chat's `#` layer never mounts, and an anonymous `/chat` visitor does not
  even make the request.

That is not a placeholder state, it is the design. **Do not add a "coming soon"
anywhere** (N1); a disabled-but-visible feature invites questions that need copy
that needs sign-off.

## 2. The three things standing between here and launch

Not FE work, but nothing ships without them, in this order:

1. **Backend `/v2/life/*`.** The smallest payload that lights up the entrance is
   in `docs/life-panel-fe-status.md` §1: two objects, no `menu`. Principles then
   appears in the hamburger for every signed-in user, and the guide → consent →
   setup flow is reachable. `POST /v2/life/consent` and the setup writes must
   exist too, or the user hits consent and the write fails.
2. **Founder sign-off on `src/lib/life/copy.ts`.** One file, every user-visible
   string, including all five items the prompt flags. Once the flag flips, the
   guide and consent screens are the first thing every user reads. `copy.test.ts`
   holds the mechanical half (no em-dashes, no score or streak, no line telling
   the user they fell behind); it cannot hold the judgement half.
3. **`LIFE_PANEL_ENABLED=1`.**

## 3. Remaining FE work, in order

### 3.1 Blocked on artifacts that are not in the repo

`docs/life-panel-sources/README.md` is the landing zone and says what changes
when each arrives. Both are marked invented in the status doc until then.

| Item | Blocked on | Work when unblocked |
|---|---|---|
| Daily card design | the founder's **daily document** | Replace `DAY` labels in `copy.ts` verbatim; match section order in `MorningCard`. The field list and section order came from spec §3.3 + FE-6, so the structure is right; the wording is mine. |
| The 23:00 summary | same, plus a decision on what it says | **The most likely thing to need rewriting.** It has no source at all beyond the four `evening_*` columns, so its shape is entirely invented. |
| Weekly review view | the founder's **weekly document** | The last unbuilt view. `life_weeks` is in the model and L-2b routes the ranked batch of three proposals to it, but no FE item specifies the surface, so none was invented. New `/panel/week`. |
| Timeline fidelity | `~/Documents/timeline/index.html` | Diff `TimelineCanvas.tsx` against it and take whatever the original does better. Styling stays the app's (FE-8); only the interaction model is up for adoption. |

### 3.2 Blocked on a backend yes/no

Two endpoints go beyond the FE prompt. Both write the user's own data only,
never a proposal acceptance. If the answer is no, each view degrades to
read-only in one commit.

- `PATCH /v2/life/items/:id` `{title?, body?}` — inline edit on a win's wording
  and a distraction's environmental response.
- `PATCH /v2/life/day` — habit ticks (`{checks:[{id,done}]}`) and the evening
  review (`{evening:{habits_ran, one_thing, distraction, answer}}`).

### 3.3 Unblocked, do any time

- Nothing. Every FE-1…FE-10 item is built. What is left is fidelity and the
  weekly view, both of which need the artifacts above.

## 4. Fences — where they are enforced, so you know what you would be breaking

`src/lib/life/isolation.test.ts` **fails the build** if the panel spreads. It
asserts exactly two product modules import it (`DashboardHeader` for the menu,
`Lounge` for the `#` layer), that the tag picker is gated on the participation
flag, that the `/v2/chat/query` request body gains no life field, and that the
BFF proxy can only reach `/v2/life/*`. A third importer means stop and decide
deliberately, not add a name to the list.

| Fence | Where it lives now |
|---|---|
| N1 absent, not disabled | `menu.ts` derives the list; no local fallback in the header or the nav |
| N2 consent before any write | `FirstRun.tsx` — checkbox starts false, the only request either page makes is the consent POST |
| N3 zero nudges | no badge, no unread, no count of unopened days, in either day card; `copy.test.ts` scans for the language |
| N4 no scores | no percentage or ring anywhere; the application log shows counts and contexts chronologically so it cannot read as a ranking; `copy.test.ts` scans |
| N5 explicit approve | `ProposalCards.tsx` — dashed frame + badge; warrantless strategy proposals are **dropped by the mapper** (L-2); `report_only` **defaults to true** when absent so an unknown payload cannot grow an approve button over the immutable core (L-2a); both halves of a conflict card render through one component so neither can look recommended (L-3) |
| N6 no drafted reflections | the evening answer field and the case reflections have no placeholder and no suggest button |

The two that are easiest to break by accident: **`report_only` defaulting to
true**, and **the conflict card's two halves sharing one component**. Both look
like tidy-ups.

## 5. Verify before handing back

```
npx vitest run --dir src      # 443 pass, 41 files
npx tsc --noEmit
npx next lint --dir src
npx next build                # needs OPENAI_API_KEY + the Supabase vars locally
```

## 6. Still open, do not guess

From the FE prompt, unanswered:

- **Spendings** — is there a view at all in v1? There is none today.
- **Bet 3 on the daily card** — display-only, or may tasks be proposed against
  it? Backend routing decision; the FE renders whatever the day payload holds.
- **Strategy re-upload format** — shipped accepting markdown or plain text, not
  `.docx` (a `.docx` is a zip archive; reading it in the browser gives mojibake,
  not a document). The approve-the-diff step stands in front of every change
  either way.
- **`mvp.willpowerlab.com`** — if added, `/` lands on `/panel` for that hostname
  only. Not implemented.

One more, raised during the build and answered by the founder: an automatic
23:00 summary **waits, it does not ping**. If it is appended to the chat it
rides in `metadata.life_card` like every other life turn and renders through the
card that already exists. Pairing it with a push notification breaks L-4 and N3.
