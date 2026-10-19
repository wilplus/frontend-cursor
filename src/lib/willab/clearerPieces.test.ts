/*
 * STORY    As a speaker, I want the clearer version to mark only what changed,
 *          without inventing words, so that I can trust the rewrite.
 * OUTCOME
 *   O1  Without both sides nothing is drawn (null).
 *   O2  With both sides: shared words stay plain, words that go are cut,
 *       words that arrive are fresh, and each side joins back to its text.
 * PROVES   O1 -> "draws nothing without both sides"
 *          O2 -> "marks only the words that differ, and adds none"
 */
import { describe, expect, it } from "vitest";
import { clearerPieces } from "./clearerPieces";

const SAID = "We think the timing matters, because the window closes once the incumbents catch up with pricing.";
const OFFERED = "The window closes once the incumbents match our price.";

describe("clearerPieces", () => {
  it("draws nothing without both sides", () => {
    expect(clearerPieces(SAID, null)).toBeNull();
    expect(clearerPieces("", OFFERED)).toBeNull();
    expect(clearerPieces(SAID, "   ")).toBeNull();
  });

  it("marks only the words that differ, and adds none", () => {
    const pieces = clearerPieces("the window closes soon", "the window opens soon")!;
    expect(pieces.before).toEqual([
      { text: "the window " },
      { text: "closes", cut: true },
      { text: " soon" },
    ]);
    expect(pieces.after).toEqual([
      { text: "the window " },
      { text: "opens", fresh: true },
      { text: " soon" },
    ]);

    const real = clearerPieces(SAID, OFFERED)!;
    expect(real.before.map((p) => p.text).join("")).toBe(SAID);
    expect(real.after.map((p) => p.text).join("")).toBe(OFFERED);
    expect(real.after.filter((p) => !p.fresh).map((p) => p.text).join("")).toContain("window closes once the incumbents");
  });
});
