import type { TokenPlan } from "@/services/api/tokens";

/* -------------------------------------------------------------------------- */
/*  planControls — buy, manage, or neither                                     */
/*                                                                            */
/*  A PLAIN .ts ON PURPOSE. vitest here runs with no JSX transform, so a rule  */
/*  kept inside a .tsx cannot be tested at all (speakerSexAskGate.ts:5-11      */
/*  records the same reasoning). This decides money-shaped questions, so it is */
/*  exactly the kind of rule that must be testable.                           */
/*                                                                            */
/*  THE TRAP THIS FILE EXISTS TO CLOSE: `managed` and `manageAvailable` are    */
/*  two different questions and they are easy to conflate.                    */
/*                                                                            */
/*    managed         — a LIVE subscription exists right now. Decides whether  */
/*                      buy buttons may render at all. Offering checkout to a  */
/*                      subscriber creates a SECOND subscription and charges   */
/*                      them twice; a plan CHANGE goes through the portal.    */
/*    manageAvailable — a Stripe CUSTOMER exists. Decides whether the portal   */
/*                      button renders. The customer outlives the             */
/*                      subscription, so someone who cancelled months ago is   */
/*                      still true here and can still reach their invoices.   */
/*                                                                            */
/*  `past_due` is deliberately managed:true upstream — the card failed, the    */
/*  subscription still exists, and the portal is where it gets fixed. Showing  */
/*  "upgrade" there would sell a second subscription to solve a billing        */
/*  problem.                                                                  */
/* -------------------------------------------------------------------------- */

export interface PlanControls {
  /** May we offer a checkout at all? */
  canBuy: boolean;
  /** May we offer the Stripe billing portal? */
  canManage: boolean;
  /** Set only when the subscription is genuinely scheduled to end. */
  endsOn: string | null;
}

export function planControlsFor(
  plan: TokenPlan | null,
  currentTier: string | null
): PlanControls {
  if (!plan) {
    // NO PLAN OBJECT → reproduce today's behaviour exactly. An older backend,
    // or a DB without the subscription-state migration, reports nothing here;
    // that must degrade to the pre-portal wallet rather than to a wrong answer.
    //
    // Unknown/null tier counts as free-ish for buying, matching the previous
    // local heuristic: nobody who MIGHT already be subscribed gets offered a
    // second subscription, and "free" or "never had one" both genuinely can buy.
    return {
      canBuy: currentTier === "free" || currentTier === null,
      canManage: false,
      endsOn: null,
    };
  }
  return {
    canBuy: !plan.managed,
    canManage: plan.manageAvailable,
    // A LAPSED plan is not "ending" — it has already gone. Rendering an
    // end date off a period that has passed dates the page wrong, so the
    // date rides only on an explicit cancel-at-period-end.
    endsOn: plan.cancelAtPeriodEnd ? plan.currentPeriodEnd : null,
  };
}
