/* -------------------------------------------------------------------------- */
/*  goalOrder — how goals sort inside a bet, on every tab that shows them      */
/*                                                                            */
/*  Founder 2026-08-02, after testing the live panel: a task dated 29/07 was   */
/*  presented as current on 01/08, and goals inside a bet arrived in no        */
/*  order. Both are display failures the FE can own: the rows are the user's,  */
/*  but the ORDER they read in is ours, and it was "whatever the server        */
/*  happened to return".                                                       */
/*                                                                            */
/*  The rule, from the founder's Dalio directive (must-dos before              */
/*  like-to-dos, highest-impact first, a short revisit list for the rest):     */
/*                                                                            */
/*    1. DATED, NOT YET PAST — soonest first. A date is the must-do signal     */
/*       the data actually carries, and the nearest deadline is the one that   */
/*       decides today.                                                        */
/*    2. UNDATED — in the server's order, untouched. This is where the         */
/*       backend's own prioritisation (order_key, the generation-side          */
/*       expected-value ranking) shows through; the FE must not shuffle it.    */
/*    3. PAST THEIR DATE — last, each marked "Past its date". Not hidden:      */
/*       they are the user's own writing and the revisit list is a Dalio       */
/*       concept, not a bin. But never presented as current, because a stale   */
/*       task wearing today's clothes is the error that started this.          */
/*                                                                            */
/*  WHAT THIS DELIBERATELY DOES NOT DO (AC-9 / N4 / CONSTRUCT): no expected    */
/*  value is computed, no probability, no payoff, no score of any kind — not   */
/*  internally here and certainly not on screen. The Dalio expected-value      */
/*  weighing is the BACKEND's business when it writes order_key and picks the  */
/*  day's one thing, where it stays a ranking, never a surfaced number. This   */
/*  module orders by date and defers to the served order for the rest.         */
/*                                                                            */
/*  Dates compare as CALENDAR DAYS, local. Due today is current all day, not   */
/*  overdue at one minute past midnight UTC. `dueAt` is used for the maths and */
/*  `dueLabel` stays the only thing rendered — the label is the source of      */
/*  truth on screen (spec §3.2) and this module never rewrites it.             */
/* -------------------------------------------------------------------------- */

export interface OrderableGoal {
  dueAt: string | null;
}

/** Day-resolution timestamp, local. NaN-safe: an unparseable dueAt reads as
 *  undated rather than exploding the sort. */
function dayValue(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Past its date: strictly before today, by calendar day. */
export function isPastDue(goal: OrderableGoal, now: Date = new Date()): boolean {
  const due = dayValue(goal.dueAt);
  if (due === null) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return due < today;
}

/**
 * Order the goals of ONE bet for display. Stable within every group, so the
 * server's order — the backend's own prioritisation — survives wherever a
 * date does not overrule it.
 */
export function orderGoals<T extends OrderableGoal>(
  goals: readonly T[],
  now: Date = new Date()
): T[] {
  const current: Array<{ goal: T; due: number | null }> = [];
  const past: T[] = [];
  for (const goal of goals) {
    if (isPastDue(goal, now)) past.push(goal);
    else current.push({ goal, due: dayValue(goal.dueAt) });
  }
  // Dated before undated, soonest first; undated keep server order. The sort
  // must be stable for that promise to hold — Array.prototype.sort is, since
  // ES2019.
  current.sort((a, b) => {
    if (a.due === null && b.due === null) return 0;
    if (a.due === null) return 1;
    if (b.due === null) return -1;
    return a.due - b.due;
  });
  return [...current.map((c) => c.goal), ...past];
}
