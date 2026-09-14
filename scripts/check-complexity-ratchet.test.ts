/**
 * The complexity ratchet (audit Q-C7): no function under src/ exceeds CC 25
 * unless it is frozen in scripts/complexity-baseline.json, and a frozen one
 * may only come down. The live run is the unit job's "Complexity ratchet"
 * step (`npm run check:complexity`); these tests pin the rule.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BASELINE_PATH,
  THRESHOLD,
  check,
  frozenFrom,
  measuresFrom,
} from "./check-complexity-ratchet.mjs";

function result(filePath: string, messages: Array<[string, number] | string>) {
  return {
    filePath,
    messages: messages.map((m) =>
      typeof m === "string"
        ? { ruleId: "other", message: m }
        : { ruleId: "complexity", message: `${m[0]} has a complexity of ${m[1]}. Maximum allowed is 1.` },
    ),
  };
}

describe("the complexity ratchet", () => {
  it("is set at the decided threshold", () => {
    expect(THRESHOLD).toBe(25);
  });

  it("only freezes functions over the threshold, sorted by key", () => {
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, number>;
    const keys = Object.keys(baseline);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toEqual([...keys].sort());
    for (const key of keys) {
      expect(baseline[key]).toBeGreaterThan(THRESHOLD);
      expect(key.startsWith("src/")).toBe(true);
    }
  });

  it("keys named functions by name and anonymous ones by kind and ordinal", () => {
    const measures = measuresFrom(
      [
        result("/repo/src/a.tsx", [
          ["Function 'Page'", 30],
          ["Arrow function", 3],
          ["Arrow function", 27],
          ["Async arrow function", 4],
          "some other rule",
        ]),
      ],
      "/repo",
    );
    expect(Object.fromEntries(measures)).toEqual({
      "src/a.tsx:Function 'Page'": 30,
      "src/a.tsx:Arrow function#1": 3,
      "src/a.tsx:Arrow function#2": 27,
      "src/a.tsx:Async arrow function#1": 4,
    });
  });

  it("two named functions sharing a key keep the larger value", () => {
    const measures = measuresFrom(
      [result("/repo/src/a.tsx", [["Function 'onClick'", 2], ["Function 'onClick'", 9]])],
      "/repo",
    );
    expect(measures.get("src/a.tsx:Function 'onClick'")).toBe(9);
  });

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

  it("freezes exactly the over-threshold set", () => {
    const measures = new Map([
      ["src/b.tsx:Function 'x'", 26],
      ["src/a.tsx:Function 'y'", 25],
    ]);
    expect(frozenFrom(measures)).toEqual({ "src/b.tsx:Function 'x'": 26 });
  });
});
