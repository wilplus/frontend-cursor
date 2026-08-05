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

  it("never promises a duration we would only be guessing at", () => {
    for (const [key, line] of ALL) {
      expect(line, `${key}: time estimate leaked`).not.toMatch(
        /\b(minute|second|hour|soon as|about a)\b/i
      );
    }
  });
});

describe("FLOW_COPY — the founder's length rule", () => {
  it("keeps every line to a single sentence", () => {
    for (const [key, line] of ALL) {
      // Sentence-enders that are followed by more words. The em-dash and the
      // comma are fine — they hold ONE thought together, which is the point.
      const sentences = line
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.trim().length > 0);
      expect(sentences.length, `${key}: more than one sentence`).toBe(1);
    }
  });

  it("keeps every line short enough to read at a glance", () => {
    for (const [key, line] of ALL) {
      expect(line.length, `${key}: too long to land`).toBeLessThanOrEqual(80);
    }
  });
});

describe("FLOW_COPY — the retired nudge stays retired", () => {
  it("never re-introduces the three-takes line the founder cut", () => {
    // "not text that it really lands on the 3rd time; on the bubble never"
    for (const [key, line] of ALL) {
      expect(line.toLowerCase(), `${key}: the nudge came back`).not.toContain(
        "really lands"
      );
      expect(line.toLowerCase(), `${key}: the nudge came back`).not.toContain(
        "more takes"
      );
    }
  });
});

describe("FLOW_COPY — nobody is left with nothing to do", () => {
  it("pairs every waiting/failure state with a what-next line", () => {
    // The states that strand a user are the ones where they cannot act. Each
    // must ship with its follow-up, or the screen is a dead end.
    expect(FLOW_COPY.analysingNext.trim().length).toBeGreaterThan(0);
    expect(FLOW_COPY.failedNext.trim().length).toBeGreaterThan(0);
  });

  it("bounds the damage on failure before offering the retry", () => {
    // The real fear on a failed take is "did I lose everything". Say no first.
    expect(FLOW_COPY.failedNext.toLowerCase()).toContain("safe");
  });
});
