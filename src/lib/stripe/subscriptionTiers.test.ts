import { afterEach, describe, expect, it, vi } from "vitest";

// The module under test is `server-only` (it reads a secret-adjacent env var and
// must never reach the client). That marker throws outside a server bundle, so
// stub it — the guard is a build-time constraint, not behaviour worth asserting.
vi.mock("server-only", () => ({}));

import {
  getTierPriceMap,
  isPaidTier,
  purchasableTiers,
} from "./subscriptionTiers.server";

/* -------------------------------------------------------------------------- */
/*  This map decides which Stripe Price a plan button charges. Every test here  */
/*  is a way it could take the wrong money:                                    */
/*                                                                            */
/*   - a mistyped tier silently selling the wrong allowance                     */
/*   - a duplicate mapping repricing a plan depending on key order              */
/*   - "free" becoming purchasable (you do not check out to stop paying)        */
/*   - a config typo taking the whole wallet down instead of just not selling   */
/* -------------------------------------------------------------------------- */

function withEnv(value: string | undefined) {
  vi.stubEnv("STRIPE_PRICE_TIER_JSON", value ?? "");
}

afterEach(() => vi.unstubAllEnvs());

describe("getTierPriceMap", () => {
  it("inverts the BE's {price_id: tier} shape into tier → price", () => {
    // Same env var, same shape as stripe_subscription_tiers.py reads, so the
    // two sides cannot disagree about which price means which plan.
    withEnv(
      JSON.stringify({
        price_starter123: "starter",
        price_pro456: "pro",
        price_max789: "max",
      })
    );
    expect(getTierPriceMap()).toEqual({
      starter: "price_starter123",
      pro: "price_pro456",
      max: "price_max789",
    });
  });

  it("never sells 'free', however it is mapped", () => {
    withEnv(JSON.stringify({ price_free1: "free", price_pro456: "pro" }));
    const map = getTierPriceMap();
    expect(map).not.toHaveProperty("free");
    expect(map.pro).toBe("price_pro456");
  });

  it("ignores unknown tiers and non-price keys rather than guessing", () => {
    withEnv(
      JSON.stringify({
        price_x: "platinum", // not a tier we sell
        not_a_price: "pro", // not a Stripe price id
        price_pro456: "pro",
      })
    );
    expect(getTierPriceMap()).toEqual({ pro: "price_pro456" });
  });

  it("keeps the FIRST mapping when a tier is duplicated", () => {
    // Otherwise the price charged would depend on object key order, which is a
    // silent reprice waiting to happen.
    withEnv(JSON.stringify({ price_first: "pro", price_second: "pro" }));
    expect(getTierPriceMap().pro).toBe("price_first");
  });

  it("tolerates case and whitespace in the tier name", () => {
    withEnv(JSON.stringify({ price_pro456: "  PRO " }));
    expect(getTierPriceMap().pro).toBe("price_pro456");
  });

  it("sells nothing when unset or malformed, rather than throwing", () => {
    // A config typo must degrade to "no plans for sale", not take the wallet
    // page down with it.
    for (const raw of [undefined, "", "{not json", "[]", "null", '"nope"']) {
      withEnv(raw);
      expect(getTierPriceMap()).toEqual({});
    }
  });
});

describe("purchasableTiers", () => {
  it("lists only the tiers with a usable price, in ladder order", () => {
    withEnv(JSON.stringify({ price_max789: "max", price_starter1: "starter" }));
    expect(purchasableTiers()).toEqual(["starter", "max"]);
  });

  it("is empty when nothing is configured, so no button renders", () => {
    withEnv(undefined);
    expect(purchasableTiers()).toEqual([]);
  });
});

describe("isPaidTier", () => {
  it("accepts only the three paid tiers", () => {
    expect(isPaidTier("starter")).toBe(true);
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("max")).toBe(true);
    // The request body is client-controlled, so this is the gate that stops a
    // crafted `tier` reaching the price lookup.
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier("PRO")).toBe(false);
    expect(isPaidTier(undefined)).toBe(false);
    expect(isPaidTier(7)).toBe(false);
  });
});
