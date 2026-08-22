import { describe, expect, it } from "vitest";
import {
  bandFor,
  mapRecordingBand,
  mapTokenBalance,
  mapTokenHistory,
  mapArcCharges,
  mapTokenPrices,
  nextBalance,
  priceForArcAction,
  priceOf,
  type TokenBalance,
} from "./tokens";

/* -------------------------------------------------------------------------- */
/*  The wallet's failure modes are the whole test surface here. Every one of    */
/*  these assertions stands for a way the UI could lie to someone about money   */
/*  or take away something they already paid for.                               */
/* -------------------------------------------------------------------------- */

const PRICES_PAYLOAD = {
  enabled: true,
  price_version: "2026-07-28-v1",
  actions: { take_short: 1000, take_medium: 3000, take_long: 6000, chat: 150 },
  bands: [
    // Deliberately out of order — `bandFor` depends on the sort, not the BE.
    { max_seconds: 900, action: "take_long", price: 6000 },
    { max_seconds: 120, action: "take_short", price: 1000 },
    { max_seconds: 360, action: "take_medium", price: 3000 },
  ],
  tiers: {
    free: { tokens_per_month: 12000, coach_reviews_per_month: 0, usd_per_month: 0 },
    starter: { tokens_per_month: 50000, coach_reviews_per_month: 1, usd_per_month: 5 },
  },
};

describe("the flag-off probe", () => {
  it("reads {enabled:false} as OFF on every endpoint", () => {
    // Off is 200 rather than 404 precisely so it is distinguishable from a
    // broken backend. Every mapper has to honour that.
    expect(mapTokenBalance({ enabled: false })).toEqual({ kind: "off" });
    expect(mapRecordingBand({ enabled: false })).toEqual({ kind: "off" });
    expect(mapTokenHistory({ enabled: false })).toEqual({ kind: "off" });
    expect(mapTokenPrices({ enabled: false })).toBeNull();
  });

  it("treats a missing or malformed envelope as off, never as enabled", () => {
    for (const raw of [null, undefined, {}, "nope", { enabled: "true" }]) {
      expect(mapTokenBalance(raw).kind).toBe("off");
      expect(mapTokenPrices(raw)).toBeNull();
    }
  });
});

describe("mapTokenBalance", () => {
  it("carries the wallet, the renewal date and the coach-review counter", () => {
    const b = mapTokenBalance({
      enabled: true,
      available: true,
      balance: 41500,
      tier: "starter",
      period_start: "2026-07-28T09:00:00+00:00",
      period_ends_at: "2026-08-28T09:00:00+00:00",
      coach_reviews: { used: 0, allowed: 1, remaining: 1 },
    });
    expect(b).toEqual({
      kind: "ready",
      balance: 41500,
      tier: "starter",
      periodStart: "2026-07-28T09:00:00+00:00",
      periodEndsAt: "2026-08-28T09:00:00+00:00",
      coachReviews: { used: 0, allowed: 1, remaining: 1 },
      plan: null,
    });
  });

  it("carries the subscription when the BE publishes one", () => {
    const b = mapTokenBalance({
      enabled: true,
      available: true,
      balance: 100,
      tier: "coaching",
      plan: {
        tier: "coaching",
        managed: true,
        status: "active",
        cancel_at_period_end: false,
        current_period_end: "2026-09-13T00:00:00Z",
        manage_available: true,
      },
    });
    expect(b).toMatchObject({
      plan: {
        tier: "coaching",
        managed: true,
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: "2026-09-13T00:00:00Z",
        manageAvailable: true,
      },
    });
  });

  it("drops a half-parsed plan rather than defaulting its booleans", () => {
    // A missing `managed` must not become false: that would offer checkout to
    // a live subscriber and charge them a second time.
    const b = mapTokenBalance({
      enabled: true,
      available: true,
      balance: 100,
      plan: { tier: "coaching", status: "active" },
    });
    expect(b).toMatchObject({ plan: null });
  });

  it("an older backend with no plan reads as null, not a crash", () => {
    const b = mapTokenBalance({ enabled: true, available: true, balance: 100 });
    expect(b).toMatchObject({ kind: "ready", plan: null });
  });

  it("reads available:false as UNKNOWN, never as zero", () => {
    // The distinction the whole module turns on: showing zero for a failed
    // lookup would hide the record button over a bad read.
    const b = mapTokenBalance({ enabled: true, available: false, balance: 41500 });
    expect(b.kind).toBe("unknown");
  });

  it("keeps a genuine zero balance as a real, readable zero", () => {
    // Out of tokens is a fact about the account; unknown is a fact about the
    // read. They must not collapse into each other in either direction.
    const b = mapTokenBalance({ enabled: true, available: true, balance: 0 });
    expect(b).toMatchObject({ kind: "ready", balance: 0 });
  });

  it("falls back to unknown when there is no number to show", () => {
    expect(mapTokenBalance({ enabled: true, available: true }).kind).toBe("unknown");
    expect(
      mapTokenBalance({ enabled: true, available: true, balance: "41500" }).kind
    ).toBe("unknown");
  });

  it("derives coach reviews remaining when the BE omits it", () => {
    const b = mapTokenBalance({
      enabled: true,
      available: true,
      balance: 10,
      coach_reviews: { used: 4, allowed: 6 },
    });
    expect(b).toMatchObject({ coachReviews: { used: 4, allowed: 6, remaining: 2 } });
  });
});

describe("mapTokenPrices — the mappers are TIER-KEY AGNOSTIC", () => {
  it("maps whatever tier keys the BE serves, old names or new", () => {
    // The sold ladder gets renamed and repriced. Nothing in the FE may know
    // the keys: a rename must be a config change, never a code change.
    const p = mapTokenPrices({
      enabled: true,
      price_version: "v-next",
      actions: {},
      bands: [],
      tiers: {
        free: { tokens_per_month: 12000, coach_reviews_per_month: 0, usd_per_month: 0 },
        practice: {
          tokens_per_month: 150000,
          coach_reviews_per_month: 0,
          usd_per_month: 12,
        },
        coaching: {
          tokens_per_month: 150000,
          coach_reviews_per_month: 3,
          usd_per_month: 39,
        },
        intensive: {
          tokens_per_month: 400000,
          coach_reviews_per_month: 8,
          usd_per_month: 89,
        },
      },
    })!;
    expect(Object.keys(p.tiers).sort()).toEqual([
      "coaching",
      "free",
      "intensive",
      "practice",
    ]);
    expect(p.tiers.intensive).toEqual({
      tokensPerMonth: 400000,
      coachReviewsPerMonth: 8,
      usdPerMonth: 89,
    });
  });
});

describe("mapTokenPrices", () => {
  it("carries the published list, version included, and sorts the bands", () => {
    const p = mapTokenPrices(PRICES_PAYLOAD)!;
    expect(p.priceVersion).toBe("2026-07-28-v1");
    expect(p.actions.take_medium).toBe(3000);
    expect(p.bands.map((b) => b.maxSeconds)).toEqual([120, 360, 900]);
    expect(p.tiers.starter).toEqual({
      tokensPerMonth: 50000,
      coachReviewsPerMonth: 1,
      usdPerMonth: 5,
    });
  });

  it("drops unusable entries rather than coercing them to a number", () => {
    const p = mapTokenPrices({
      enabled: true,
      actions: { good: 100, bad: "100", worse: null },
      bands: [{ max_seconds: 60 }, { max_seconds: 60, action: "x", price: 5 }],
      tiers: { broken: { coach_reviews_per_month: 1 } },
    })!;
    expect(p.actions).toEqual({ good: 100 });
    expect(p.bands).toHaveLength(1);
    expect(p.tiers).toEqual({});
  });
});

describe("priceOf", () => {
  it("returns null for an unpublished action instead of inventing a price", () => {
    const p = mapTokenPrices(PRICES_PAYLOAD);
    expect(priceOf(p, "take_long")).toBe(6000);
    // A price the FE does not have is "show nothing", never a default and
    // never free. Acting on a guessed number is what this forbids.
    expect(priceOf(p, "coach_review")).toBeNull();
    expect(priceOf(null, "take_long")).toBeNull();
  });
});

describe("bandFor", () => {
  const prices = mapTokenPrices(PRICES_PAYLOAD);

  it("picks the first band the take fits in, inclusive of the cap", () => {
    expect(bandFor(prices, 60)?.action).toBe("take_short");
    expect(bandFor(prices, 120)?.action).toBe("take_short");
    expect(bandFor(prices, 121)?.action).toBe("take_medium");
    expect(bandFor(prices, 900)?.action).toBe("take_long");
  });

  it("quotes the top band past the last cap rather than a made-up price", () => {
    // The length presets go to 60 minutes but the bands stop at 15, so this is
    // a real user path, not a hypothetical. The top band is the honest ceiling.
    expect(bandFor(prices, 3600)?.action).toBe("take_long");
    expect(bandFor(prices, null)?.action).toBe("take_long");
  });

  it("has no band to quote when prices are unavailable", () => {
    expect(bandFor(null, 60)).toBeNull();
    expect(bandFor(mapTokenPrices({ enabled: true, bands: [] }), 60)).toBeNull();
  });
});

describe("mapRecordingBand", () => {
  it("carries the quotable band", () => {
    expect(
      mapRecordingBand({
        enabled: true,
        can_record: true,
        balance: 41500,
        period_ends_at: "2026-08-28T09:00:00+00:00",
        max_seconds: 900,
        action: "take_long",
        price: 6000,
      })
    ).toEqual({
      kind: "priced",
      maxSeconds: 900,
      action: "take_long",
      price: 6000,
      balance: 41500,
      periodEndsAt: "2026-08-28T09:00:00+00:00",
    });
  });

  it("reports can_record:false as EXHAUSTED, keeping the renewal date", () => {
    // "exhausted", not "blocked": the renewal date is what makes waiting a
    // visible option, and the caller is required to leave recording enabled
    // because takes charge after transcription and fail open.
    expect(
      mapRecordingBand({
        enabled: true,
        can_record: false,
        balance: 200,
        period_ends_at: "2026-08-28T09:00:00+00:00",
      })
    ).toEqual({
      kind: "exhausted",
      balance: 200,
      periodEndsAt: "2026-08-28T09:00:00+00:00",
    });
  });

  it("falls back to unknown when a can_record:true payload has no price", () => {
    expect(
      mapRecordingBand({ enabled: true, can_record: true, balance: 100 }).kind
    ).toBe("unknown");
  });
});

describe("mapArcCharges / priceForArcAction", () => {
  const PAYLOAD = {
    enabled: true,
    arc_id: "arc_1",
    charged: { insights: true, moment_explanation: false },
    prices: { insights: 1000, moment_explanation: 2500 },
  };

  it("prices an action this arc has NOT paid for", () => {
    expect(priceForArcAction(mapArcCharges(PAYLOAD), "moment_explanation")).toBe(2500);
  });

  it("shows NOTHING for an action already paid for on this arc", () => {
    // The whole reason the endpoint exists. These charges are idempotent, so
    // once paid the action is free, and a lingering price would ask for money
    // that is not owed and discourage re-opening what was bought.
    expect(priceForArcAction(mapArcCharges(PAYLOAD), "insights")).toBeNull();
  });

  it("shows nothing when the charge state is unknown, never assuming unpaid", () => {
    // Assuming "not yet charged" is exactly what produces a wrong label.
    expect(priceForArcAction(mapArcCharges(PAYLOAD), "coach_review")).toBeNull();
    expect(priceForArcAction({ kind: "unknown" }, "moment_explanation")).toBeNull();
    expect(priceForArcAction({ kind: "off" }, "moment_explanation")).toBeNull();
  });

  it("shows nothing when charged is false but no price was published", () => {
    const arc = mapArcCharges({ enabled: true, charged: { moment_explanation: false }, prices: {} });
    expect(priceForArcAction(arc, "moment_explanation")).toBeNull();
  });

  it("reads flag-off as off, and an empty payload as unknown", () => {
    expect(mapArcCharges({ enabled: false })).toEqual({ kind: "off" });
    // Neither half present is not "nothing has been charged yet".
    expect(mapArcCharges({ enabled: true }).kind).toBe("unknown");
    expect(mapArcCharges({ enabled: true, charged: {}, prices: {} }).kind).toBe("unknown");
  });

  it("ignores non-boolean charged flags rather than coercing them", () => {
    const arc = mapArcCharges({
      enabled: true,
      charged: { moment_explanation: "false", insights: false },
      prices: { moment_explanation: 2500, insights: 1000 },
    });
    // "false" is not false. Coercing it would price an action already paid for.
    expect(priceForArcAction(arc, "moment_explanation")).toBeNull();
    expect(priceForArcAction(arc, "insights")).toBe(1000);
  });
});

describe("nextBalance", () => {
  const ready: TokenBalance = {
    kind: "ready",
    balance: 41500,
    tier: "starter",
    periodStart: null,
    periodEndsAt: null,
    coachReviews: null,
    plan: null,
  };

  it("holds the last known balance through an unreadable refresh", () => {
    // One flaky poll must not blank the chip: to the user, a number that
    // vanishes mid-session looks like something just spent their balance.
    expect(nextBalance(ready, { kind: "unknown" })).toBe(ready);
  });

  it("takes a genuine drop to zero", () => {
    // The mirror case. Holding a stale number here would tell someone they
    // still have tokens they have already spent.
    const empty = { ...ready, balance: 0 };
    expect(nextBalance(ready, empty)).toBe(empty);
  });

  it("takes a fresh value, and a flag switched off underneath us", () => {
    const richer = { ...ready, balance: 50000 };
    expect(nextBalance(ready, richer)).toBe(richer);
    expect(nextBalance(ready, { kind: "off" })).toEqual({ kind: "off" });
  });

  it("has nothing to hold when nothing was ever read", () => {
    expect(nextBalance({ kind: "unknown" }, { kind: "unknown" })).toEqual({
      kind: "unknown",
    });
  });
});

describe("mapTokenHistory", () => {
  it("carries the ledger and the pagination cursor", () => {
    const h = mapTokenHistory({
      enabled: true,
      next_before_id: 88,
      entries: [
        {
          id: 91,
          delta: -1000,
          balance_after: 41500,
          action: "take_short",
          ref_id: "rec_1",
          tier: "starter",
          created_at: "2026-07-28T09:00:00+00:00",
        },
      ],
    });
    expect(h).toMatchObject({ kind: "ready", nextBeforeId: 88 });
    expect(h.kind === "ready" && h.entries[0]).toMatchObject({
      id: 91,
      delta: -1000,
      action: "take_short",
    });
  });

  it("skips unusable rows without dropping the readable ones", () => {
    const h = mapTokenHistory({
      enabled: true,
      entries: [{ id: 1, delta: -5 }, { delta: -5 }, { id: 3 }],
    });
    expect(h.kind === "ready" && h.entries).toHaveLength(1);
  });

  it("distinguishes an unreadable ledger from an empty one", () => {
    // An empty ledger says "nothing spent yet"; an unreadable one must not.
    expect(mapTokenHistory({ enabled: true }).kind).toBe("unknown");
    expect(mapTokenHistory({ enabled: true, entries: [] })).toEqual({
      kind: "ready",
      entries: [],
      nextBeforeId: null,
    });
  });
});
