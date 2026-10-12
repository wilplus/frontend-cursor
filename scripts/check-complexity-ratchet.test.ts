/**
 * The complexity ratchet (audit Q-C7): no function under src/ exceeds CC 25
 * unless it is frozen in scripts/complexity-baseline.json, and a frozen one
 * may only come down. The live run is the unit job's "Complexity ratchet"
 * step (`npm run check:complexity`); these tests pin the rule.
 */

import { describe, expect, it } from "vitest";
import {
  check,
} from "./check-complexity-ratchet.mjs";

describe("the complexity ratchet", () => {

  it("fails a new offender and lets a frozen one only come down", () => {
    const measures = new Map([
      ["src/a.tsx:Function 'f'", 30],
      ["src/a.tsx:Function 'g'", 3],
    ]);
    expect(check(measures, {})).toEqual([
      "src/a.tsx:Function 'f': CC 30 > 25 and not grandfathered. Split it.",
    ]);
    expect(check(measures, { "src/a.tsx:Function 'f'": 30 })).toEqual([]);
    expect(check(measures, { "src/a.tsx:Function 'f'": 40 })).toEqual([]);
    expect(check(measures, { "src/a.tsx:Function 'f'": 29 })[0]).toContain("grew 29 → 30");
  });

  it("requires a stale baseline entry to be re-frozen", () => {
    const measures = new Map([["src/a.tsx:Function 'f'", 10]]);
    const problems = check(measures, {
      "src/a.tsx:Function 'f'": 30,
      "src/a.tsx:Function 'gone'": 30,
    });
    expect(problems).toHaveLength(2);
    for (const p of problems) expect(p).toContain("--update");
  });
});
