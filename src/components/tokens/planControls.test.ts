import { describe, expect, it } from "vitest";
import { planControlsFor } from "./planControls";
import type { TokenPlan } from "@/services/api/tokens";

/* Buy-vs-manage is a MONEY decision, so every row of the matrix is pinned.
 * The two failures these guard against are both expensive:
 *   - offering checkout to a live subscriber  -> a SECOND subscription
 *   - hiding manage from a cancelled customer -> no route to their invoices */

function plan(over: Partial<TokenPlan> = {}): TokenPlan {
  return {
    tier: "practice",
    managed: true,
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: "2026-09-13T00:00:00Z",
    manageAvailable: true,
    ...over,
  };
}

describe("planControlsFor — the matrix", () => {
  it("live subscription: manage only, NEVER a buy button", () => {
    const c = planControlsFor(plan({ managed: true, manageAvailable: true }), "practice");
    expect(c.canBuy).toBe(false);
    expect(c.canManage).toBe(true);
  });

  it("no subscription, no customer: buy only (an ordinary free user)", () => {
    const c = planControlsFor(
      plan({ managed: false, manageAvailable: false, status: null }),
      "free"
    );
    expect(c.canBuy).toBe(true);
    expect(c.canManage).toBe(false);
  });

  it("cancelled but still a customer: BOTH buy and manage", () => {
    // Resubscribe, and still reach past invoices. manage_available tracks the
    // Stripe CUSTOMER, which outlives the subscription.
    const c = planControlsFor(
      plan({ managed: false, manageAvailable: true, status: "canceled" }),
      "free"
    );
    expect(c.canBuy).toBe(true);
    expect(c.canManage).toBe(true);
  });

  it("live subscription with no customer record: neither (unmigrated DB)", () => {
    const c = planControlsFor(plan({ managed: true, manageAvailable: false }), "pro");
    expect(c.canBuy).toBe(false);
    expect(c.canManage).toBe(false);
  });

  it("past_due is MANAGED: fix the card, never sell a second plan", () => {
    // The card failed and the subscription still exists. Offering an upgrade
    // here sells a second subscription to solve a billing problem.
    const c = planControlsFor(plan({ managed: true, status: "past_due" }), "coached");
    expect(c.canBuy).toBe(false);
    expect(c.canManage).toBe(true);
  });
});

describe("planControlsFor — endsOn", () => {
  it("renders a date only when the plan is genuinely cancelling", () => {
    expect(planControlsFor(plan({ cancelAtPeriodEnd: true }), "practice").endsOn).toBe(
      "2026-09-13T00:00:00Z"
    );
  });

  it("no end date on a live plan, even though the period has one", () => {
    // Every subscription has a current_period_end. Only an explicit
    // cancel-at-period-end means it is ENDING.
    expect(planControlsFor(plan({ cancelAtPeriodEnd: false }), "practice").endsOn).toBeNull();
  });

  it("a lapsed plan is not 'ending' — it has already gone", () => {
    const c = planControlsFor(
      plan({ managed: false, cancelAtPeriodEnd: false, status: "canceled" }),
      "free"
    );
    expect(c.endsOn).toBeNull();
  });
});

describe("planControlsFor — no plan object (older backend)", () => {
  it("reproduces the pre-portal behaviour exactly", () => {
    expect(planControlsFor(null, "free")).toEqual({
      canBuy: true,
      canManage: false,
      endsOn: null,
    });
    expect(planControlsFor(null, null)).toEqual({
      canBuy: true,
      canManage: false,
      endsOn: null,
    });
  });

  it("an unknown paid tier still cannot buy, and cannot manage", () => {
    // Without a plan object we cannot prove there is no subscription, so a
    // named non-free tier must not be offered checkout.
    expect(planControlsFor(null, "pro")).toEqual({
      canBuy: false,
      canManage: false,
      endsOn: null,
    });
  });
});
