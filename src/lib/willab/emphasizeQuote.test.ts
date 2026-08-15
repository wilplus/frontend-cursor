import { describe, expect, it } from "vitest";

import { emphasizeQuote } from "./emphasizeQuote";

describe("emphasizeQuote", () => {
  it("wraps the quote so the change is visible on the spot", () => {
    // The whole point (founder 2026-08-15): the draft carries the emphasis
    // immediately, instead of waiting for the host's refetch.
    expect(emphasizeQuote("So family is it all. Thank you.", "family is it all"))
      .toBe("So **family is it all**. Thank you.");
  });

  it("wraps only the FIRST occurrence", () => {
    expect(emphasizeQuote("all of it, all of it", "all of it"))
      .toBe("**all of it**, all of it");
  });

  it("trims the quote — a padded anchor still lands", () => {
    expect(emphasizeQuote("So family is all.", "  family  "))
      .toBe("So **family** is all.");
  });

  it("is a NO-OP when the quote is not in the text", () => {
    // Spans drift as a document is reassembled. An anchor that no longer
    // matches must not be forced somewhere it does not belong.
    const t = "So family is all.";
    expect(emphasizeQuote(t, "something else")).toBe(t);
  });

  it("is a NO-OP when it is already emphasised", () => {
    // Re-wrapping would produce ****x****, which is not the contract and
    // renders as literal asterisks to the reader (FE-1).
    const t = "So **family** is all.";
    expect(emphasizeQuote(t, "family")).toBe(t);
  });

  it("is a NO-OP when the quote sits INSIDE an open bold run", () => {
    // Wrapping here would close the outer run in the wrong place and corrupt
    // the markup around words the student never touched.
    const t = "**So family is all.** Thank you.";
    expect(emphasizeQuote(t, "family")).toBe(t);
  });

  it("refuses a quote that carries markers of its own", () => {
    const t = "So **family** is all.";
    expect(emphasizeQuote(t, "**family**")).toBe(t);
  });

  it("handles regex-special characters literally", () => {
    expect(emphasizeQuote("Cost (net) rose.", "(net)"))
      .toBe("Cost **(net)** rose.");
  });

  it("is a NO-OP on empty input rather than throwing", () => {
    expect(emphasizeQuote("", "x")).toBe("");
    expect(emphasizeQuote("text", "")).toBe("text");
    expect(emphasizeQuote(null, "x")).toBe("");
    expect(emphasizeQuote("text", null)).toBe("text");
    expect(emphasizeQuote(undefined, undefined)).toBe("");
  });

  it("emphasises a LATER quote when an earlier bold run is closed", () => {
    // An even number of `**` before the match means every prior run closed —
    // the quote is in plain text and is safe to wrap.
    expect(emphasizeQuote("**One** and two", "two"))
      .toBe("**One** and **two**");
  });
});
