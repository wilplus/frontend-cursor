import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { emphasizeQuote } from "./emphasizeQuote";

/* THE ACCENT MARK IS THE ONE THE SERVER BAKES (founder 2026-08-15).
 *
 * This wrote `**bold**` until the founder asked what actually happens after a
 * style suggestion is applied. The answer was: the words went BOLD on the
 * click and turned ORANGE a moment later when the refetch landed, because the
 * server bakes `{{orange:…}}` (ideal_decision_ledger.bake_piece →
 * ideal_text_block.wrap_accent). Two treatments for one accepted accent, a
 * beat apart.
 *
 * And bold was not merely a different colour: it is the mark of a PROPOSED
 * accent (intervention_candidates._VISUAL_ACCENT). Painting it at the moment
 * of acceptance showed the pre-decision state as the result of the decision.
 */

describe("emphasizeQuote paints the ACCEPTED accent", () => {
  it("wraps the quote so the change is visible on the spot", () => {
    // The whole point (founder 2026-08-15): the draft carries the accent
    // immediately, instead of waiting for the host's refetch.
    expect(emphasizeQuote("So family is it all. Thank you.", "family is it all"))
      .toBe("So {{orange:family is it all}}. Thank you.");
  });

  it("writes the SAME token the backend bakes", () => {
    // The one thing this test file exists for. `{{orange:` is what
    // ideal_text_block.wrap_accent writes; anything else means the student
    // sees one treatment on the click and another on the refetch.
    const src = readFileSync("src/lib/willab/emphasizeQuote.ts", "utf8");
    expect(src).toMatch(/const OPEN = "\{\{orange:";/);
    expect(src).toMatch(/const CLOSE = "\}\}";/);
    // And bold — the PROPOSED-accent mark — is not written here at all.
    expect(emphasizeQuote("a b c", "b")).not.toContain("**");
  });

  it("wraps only the FIRST occurrence", () => {
    expect(emphasizeQuote("all of it, all of it", "all of it"))
      .toBe("{{orange:all of it}}, all of it");
  });

  it("trims the quote — a padded anchor still lands", () => {
    expect(emphasizeQuote("So family is all.", "  family  "))
      .toBe("So {{orange:family}} is all.");
  });

  it("is a NO-OP when the quote is not in the text", () => {
    // Spans drift as a document is reassembled. An anchor that no longer
    // matches must not be forced somewhere it does not belong.
    const t = "So family is all.";
    expect(emphasizeQuote(t, "something else")).toBe(t);
  });

  it("is a NO-OP when it is already accented", () => {
    // Re-wrapping would nest the token, which is not the contract and prints
    // its own syntax at the reader (FE-1).
    const t = "So {{orange:family}} is all.";
    expect(emphasizeQuote(t, "family")).toBe(t);
  });

  it("is a NO-OP when the quote sits INSIDE an open accent run", () => {
    // Wrapping here would close the outer run in the wrong place and leak
    // `}}` into a sentence the student never touched.
    const t = "{{orange:So family is all.}} Thank you.";
    expect(emphasizeQuote(t, "family")).toBe(t);
  });

  it("refuses a quote that carries accent syntax of its own", () => {
    const t = "So {{orange:family}} is all.";
    expect(emphasizeQuote(t, "{{orange:family}}")).toBe(t);
    expect(emphasizeQuote(t, "family}}")).toBe(t);
  });

  it("handles regex-special characters literally", () => {
    expect(emphasizeQuote("Cost (net) rose.", "(net)"))
      .toBe("Cost {{orange:(net)}} rose.");
  });

  it("is a NO-OP on empty input rather than throwing", () => {
    expect(emphasizeQuote("", "x")).toBe("");
    expect(emphasizeQuote("text", "")).toBe("text");
    expect(emphasizeQuote(null, "x")).toBe("");
    expect(emphasizeQuote("text", null)).toBe("text");
    expect(emphasizeQuote(undefined, undefined)).toBe("");
  });

  it("accents a LATER quote when an earlier run is CLOSED", () => {
    // The tokens are asymmetric, so this cannot be a parity count the way
    // `**` was: the quote is in plain text when the last token before it is a
    // CLOSE, not when the open-count happens to be even.
    expect(emphasizeQuote("{{orange:One}} and two", "two"))
      .toBe("{{orange:One}} and {{orange:two}}");
  });

  it("leaves a BOLD run alone — it is a different mark", () => {
    // A proposed-accent bold in the text is not this function's business, and
    // it must not confuse the inside-a-run check.
    expect(emphasizeQuote("**One** and two", "two"))
      .toBe("**One** and {{orange:two}}");
  });
});
