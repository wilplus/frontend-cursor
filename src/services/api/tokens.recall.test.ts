// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { forgetWallet, recallWallet, rememberWallet, type TokenBalance, type TokenPrices } from "./tokens";

/* -------------------------------------------------------------------------- */
/*  A reload shows the wallet this tab last saw at once, instead of a blank    */
/*  chip for as long as a cold instance takes to answer (founder 2026-10-18). */
/*  Only a READY pair is kept, and not for long.                              */
/* -------------------------------------------------------------------------- */

const prices: TokenPrices = {
  priceVersion: "v3",
  actions: { take_short: 1000 },
  bands: [{ maxSeconds: 60, action: "take_short", price: 1000 }],
  tiers: {},
};
const ready: TokenBalance = {
  kind: "ready",
  balance: 120,
  tier: "free",
  periodStart: "2026-09-30T21:37:17+00:00",
  periodEndsAt: null,
  coachReviews: { used: 0, allowed: 0, remaining: 0 },
};

describe("the last wallet this tab saw", () => {
  afterEach(() => forgetWallet());

  it("comes back as it was shown, until it is too old or forgotten", () => {
    rememberWallet(prices, ready);
    expect(recallWallet()).toEqual({ prices, balance: ready });
    expect(recallWallet(Date.now() + 11 * 60_000)).toBeNull();
    forgetWallet();
    expect(recallWallet()).toBeNull();
  });

  it("keeps nothing it could not show: an unknown balance or no price list", () => {
    rememberWallet(prices, { kind: "unknown" });
    expect(recallWallet()).toBeNull();
    rememberWallet(null, ready);
    expect(recallWallet()).toBeNull();
  });
});
