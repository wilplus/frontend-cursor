import { describe, expect, it } from "vitest";
import { clearerPieces } from "./clearerPieces";

/* The clearer version's words (build plan D-FW-15): the served pair, with
   only what differs marked, and nothing added or reworded. */

const SAID = "We think the timing matters, because the window closes once the incumbents catch up with pricing.";
const OFFERED = "The window closes once the incumbents match our price.";
const join = (list: { text: string }[]) => list.map((p) => p.text).join("");

describe("clearerPieces", () => {
  it("crosses out what goes and marks what arrives, as the locked prototype draws it", () => {
    expect(clearerPieces(SAID, OFFERED)).toEqual({
      before: [
        { text: "We think the timing matters, because the", cut: true },
        { text: " window closes once the incumbents " },
        { text: "catch up with pricing", cut: true },
        { text: "." },
      ],
      after: [
        { text: "The", fresh: true },
        { text: " window closes once the incumbents " },
        { text: "match our price", fresh: true },
        { text: "." },
      ],
    });
  });

  it("joins back into the served words exactly", () => {
    const pieces = clearerPieces(`  ${SAID} `, OFFERED)!;
    expect(join(pieces.before)).toBe(SAID);
    expect(join(pieces.after)).toBe(OFFERED);
  });

  it("marks the whole span when nothing is shared", () => {
    expect(clearerPieces("So basically yes", "Yes.")).toEqual({
      before: [{ text: "So basically yes", cut: true }],
      after: [{ text: "Yes.", fresh: true }],
    });
  });

  it("draws nothing without both sides (nothing is made up)", () => {
    expect(clearerPieces(SAID, null)).toBeNull();
    expect(clearerPieces("", OFFERED)).toBeNull();
    expect(clearerPieces(SAID, "   ")).toBeNull();
  });

  it("marks the whole span past the size it compares", () => {
    const long = Array.from({ length: 300 }, (_, i) => `w${i}`).join(" ");
    const pieces = clearerPieces(long, `${long} more`)!;
    expect(pieces.before).toEqual([{ text: long, cut: true }]);
    expect(pieces.after).toEqual([{ text: `${long} more`, fresh: true }]);
  });
});
