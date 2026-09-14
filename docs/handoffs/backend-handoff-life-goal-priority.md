# BE handoff: stale tasks served as current, and where the Dalio ranking lives

**From:** Frontend
**Date:** 2026-08-02
**Branch:** `claude/panel-instant-and-goal-order`
**Trigger:** founder, testing the live panel: "there is task for 29/07 and it
is 01/08. there can no be errors like that and goals are not sorted by the
priority and they should be; we need to follow the ray dalio guide book …
for each bet."

`FILTER: JUSTIFIED-SCAFFOLDING — cat {SCAFFOLDING} — fences {clear} — locks {clear} — redirect: tighten word→slide bucketing at the two-clocks boundary`

**One bug, one design ask.** The FE has done its half (§3); neither of these
can be finished from the frontend.

---

## 1. The bug: rows dated in the past are served as current

The founder saw a task dated 29/07 presented as current on 01/08. The FE now
orders past-dated goals last and marks them "Past its date", so a stale row can
no longer *read* as today's — but the FE can only dress the data it is given.
Two places on your side can still produce the error:

1. **The 05:00 day card.** If generation picks a task or focus block whose date
   has passed, the card itself asserts it is today's work, and no display rule
   can contradict a card that says so in its own copy. Generation must not
   select past-dated rows as current: carry them forward deliberately (re-dated
   to today, which is an honest claim) or leave them out.
2. **`GET /v2/life/goals` / `GET /v2/life/items`.** The panel's own copy
   already promises the rule: "The rest **expire rather than pile up**"
   (WEEK.batchHint, founder-signed). Rows whose date has passed should either
   be expired by the nightly pass (status change, so they leave the active
   list) or stay served — FE now handles that honestly — but never re-emitted
   into new day cards.

Please confirm which of the two the 29/07 task came through, because the fix
belongs at the source, not on the label.

## 2. The design ask: the Dalio ranking is yours, in `order_key`

The founder's directive, condensed: separate must-dos from like-to-dos, rank by
expected value (probability × payoff, weighed against the cost of waiting),
highest-impact-highest-probability first, keep the rest on a short revisit
list — **for each bet**.

That weighing is a **generation-time decision, and its output on the wire is
`order_key`** (and which task the day card picks). It must not be a surfaced
number:

- **AC-9 / N4** — no expected value, probability, payoff or any score may
  reach a payload field the FE renders. The FE will render ORDER, never a
  number. If the model estimates numbers internally to sort, they stay
  internal, exactly like `power_score` stays internal to ranking.
- The FE's display rule (§3) defers to your order for every undated goal, so
  the moment `order_key` encodes the Dalio ranking, the panel shows it — no FE
  change needed, per bet, on Goals, and in whatever the day card picks.

What the FE will NOT do: compute expected value client-side. It has no
probability or payoff data, and inventing them in the display layer would be a
new construct on the wrong side of the fence.

## 3. What the FE now does (shipped with this handoff's branch)

- Within each bet, goals render: **dated-not-past soonest first → undated in
  YOUR order, untouched → past-their-date last**, each past row carrying a
  qualitative "Past its date" chip. `dueLabel` stays the only date text
  rendered, verbatim; `due_at` is used for the maths only.
- "Past" is calendar-day, local: due-today is current all day.
- Bets themselves were already rank-ordered on every tab (Goals, Today,
  Timeline lanes) — that cross-tab agreement is unchanged and now the
  within-bet order is deterministic too, so the tabs cannot disagree about
  what leads.

## 4. Fences, restated for the generation work

- **AC-9 / N4** — the ranking is an order, never a number, anywhere a user
  reads.
- **L-2a** — the three bets' ranks stay locked; the Dalio ranking orders goals
  WITHIN a bet and never reorders the bets themselves.
- **N3** — expiry is silent state, not a nudge. A row that expires does not
  generate copy telling the user they missed it.
- **LIVE LOOP** — any new user-facing wording that expiry produces goes
  through founder sign-off; "Past its date" on the FE side was directed by the
  founder in the triggering message.
