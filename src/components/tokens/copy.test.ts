
import { describe, expect, it } from "vitest";
import { TOKENS_COPY } from "./copy";

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
