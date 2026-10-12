import { describe, expect, it } from "vitest";
import { FLOW_COPY } from "./flowCopy";

/* -------------------------------------------------------------------------- */
/*  The sequencing copy is fence-bearing, so it gets a fence-bearing test.      */
/*                                                                            */
/*  Two rules, both from docs/ideal-text-flow-communication.md:                */
/*                                                                            */
/*   * AC-9 — no scores, verdicts, counters or percentages reach the user.     */
/*     This is where they would leak: a waiting state is exactly the place     */
/*     someone reaches for "3 of 8 slides" or "37%" to feel helpful. The       */
/*     research says that backfires anyway (an accurate indicator drives       */
/*     people AWAY when the early news is discouraging), so the fence and the  */
/*     usability finding point the same direction.                            */
/*                                                                            */
/*   * The founder's length rule — "the communicates should not be too long".  */
/*     One line of state, one of what's next; never a third sentence.          */
/* -------------------------------------------------------------------------- */

const ALL = Object.entries(FLOW_COPY);

describe("FLOW_COPY — AC-9: the read stays qualitative", () => {
  it("never surfaces a number, a count, a percentage or a fraction", () => {
    for (const [key, line] of ALL) {
      expect(line, `${key}: digits leaked`).not.toMatch(/\d/);
      expect(line, `${key}: percentage leaked`).not.toContain("%");
      // "take 2 of 3" — the counter shape, spelled out or not.
      expect(line, `${key}: counter shape leaked`).not.toMatch(
        /\b(one|two|three|four|five)\s+of\s+/i
      );
    }
  });
});
