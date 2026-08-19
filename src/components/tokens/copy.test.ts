import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOKENS_COPY, actionLabel, formatShortDate, formatTokens } from "./copy";

/* -------------------------------------------------------------------------- */
/*  The words are founder-signed for one-time packages. These tests pin the    */
/*  billing truth and the AC-9 rules so recurring language cannot creep back.  */
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
    // Every caller drops the clause on null rather than printing an invalid
    // date in the ledger or a dated plan state.
    expect(formatShortDate(null)).toBeNull();
    expect(formatShortDate("")).toBeNull();
    expect(formatShortDate("not-a-date")).toBeNull();
  });
});

describe("the menu row", () => {
  it("is the number and nothing else", () => {
    expect(TOKENS_COPY.menuRowValue("41,500")).toBe("41,500");
  });
});

describe("coach reviews", () => {
  it("reads as a count included in the purchase, never as tokens", () => {
    // The cap protects the founder's calendar and is not purchasable, so it
    // must never be expressed in a currency.
    expect(TOKENS_COPY.coachReviewsUsed(0, 1)).toBe("0 of 1 used");
    expect(TOKENS_COPY.coachReviewsUsed(10, 10)).toBe("10 of 10 used");
  });

  it("does not promise that exhausted reviews come back", () => {
    expect(TOKENS_COPY.coachReviewsExhausted("28 Aug")).toBe(
      "You've used all coach reviews included in this purchase."
    );
  });
});

describe("plans", () => {
  it("describes every paid tier as a one-time purchase", () => {
    expect(TOKENS_COPY.walletPerMonth(25)).toBe("$25 one time");
    expect(TOKENS_COPY.walletPerMonth(0)).toBe("Free");
    expect(TOKENS_COPY.planCardPerMonth).toBe("one-time purchase");
    expect(TOKENS_COPY.walletTierTokens("50,000")).toBe("50,000 tokens");
    expect(TOKENS_COPY.walletTierReviews(1)).toBe("1 coach review");
    expect(TOKENS_COPY.walletTierReviews(0)).toBe("No coach reviews");
    expect(TOKENS_COPY.planFreeLine("12,000")).toBe(
      "Free plan: 12,000 tokens included, no coach reviews."
    );
  });
});

describe("the empty state", () => {
  it("does not promise a renewal", () => {
    expect(TOKENS_COPY.recordEmpty("28 Aug")).toBe("You're out of tokens.");
    expect(TOKENS_COPY.recordEmpty(null)).toBe("You're out of tokens.");
  });
});

describe("one-time purchase accuracy", () => {
  it("contains no recurring-billing language in the wallet copy", () => {
    const rendered = (Object.values(TOKENS_COPY) as unknown[])
      .map((value) =>
        typeof value === "function"
          ? (value as (...args: unknown[]) => string)(1, "28 Aug")
          : value
      )
      .join(" ");
    expect(rendered).not.toMatch(/per month|a month|this month|renew|\/mo\b/i);
  });

  it("does not render the legacy period end beside the balance", () => {
    const panel = readFileSync(
      "src/components/tokens/TokenWalletPanel.tsx",
      "utf8"
    );
    expect(panel).not.toMatch(/walletRenews|periodEndsAt/);
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
