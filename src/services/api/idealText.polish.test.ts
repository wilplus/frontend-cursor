import { describe, expect, it } from "vitest";
import {
  isPolish,
  isUnappliedPolish,
  type IdealKeyMomentLink,
} from "./idealText";

const base = { anchor: "a", snippetId: "s", takeSessionId: "t" };

describe("polish predicates (Approve-all eligibility)", () => {
  it("accepts a grey polish replace star", () => {
    const m: IdealKeyMomentLink = {
      ...base,
      star: "suggestion",
      suggestion: { kind: "replace", replacement: "x", why: "", trigger: "polish", quote: null },
    };
    expect(isPolish(m)).toBe(true);
    expect(isUnappliedPolish(m)).toBe(true);
  });

  it("excludes a polish star the BE already folded", () => {
    const m: IdealKeyMomentLink = {
      ...base,
      star: "suggestion",
      applied: true,
      suggestion: { kind: "replace", replacement: "x", why: "", trigger: "polish", quote: null },
    };
    expect(isPolish(m)).toBe(true);
    expect(isUnappliedPolish(m)).toBe(false);
  });

  it("excludes non-polish replaces, emphasize, structural and verified stars", () => {
    // Acoustic and structural stars are judgment calls: strictly per-star, so
    // "Approve all" must never sweep them up.
    const cases: IdealKeyMomentLink[] = [
      {
        ...base,
        star: "suggestion",
        suggestion: { kind: "replace", replacement: "x", why: "w", trigger: null, quote: null },
      },
      {
        ...base,
        star: "suggestion",
        suggestion: { kind: "emphasize", replacement: null, why: "w", trigger: null, quote: null },
      },
      {
        ...base,
        star: "suggestion",
        suggestion: { kind: "structure", device: "contrast", quote: "q" },
      },
      {
        ...base,
        star: "verified",
        suggestion: { kind: "replace", replacement: "x", why: "", trigger: "polish", quote: null },
      },
      { ...base, star: null },
    ];
    for (const m of cases) expect(isPolish(m)).toBe(false);
  });
});
