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

src/services/api/life.ts        the client, with the full assumed contract in its header
src/app/api/v2/life/[...path]/route.ts   BFF passthrough, fixed /v2/life prefix

src/components/life/PanelShell.tsx       chrome + gate + nav (N1)
src/components/life/primitives.tsx       heading, empty, loading, one fetch hook
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
`isolation.test.ts`.

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

- `state.menu` is the whole nav. **Anything not in it does not render**, so the
  backend decides which of the nine views exist for this user, including Prayer.
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

### Two endpoints the FE added beyond the prompt

Both are flagged here because they are contract additions, not assumptions:

1. `PATCH /v2/life/items/:id` with `{title?, body?}` — inline edit for a win's
   wording and a distraction's environmental response. FE-9 asks for inline edit
   on Wins, and the distraction/response pairing is unusable read-only. Edits the
   user's own text only; it is never a path for accepting a proposal.
2. `PATCH /v2/life/day` with `{checks: [{id, done}]}` — ticking a checkbox on
   today's card. The card's frame includes habit checkboxes, and a checkbox that
   cannot be ticked is not a checkbox. The alternative reading, that every tick
   goes through `#edit` in the chat, makes the morning routine a typing exercise.
   This writes a boolean only: the one thing, the focus blocks and all strategy
   text still change through `#edit` and approved proposals.

If the backend would rather not have these, say so and the two views degrade to
read-only in one commit each.

## 5. Deviations from the prompt, and why

- **One catch-all BFF route** instead of ~15 files. The endpoint list is still
  moving, and the prefix is fixed to `/v2/life/`, so the blast radius is the same
  while the FE stops re-deploying for every new backend route.
- **The timeline canvas is written from the described behaviour, not copied.**
  The original single-file renderer lives on the founder's machine
  (`~/Documents/timeline/index.html`) and is not in this repo, so it could not be
  ported line by line. Mechanics implemented: drag to pan, wheel and pinch zoom
  anchored under the cursor, tap for detail, per-bet hide, three tiers, bets as
  bands, goals as markers. **Diff against the original before ship** if its
  interaction details matter.
- **A "Your data" link in the panel footer**, not a menu entry. FE-10 wants
  export and delete two clicks away; N1 governs *gated* surfaces, and a person
  with data must always be able to take it out or erase it, so this one is not
  gated on the menu payload. It appears once the user has consented.
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
- The weekly review (P4) has no view yet: `life_weeks` is in the data model, and
  L-2b routes the batch of three proposals to it, but the prompt lists no FE-*
  item for it and none was invented.
- FE-6's `#edit` refusal path ("any other target is refused with a one-line
  explanation") is enforced backend-side; the FE renders whatever reply comes
  back. The refusal line is product copy and needs sign-off wherever it is
  written.
