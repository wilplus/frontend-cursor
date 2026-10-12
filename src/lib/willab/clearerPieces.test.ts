import { describe, expect, it } from "vitest";
import { clearerPieces } from "./clearerPieces";

/* The clearer version's words (build plan D-FW-15): the served pair, with
   only what differs marked, and nothing added or reworded. */

const SAID = "We think the timing matters, because the window closes once the incumbents catch up with pricing.";
const OFFERED = "The window closes once the incumbents match our price.";

describe("clearerPieces", () => {

  it("draws nothing without both sides (nothing is made up)", () => {
    expect(clearerPieces(SAID, null)).toBeNull();
    expect(clearerPieces("", OFFERED)).toBeNull();
    expect(clearerPieces(SAID, "   ")).toBeNull();
  });
});
