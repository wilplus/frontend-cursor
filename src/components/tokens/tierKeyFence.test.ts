import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* -------------------------------------------------------------------------- */
/*  THE TIER-KEY FENCE — a source grep, like corpusFence.test.ts               */
/*                                                                            */
/*  WHAT IT PREVENTS, from a real defect: TokenPlanCards used to carry         */
/*  `const LADDER = ["starter", "pro", "max"]` and filter the served tiers     */
/*  through it. The day the backend renames the sold ladder, that filter       */
/*  matches nothing, the component returns null, and the pricing page renders  */
/*  ZERO plan cards — silently, with no error anywhere.                        */
/*                                                                            */
/*  So: no component may name a tier. Card order comes from the served price   */
/*  (ascending), which is data, not a list of names. The next repricing must   */
/*  be a zero-FE-change event.                                                */
/* -------------------------------------------------------------------------- */

const GUARDED = ["TokenPlanCards.tsx", "TokenPlanChips.tsx"];

/** Every tier key that has ever been sold, plus the ones about to be. */
const TIER_KEYS = /\b(starter|pro|max|practice|coached|intensive)\b/;

function readIfPresent(file: string): string | null {
  try {
    return readFileSync(join(__dirname, file), "utf8");
  } catch {
    // Not every guarded file exists yet; the fence covers it the day it does.
    return null;
  }
}

describe("no component hardcodes a tier key", () => {
  for (const file of GUARDED) {
    it(`${file} names no tier`, () => {
      const src = readIfPresent(file);
      if (src === null) return;
      // Strip comments: prose may legitimately explain the history.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      const hit = code.match(TIER_KEYS);
      expect(
        hit,
        `${file} contains the tier key "${hit?.[0]}". Derive the ladder from ` +
          `the served tiers (usdPerMonth ascending) instead — a named ladder ` +
          `renders zero cards the day the BE renames a tier.`
      ).toBeNull();
    });
  }
});
