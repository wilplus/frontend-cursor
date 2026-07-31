# Life Panel FE — what shipped, what it assumes, what is still open

Companion to `docs/life-panel-fe-prompt.md`. Read this before wiring the
backend: it is the list of everything the FE now expects from `/v2/life/*`, and
the places where it went past the prompt.

`FILTER: JUSTIFIED-SCAFFOLDING — cat {SCAFFOLDING} — fences {clear} — locks {clear} — redirect: tighten word→slide bucketing at the two-clocks boundary`

---

## 1. Nothing is visible until the backend says so

Every surface here is dark by default. `GET /v2/life/state` 404s while
`LIFE_PANEL_ENABLED=0`, and on a 404:

- the hamburger renders no panel entries,
- `/panel/*` renders the app's 404,
- the chat's `#` layer does not mount.

So this branch is deployable ahead of the backend without changing anything a
user sees. Flipping the flag is what turns it on.

### The smallest payload that lights it up

Once `LIFE_PANEL_ENABLED=1`, this is the entire response BE-2 has to return for
**Principles to appear in the hamburger for every signed-in user**, and for the
guide → consent → setup flow to be reachable:

```json
{
  "consent": { "required_version": "2026-07-26", "accepted_version": null },
  "setup":   { "complete": false, "resume_step": null }
}
```

No `menu` needed. Set `accepted_version` to the required version once the user
consents, flip `setup.complete` when they finish setup, and the other seven
entries turn on by themselves, in the hamburger and in the panel nav, without a
page reload.

`consent.required_version` is the one field that cannot be omitted: without a
version there is no gate to pass, so the FE treats the payload as "no panel"
rather than guessing one.

The flow still needs `POST /v2/life/consent` and `PUT/POST /v2/life/setup*` to
exist, or the user reaches consent and the write fails.

## 2. Files

```
src/lib/life/types.ts           types, the six-entry taxonomy, the three bets, gate helpers
src/lib/life/mappers.ts         wire (snake_case) → view types, defensively
src/lib/life/hashtags.ts        the # registry, first-token parsing, picker filtering
src/lib/life/copy.ts            EVERY user-visible string — the sign-off surface
src/lib/life/setupSteps.ts      the nine setup steps and the draft shape
src/lib/life/timelineScale.ts   zoom tiers, ticks, time↔pixel maths
src/lib/life/useLifeState.ts    one cached read of the gate, shared app-wide
src/lib/life/useLifeTags.ts     the gate on the chat # layer
src/lib/life/uploadKind.ts      which item kind the document dock is pointed at

src/services/api/life.ts        the client, with the full assumed contract in its header
src/app/api/v2/life/[...path]/route.ts   BFF passthrough, fixed /v2/life prefix

src/components/life/PanelShell.tsx       chrome + gate + nav + the way out (N1)
src/components/life/PanelUpload.tsx      the document dock under every view
src/components/life/StrategyDocument.tsx the shared upload + tick-and-Add review
src/components/life/primitives.tsx       lede, empty, loading, one fetch hook
src/components/life/FirstRun.tsx         FE-2 guide + consent
src/components/life/SetupFlow.tsx        FE-3 setup, save-and-resume
src/components/life/ProposalCards.tsx    FE-7 proposal / conflict / retire
src/components/life/StrategyPanel.tsx    read, download, re-upload as an approved diff
src/components/life/TimelineCanvas.tsx   FE-8 canvas
src/components/life/LifeChatLayer.tsx    FE-5 tag picker + response card

src/app/panel/{layout,page,not-found}.tsx
src/app/panel/{principles,principles/[id],wins,phrases,today,goals,timeline,distractions,strategy,setup,data}/page.tsx
```

Tests: `hashtags.test.ts`, `mappers.test.ts`, `timelineScale.test.ts`,
`uploadKind.test.ts`, `isolation.test.ts`.

## 3. The isolation fence

`src/lib/life/isolation.test.ts` is the price of admission and fails the build if
broken. It asserts:

1. **Exactly two** product modules import anything under `lib/life`,
   `components/life` or `services/api/life`: `DashboardHeader.tsx` (the menu
   entries FE-1 asks for) and `Lounge.tsx` (the `#` layer). A third importer
   fails the test. Do not just add a name to the list.
2. The composer's tag picker is rendered under `lifeTags.enabled && (…)`, and
   appears exactly once.
3. The `postChatQuery({…})` call site carries no life field, and
   `services/api/chatQuery.ts` contains no reference to life at all. Routing is
   the backend's job; the FE request body for a non-participating user is
   unchanged.
4. The BFF proxy builds exactly one upstream URL, always under `/v2/life/`,
   refuses `..` segments, and logs no request or response body.

On top of that, the chat's gate read is itself gated on `thread.signedIn`, so an
anonymous visitor to `/chat` makes no request for it at all: the funnel path is
unchanged down to the network tab.

What it does **not** cover: the byte-identical chat-response assertion in spec
§5. That test belongs on the backend, where the response is produced. The FE half
of the guarantee is (3) above.

## 4. The contract this FE assumes

The full list lives in the header of `src/services/api/life.ts`. Confirm each
against the backend prompt.

| Endpoint | Used by |
|---|---|
| `GET /v2/life/state` | hamburger, panel shell, chat gate |
| `POST /v2/life/consent` | FE-2 |
| `GET`/`PUT /v2/life/setup`, `POST /v2/life/setup/complete` | FE-3 |
| `GET /v2/life/principles`, `GET /v2/life/principles/:id` | FE-4 |
| `GET /v2/life/items?kind=` | wins, phrases, distractions |
| `GET /v2/life/goals` | FE-9 goals, bets in rank order |
| `GET /v2/life/day` | FE-6 |
| `GET`/`POST /v2/life/week` | the Sunday review (BE #262) |
| `GET /v2/life/timeline` | FE-8 |
| `GET /v2/life/proposals`, `POST /v2/life/proposals/:id/decide` | FE-7 |
| `GET /v2/life/strategy`, `POST /v2/life/strategy/upload`, `POST /v2/life/strategy/apply` | FE-9 strategy |
| `POST /v2/life/export`, `DELETE /v2/life/data` | FE-10 |

### Status codes the FE depends on

- **404** — the feature does not exist for this caller (flag off, or not on the
  allowlist for that surface). Renders nothing, anywhere. Must not be 403.
- **409** — signed in, not consented. Routes to the Principles tab. The backend
  still stores the note.
- **401** — no session.

### Response-shape notes

- `state.menu` is **optional** (founder, 2026-07-26). Leave it empty and the FE
  derives the nav in two stages: **Principles alone** for any signed-in user the
  panel exists for, and the other seven the moment that user is participating
  (consented AND setup complete). Principles is the entrance, so it must be
  reachable before the user has done anything; the rest would open on nothing,
  because every route into the data runs through setup.
  Send a **non-empty** `menu` and it wins wholesale, which is the only way an
  allowlisted entry can appear: Prayer is founder-only, the FE cannot know the
  allowlist, so it is never derived. A payload that wants Prayer sends the full
  list. This also lets the server pull a view without an FE deploy.
  N1 is intact either way: entries the user cannot use are absent, never greyed.
- `state.tags` (optional) overrides the picker list. Absent → the FE registry is
  used, which lists five canonical tags and keeps `#sin` working but unlisted.
- The life chat card rides in the bot message's `metadata.life_card`, the same
  channel `suggested_action` already uses, so it survives reload and scroll-back
  with no second write path. Shape:
  `{view, title, lines[], phrase|null, awaiting_approval}`.
- A **strategy proposal with no `warrant.{id,title}` is dropped by the mapper**
  and never rendered (L-2). Send the warrant or do not send the proposal.
- `report_only` **defaults to true when absent** (L-2a), so an unknown payload
  can never grow an approve button over Section I or the bets' rank.
  The backend session caught that it was never emitting the field, which would
  have made every proposal un-approvable with a missing button as the only
  symptom. It now sends `false` explicitly on approvable proposals and `true` on
  the report shape. **This default does not change**: it is what stops an
  unrecognised payload sprouting an approve button, and a guard that is also the
  mechanism is not a guard.
- The day card carries **`one_thing_bet`**, and each focus block carries
  **`bet`**. Both are rendered with the bet's rank. Since Bet 3 became eligible
  for daily tasks, an unlabelled card makes the rank invisible on the surface
  the rank governs, and Bet 3 never outranks Bet 2 in a daily plan (§3.2).
- **A `#` before onboarding stores nothing** (BE 2026-07-26, superseding §6.2).
  The tag falls through as ordinary chat and `POST /v2/life/notes` 409s. So
  `POST /v2/life/setup/complete` returns **no replay list**, the FE no longer
  reads one, and there is no redirect copy. A user who never onboards leaves no
  life rows at all.
- `evening.generated_at` is additionally gated on `LIFE_PANEL_EVENING_HOUR_UTC`
  (default 21) **on the read path**, so a card opened at breakfast does not come
  back with the evening already open. The FE needs no change for this: it
  branches on the field either way.
- The weekly payload's `proposals` are **capped at three by the FE as well as
  the server** (L-2b). The FE is the surface where a longer batch would actually
  turn approve into a rubber stamp, so the cap is enforced where the damage
  would happen. `habits_failed` and `goals_moved` read either as objects or as
  bare strings.

### Two endpoints the FE added beyond the prompt

Both are flagged here because they are contract additions, not assumptions:

1. `PATCH /v2/life/items/:id` with `{title?, body?}` — inline edit for a win's
   wording and a distraction's environmental response. FE-9 asks for inline edit
   on Wins, and the distraction/response pairing is unusable read-only. Edits the
   user's own text only; it is never a path for accepting a proposal.
2. `PATCH /v2/life/day` — ticking a checkbox on today's card
   (`{checks: [{id, done}]}`) and saving the evening review
   (`{evening: {habits_ran, one_thing, distraction, answer}}`). The card's frame
   includes habit checkboxes, and a checkbox that cannot be ticked is not a
   checkbox; the evening review is four fields the user fills in. The
   alternative reading, that every tick goes through `#edit` in the chat, makes
   the morning routine a typing exercise. This writes booleans and the user's
   own text only: the one thing, the focus blocks and all strategy text still
   change through `#edit` and approved proposals.

### The day is two passes

`GET /v2/life/day` returns one row with two moments:

```json
{
  "date": "2026-07-26",
  "morning": { "generated_at": "...T05:00:00Z", "one_thing": "...",
               "checks": [], "focus_blocks": [], "bets": [], "habits": [] },
  "evening": { "generated_at": null, "summary": [],
               "habits_ran": false, "one_thing": false,
               "distraction": "", "question": "...", "answer": "" }
}
```

- The 05:00 fields may also arrive **flat on the row** (`one_thing`,
  `daily_habits`, …), which is the shape `life_days` stores. Both read the same.
- `evening.generated_at` is **null until the 23:00 pass has run**, and the view
  branches on it rather than on `summary` being non-empty, so a pass that
  legitimately produced no lines still renders as written.
- `evening.summary` is the **system's factual recap**: what the one thing was,
  which habits ran, what got flagged. L-1 means it reports and stops.
  `evening.answer` is the **user's** prose (the legacy `line` column is read as
  a fallback), rendered with no placeholder and no draft button (N6).
- **Nothing is delivered.** Both passes are scheduled; neither pings. If the
  23:00 summary is also appended to the chat, it rides in the bot message's
  `metadata.life_card` like every other life turn and renders through the
  existing card, so it needs no new FE surface, and it must not be paired with
  a push notification (L-4 / N3).

If the backend would rather not have these, say so and the two views degrade to
read-only in one commit each.

## 5. Deviations from the prompt, and why

- **One catch-all BFF route** instead of ~15 files. The endpoint list is still
  moving, and the prefix is fixed to `/v2/life/`, so the blast radius is the same
  while the FE stops re-deploying for every new backend route.
- **The daily card's design is mine, not a port of the founder's template.**
  The spec's `life_days` columns (§3.3) gave the field list and FE-6 gave the
  section order; the actual wording, framing and layout are written to fit
  those. The founder's daily and weekly documents, which §4.1 lists as "pasted
  in this thread", never reached this repo. **Diff the card against them before
  ship.** The 23:00 summary has no source at all beyond the four `evening_*`
  columns, so its shape is entirely invented and is the most likely thing to
  need rewriting.
- **The timeline canvas is written from the described behaviour, not copied.**
  The original single-file renderer lives on the founder's machine
  (`~/Documents/timeline/index.html`) and is not in this repo, so it could not be
  ported line by line. Mechanics implemented: drag to pan, wheel and pinch zoom
  anchored under the cursor, tap for detail, per-bet hide, three tiers, bets as
  bands, goals as markers. **Diff against the original before ship** if its
  interaction details matter.
- ~~**A "Your data" link in the panel footer**~~ — **removed** (founder
  2026-07-31), along with the app header and the per-view page title. See §8.
- **Strategy re-upload accepts markdown or plain text, not `.docx`.** A `.docx`
  is a zip archive; reading it in the browser yields mojibake, not a document.
  This is the open question in the spec, answered the safe way, and the diff
  step still stands in front of every change.
- **`/panel` added to the middleware protected list.** Signed-in only, exactly
  like `/dashboard`. The feature gate stays server-side in `/v2/life/state`.

## 6. Copy sign-off

Everything a user can read is in `src/lib/life/copy.ts`, including all five items
the prompt lists as needing sign-off. Nothing in it uses an em-dash, states a
score or percentage, or implies the user is behind. **It is written, not
approved.** Review that one file before the flag is flipped.

## 7. Still open

- The four questions in the FE prompt (Spendings, Bet 3 on the daily card,
  re-upload format, the `mvp.` alias) are unanswered and were not guessed at.
  There is no Spendings view; `#` proposals against Bet 3 are a backend routing
  decision the FE does not constrain, and it renders whatever the day payload
  contains.
- ~~The weekly review has no view~~ — **built** as `/panel/week`, against the
  live `GET`/`POST /v2/life/week` contract. The prompt lists no FE-* item for
  it; it exists because the backend endpoint does and the spec's §3.3 names its
  five fields. Its labels and section order still want the weekly document.
- FE-6's `#edit` refusal path ("any other target is refused with a one-line
  explanation") is enforced backend-side; the FE renders whatever reply comes
  back. The refusal line is product copy and needs sign-off wherever it is
  written.

## 8. The chrome pass (founder 2026-07-31)

Four changes to what the panel puts on the screen, and the two things they
leave open.

**What changed**

1. **The app header is off every panel screen.** `DashboardHeader` used to
   render above the pill row on all but `/panel/principles`; it now renders on
   none of them, in the loading, 404 and loaded states alike. The logo, the
   wallet chip and the hamburger were three exits stacked above a row that
   already navigates.
2. **No page title.** Every view opened with its own name as an `h1` directly
   under the pill bearing the same word. `PanelHeading` is now `PanelLede`: it
   renders a view's lede, if it has one, and nothing else. Today, Timeline,
   Strategy and the data screen have empty ledes, so they mount nothing at all.
3. **The pill row carries the way out.** An `X` sits at its right end, on the
   same line, and the scrolling strip is shortened by exactly that width rather
   than scrolling under it. It lands on `/chat`, the same place the panel's 404
   already sends people, so leaving the panel means one destination.
4. **A document dock under every view.** `PanelUpload` is the upload that used
   to live only at the foot of Goals (`StrategyDocumentPanel`, now deleted),
   docked under all of them: upload, draft, tick, Add. It passes the kind the
   current view holds (`lib/life/uploadKind.ts`) as a hint on
   `POST /setup/propose-from-document`, so a document handed over on Phrases is
   read for phrases. `SetupFlow` keeps its own step-2 upload; the Strategy
   view's "Upload a revised copy" is a different operation on a different
   document and is untouched.

**Two things this leaves open**

- **`/panel/data` has no link anywhere.** Removing the footer link was the
  request; the route, the export and the typed-confirmation delete are all
  unchanged and still serve. But the consent screen promises "Both live in the
  panel, two clicks away, not buried in settings", and with no link that
  sentence overstates what is on the screen. Either re-hang the link (a tenth
  pill in the menu is one line in `LIFE_VIEWS`) or change that consent bullet.
  **Founder decision, not an FE one.**
- **The kind hint needs a backend that honours it.** `propose-from-document`
  returns `bet`, `goal`, `habit` and `distraction` today, so the dock produces
  rows on Goals, Distractions and Timeline and comes back empty on Phrases,
  Principles and Wins. The FE is finished for all of them: `LifeDraftItem.kind`
  is the full `LifeItemKind`, `applyConfirmedItems` sends whatever it is given,
  and `SETUP.draftKindLabels` has a label per kind with a fall-back to the raw
  name. What is missing is the backend emitting `phrase` / `principle` / `win`
  when asked. A backend that rejects the unknown field is retried once without
  it, so shipping this ahead of that work cannot break the upload that already
  works.
