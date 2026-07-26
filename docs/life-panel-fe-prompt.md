# FE prompt — The Life Panel

**Repo:** `frontend-cursor` · **Spec of record:** `docs/life-panel-spec.md`
**Pair:** `PROMPT-BE-life-panel.md` (backend repo)
**Date:** 2026-07-26 · **Status:** FE built against the documented contract;
runtime is blocked on BE-2 (`/v2/life/state`) and BE-10 (consent, export,
delete). See `docs/life-panel-fe-status.md` for what shipped and what is assumed.

---

## 0. Non-negotiables

| # | Rule | Why |
|---|---|---|
| N1 | **Absent, not disabled.** Menu entries the user can't access are missing from the payload, so they are missing from the DOM. Never render a greyed "coming soon". | A disabled-but-visible feature invites questions that need copy that needs sign-off |
| N2 | **Consent before any write.** Page 2 of first-run is the consent screen; no life data is sent before it passes. | L-6 |
| N3 | **Zero nudges.** No notifications, no badges, no unread counts, no "you haven't logged in for 3 days". The daily card is a landing state, never a message. | L-4 — not typing means living, not failing |
| N4 | **No scores anywhere.** No alignment percentage, no streak counter, no completion ring, no "consistency" meter. | AC-9 and the construct fence. This surface must not invent a number the product spent a year removing |
| N5 | **Approve/veto is always explicit.** Nothing the model proposes appears as though it were already accepted. Proposed vs yours must be visually distinct at a glance. | L-1, L-2, L-3 |
| N6 | **Reflection fields are user-input only.** No placeholder text that drafts for them, no "suggest" button on that field. | L-1 |

Copy on every one of these screens is product copy on a live surface → founder
sign-off before ship.

---

## FE-1 — Panel shell

Route group `/panel/*`, rendered inside the existing app (same auth, same
session). The hamburger's entries follow `GET /v2/life/state`.

Menu, in order:

```
Principles · Wins · Phrases · Today · Goals · Timeline · Distractions · Strategy
Prayer  → external link to pompeiana.willpowerlab.com   (allowlisted; absent for everyone else)
```

**Two stages (founder, 2026-07-26).** Principles is the entrance and shows for
any signed-in user the panel exists for, with no consent and no setup yet:
tapping it lands on the guide, then consent, then setup. The other seven turn on
the moment that user is participating, and they turn on live, without a page
reload. Before that they would open on nothing, since every route into the data
runs through setup.

The server can still override: a non-empty `state.menu` replaces the derived
list wholesale, and it is the only way an allowlisted entry such as Prayer can
appear. N1 holds either way, entries the user cannot use are absent, never
greyed.

Flag off or unknown state → the hamburger is byte-identical to today.

## FE-2 — First run: guide, then consent

**Page 1, the guide.** One page of text: what principles are, what `#` does, and
the framing: note the ideas, concerns and conclusions you pick up in meetings and
from watching others, and build wisdom in communication and in general. No signup
pressure, no feature list.

**Page 2, consent.** Cannot be skipped, cannot be defaulted to accepted. States
plainly what is stored, where, for how long, and that it can be exported and
hard-deleted at any time. `POST /v2/life/consent` with the version.

`#sin` is a working tag but is kept off the public guide list. Right for the
founder, wrong as a public category in a speaking product.

## FE-3 — Setup (once, but editable forever)

Typeform-style flow, same interaction pattern as speaking-project onboarding.
Eight horizons (daily / weekly / monthly / quarterly / yearly / 5y / 10y / 20y)
with dates, quantities and the SMART fields per goal, plus the three bets and
their rank.

Save-and-resume is load-bearing, not a nicety. Setup is a hard gate: a `#` typed
before completion does not run the engine, it redirects here. Eight horizons is
long enough that people get interrupted; without resume, an interruption becomes
an abandonment and the gate has no second door. `PUT /v2/life/setup` on every
step.

On completion → `POST /v2/life/setup/complete`, which generates the document set
and replays any notes typed before the gate. Show those replayed results; the
user typed them for a reason.

Consequence to hold in mind while designing this screen: it is the only entrance
to the feature, so its completion rate is the feature's adoption rate.

## FE-4 — Principles tab, state-dependent

Three jobs, never one page:

| State | Renders |
|---|---|
| No consent | guide → consent (FE-2) |
| Consented, setup incomplete | resume setup (FE-3) |
| Setup complete | results |

Results layout, in this order:

1. **Principles on top** — the derived list, each clickable.
2. **The strategy document below**, with download / re-upload.

**Principle detail page** — the full case in the five slots, all at once: case at
hand · 👾 category (may be several) · principles applied plus weighing ·
reflections · ⚜️ the principle. Plus the application log (L-5): where this
principle has actually been cited over time. That log is the honest answer to
which principles are load-bearing and which are decorative. Show counts and
contexts, not a rank or a score (N4).

## FE-5 — Chat: the `#` layer

Everything else about the chat stays exactly as it is. This adds one behaviour.

- Typing `#` alone opens an autocomplete picker of the available tags. Four
  aliases per route are easy to build and impossible to memorise; the picker is
  what makes the guide page non-load-bearing for discovery.
- Tag matching is on the first token. `#lift me up` parses as `#lift` plus prose
  → capture only. Use `#liftmeup`.
- Every `#` response carries one wall phrase, the user's own words returned at
  the moment they apply. If BE attaches none, render none; never a placeholder.
- Response cards link into `/panel/<view>`.
- For a user who is not participating, none of this loads and the chat is
  unchanged.

## FE-6 — The daily card + `#edit`

Rendered from `GET /v2/life/day`. **The day is two cards** (founder,
2026-07-26):

- **05:00, the plan** — morning checks · 🎯 ONE THING · ⚡ three focus blocks ·
  🔴 distraction check · the three bets with their goals · ⬜ daily habits.
- **23:00, the summary** — the system's factual recap of what the day held,
  then the user's own review: the two booleans, what pulled at them, and the
  answer to the closing question.

Both are generated on a schedule and **neither is delivered**. Generation is
scheduled; delivery is not. The 23:00 summary waits exactly like the 05:00 card
does: no ping, no badge, no unread count (N3 / L-4). The same summary may be
appended to the chat as a bubble, where it is read when the chat is next opened
and still notifies nobody.

The split runs down the middle of L-1. The recap is the system's and is
factual, what the one thing was and which habits ran. The answer below it is the
user's, and that field has no placeholder and no suggest button (N6).

Frame fixed, content editable. The card must make visually obvious that there is
a ONE THING (not editable) and that what it is can change (editable). `#edit
<text>` targets the most recent card only; any other target is refused with a
one-line explanation.

When an edit also bears on a longer horizon, it surfaces as a normal proposal
card (FE-7), never a silent write to the 5- or 10-year document.

## FE-7 — Proposal, conflict and retire cards

Three card types, one shared discipline: the model's output is visibly the
model's until you accept it (N5).

- **Proposal card (strategy change).** Shows the line it contradicts, quoted from
  the document · the proposed edit as a diff · the user's own principle displayed
  as the warrant · Approve / Dismiss. Dismissed is remembered and not
  re-proposed. At most one per day (L-2b); the rest arrive as a ranked batch of
  three in the weekly review. If a change targets Section I or the bets' rank,
  the card is report-only: no approve button exists, because that part of the
  document is hand-edited only (L-2a).
- **Conflict card.** Two principles that pull opposite ways, shown side by side,
  with no recommendation and no default selection. The system never picks (L-3);
  the UI must not pick for it by making one option visually heavier.
- **Retire card.** "Does this retire #12?" Yes / No, veto absolute. On No, both
  stay active and the question is never asked again.

## FE-8 — Timeline, ported and re-skinned

Port the canvas renderer and interaction model from the standalone timeline app
(single file, no build, no deps). Keep the mechanics: drag to pan, scroll/pinch
to zoom, tap for detail, category hide. Replace the styling with the app's
design; this one lives inside the app, unlike prayer.

New requirements:

- Three zoom tiers: quarter / year / decade. 60 years is 240 quarters, so they
  cannot all render at once; the tier switches with scale.
- Goals with a `due_at` render as markers; bets render as colour bands (🟢🔵🟣
  map onto the existing `categoryColor` field).
- Data from `GET /v2/life/timeline`, not localStorage.

## FE-9 — The remaining views

| View | Notes |
|---|---|
| Wins | List exists in principles-app: port the UI, swap the data source. Trophy rows, inline edit. |
| Phrases | Simple list, grouped by collection ("2022-24", "2025", "2026", "wall"). `#add` is the only way in. |
| Goals | Bets in rank order, goals beneath with their due labels rendered verbatim (`[NOW]`, `[Aug]`, `[Jul '27]`). The label is the source of truth, not the parsed date. |
| Distractions | Each distraction paired with its environmental response. The pairing is the point; never show the distraction alone. |
| Strategy | Read + download as one document. Re-upload produces a diff you approve, never a silent overwrite: arbitrary Word formatting will not round-trip cleanly, and the diff is the safety net. |

## FE-10 — Export and delete

Reachable from the panel in two clicks, not buried in account settings.

- Export → `POST /v2/life/export`, downloads everything.
- Delete → `DELETE /v2/life/data`, irreversible, typed confirmation. Say plainly
  what goes and that it cannot be undone.

Launch blockers, same as BE-10. There is no staged rollout in which to add them
later.

---

## Build order

```
FE-1  shell + hamburger              ← needs BE-2 /state
FE-2  guide + consent                ← needs BE-10
FE-3  setup form + save/resume       ← needs BE-2 /setup
FE-4  principles results + detail    ← needs BE-3 (real data to look at)
FE-9  wins / phrases / goals / distractions / strategy
FE-10 export + delete
FE-5  chat # layer                   ← needs BE-5
FE-7  proposal / conflict / retire   ← needs BE-6
FE-6  daily card + #edit             ← needs BE-8
FE-8  timeline re-skin
```

FE-4 after the importers land, deliberately: building the results view against an
empty table produces a layout that looks fine with three principles and falls
apart at sixty.

## Copy needing founder sign-off before ship

1. The guide page (page 1).
2. The consent screen (page 2), including the retention statement.
3. The `#`-before-setup redirect line.
4. The delete confirmation.
5. Any empty-state text on the eight views.

All of it lives in one file: `src/lib/life/copy.ts`.

## Open (do not guess)

- **Spendings** — is there a Spendings view at all in v1?
- **Bet 3 on the daily card** — display-only, or may tasks be proposed against it?
- **Strategy re-upload format** — Word round-trip as specified, or markdown /
  in-app editor? Markdown is materially safer; the founder's call.
- **mvp.willpowerlab.com** — if added, `/` lands on `/panel` for that hostname
  only.
