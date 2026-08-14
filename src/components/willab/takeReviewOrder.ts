import type { ReviewStateTake } from "@/services/api/coachReviewState";

/* -------------------------------------------------------------------------- */
/*  Take order in the coach wrap-up — WORK FIRST (founder 2026-08-14).         */
/*                                                                            */
/*  "Once a recording is reviewed, it needs to be hidden or pushed down        */
/*  visually. The takes still WAITING for review must always sit at the very   */
/*  top."                                                                      */
/*                                                                            */
/*  Pushed DOWN rather than hidden: a reviewed take still has to be reachable  */
/*  to re-open, and a list that silently drops rows makes a coach wonder what  */
/*  happened to them. Demotion gets the same benefit without the doubt.        */
/*                                                                            */
/*  A plain .ts because vitest here has no JSX transform, so a rule living     */
/*  inside a .tsx cannot be tested at all.                                     */
/* -------------------------------------------------------------------------- */

/** Lower sorts first. Unknown state is treated as unreviewed: if we cannot
 *  tell, the safe error is showing the coach work that may not be done. */
function rank(t: ReviewStateTake): number {
  switch (t.reviewState) {
    case "delivered":
      return 2;
    case "reviewed":
      return 1;
    default:
      return 0;
  }
}

/**
 * Waiting takes first, then reviewed, then delivered — take index ascending
 * inside each group so the order is stable and readable.
 *
 * STABLE AND PURE: returns a new array, never mutates the input, and equal
 * ranks keep a deterministic order (a list that reshuffles between polls is
 * unusable when you are working down it).
 */
export function orderTakesForReview(
  takes: readonly ReviewStateTake[]
): ReviewStateTake[] {
  return [...takes].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    // Nulls last within a group rather than sorting as 0 — an unknown index
    // must not jump ahead of Take 1.
    const ai = a.takeIndex ?? Number.MAX_SAFE_INTEGER;
    const bi = b.takeIndex ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.sessionId.localeCompare(b.sessionId);
  });
}

/** How many takes still need a review — drives the "N still to review" hint. */
export function countAwaitingReview(takes: readonly ReviewStateTake[]): number {
  return takes.filter((t) => rank(t) === 0).length;
}
