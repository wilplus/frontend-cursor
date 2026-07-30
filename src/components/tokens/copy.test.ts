import { describe, expect, it } from "vitest";
import { TOKENS_COPY, actionLabel, formatShortDate, formatTokens } from "./copy";

/* -------------------------------------------------------------------------- */
/*  The words are placeholders pending sign-off; the RULES they encode are     */
/*  not. These tests pin the rules, so a copy rewrite is free but a rewrite    */
/*  that drops the renewal date or invents a percentage is not.                */
/* -------------------------------------------------------------------------- */

describe("formatTokens", () => {
  it("groups thousands so a five-figure balance is readable at a glance", () => {
    expect(formatTokens(41500)).toBe("41,500");
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(1500000)).toBe("1,500,000");
  });
});

describe("formatShortDate", () => {
  it("renders a day and month", () => {
    expect(formatShortDate("2026-08-28T09:00:00+00:00")).toBe("28 Aug");
  });

  it("returns null rather than 'Invalid Date' for an unusable value", () => {
    // Every caller drops the clause on null. Printing "renews Invalid Date"
    // next to someone's balance is worse than saying nothing about renewal.
    expect(formatShortDate(null)).toBeNull();
    expect(formatShortDate("")).toBeNull();
    expect(formatShortDate("not-a-date")).toBeNull();
  });
});

describe("the chip", () => {
  it("carries the renewal date with the balance", () => {
    // Load-bearing: without it a falling balance reads as a countdown to
    // being locked out rather than "wait or top up".
    expect(TOKENS_COPY.chip("41,500", "28 Aug")).toBe("41,500 · renews 28 Aug");
  });

  it("shows the bare balance when the renewal date is unknown", () => {
    expect(TOKENS_COPY.chip("41,500", null)).toBe("41,500");
  });
});

describe("coach reviews", () => {
  it("reads as a count of a monthly allowance, never as tokens", () => {
    // The cap protects the founder's calendar and is not purchasable, so it
    // must never be expressed in a currency.
    expect(TOKENS_COPY.coachReviewsUsed(0, 1)).toBe("0 of 1 used this month");
    expect(TOKENS_COPY.coachReviewsUsed(10, 10)).toBe("10 of 10 used this month");
  });

  it("says WHEN they come back when they run out", () => {
    // The one place two limits legitimately disagree (full wallet, no reviews
    // left). Unexplained, that reads as a bug.
    expect(TOKENS_COPY.coachReviewsExhausted("28 Aug")).toContain("28 Aug");
  });
});

describe("plans", () => {
  it("prices every tier per month, because the allowance resets", () => {
    // Not packs, not credits, not one-time. Copy that implies a purchase makes
    // the first monthly reset feel like theft.
    expect(TOKENS_COPY.walletPerMonth(25)).toBe("$25 / month");
    expect(TOKENS_COPY.walletPerMonth(0)).toBe("Free");
    expect(TOKENS_COPY.walletTierTokens("50,000")).toContain("a month");
    expect(TOKENS_COPY.walletTierReviews(1)).toBe("1 coach review a month");
    expect(TOKENS_COPY.walletTierReviews(0)).toBe("No coach reviews");
  });
});

describe("the empty state", () => {
  it("names the renewal date, so waiting stays a visible option", () => {
    // Hiding the reset to push an upgrade is the dark pattern this forbids.
    expect(TOKENS_COPY.recordEmpty("28 Aug")).toContain("28 Aug");
    expect(TOKENS_COPY.recordEmpty(null)).toBe("You're out of tokens.");
  });
});

describe("actionLabel", () => {
  it("labels the known actions", () => {
    expect(actionLabel("take_short")).toBe("Short take");
    expect(actionLabel("moment_explanation")).toBe("Key moment explanation");
  });

  it("humanises an action it has never heard of instead of dropping it", () => {
    // The BE owns this list. A newly priced action must still appear in the
    // ledger rather than vanishing because the FE was not redeployed.
    expect(actionLabel("brand_new_thing")).toBe("Brand new thing");
    expect(actionLabel(null)).toBe("Activity");
  });
});

describe("AC-9", () => {
  it("ships no comparative, streak or efficiency framing", () => {
    // A blunt guard on the whole copy surface: the wallet says what you have
    // and what things cost. The moment it says how well you are doing, it is
    // a performance score.
    // The entries have mixed arities and param types, so they are called
    // through a loose signature: this asserts on the WORDS, not the shapes.
    const rendered = (Object.values(TOKENS_COPY) as unknown[])
      .map((v) => (typeof v === "function" ? (v as (...a: unknown[]) => string)(1, "1") : v))
      .join(" ")
      .toLowerCase();
    for (const banned of [
      "streak",
      "you've earned",
      "efficien",
      "%",
      "average",
      "other users",
      "better than",
      "score",
    ]) {
      expect(rendered).not.toContain(banned);
    }
  });
});
