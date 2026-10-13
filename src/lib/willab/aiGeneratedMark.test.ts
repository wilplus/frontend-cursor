import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AI_GENERATED_LABEL,
} from "./aiGeneratedMark";

describe("AC-9 holds at the label", () => {
  it("states provenance and never a score, rating, band or verdict", () => {
    for (const label of Object.values(AI_GENERATED_LABEL)) {
      expect(label).toMatch(/AI-generated|Written by AI/);
      // No digits in the words themselves: a number on this label is the AC-9
      // breach, whatever it would be counting. The one number the Ideal Text
      // caption carries is the Take it names (below).
      expect(label).not.toMatch(/\d/);
      expect(label.toLowerCase()).not.toMatch(
        /score|rating|grade|rank|percent|confidence level|out of/,
      );
    }
  });
});

describe("Article 50(2) — every surface that shows generated text is marked", () => {
  const src = (...parts: string[]) =>
    readFileSync(join(process.cwd(), "src", ...parts), "utf8");

  it("both Ideal Text mounts carry the mark and the marked copy", () => {
    for (const file of ["IdealTextOverlay.tsx", "IdealTextReadout.tsx"]) {
      const code = src("components", "willab", file);
      expect(code, `${file} container attrs`).toContain('aiGeneratedAttrs("ideal-text")');
      expect(code, `${file} visible note`).toContain('<AiGeneratedNote kind="ideal-text"');
      // The caption names the Take shown (N48.3 Q8 A).
      expect(code, `${file} caption take`).toContain("take={sd?.takeCount}");
      // The unmarked copy path is what this replaces; it must not come back.
      expect(code, `${file} raw writeText`).not.toContain("clipboard\n        ?.writeText");
    }
    // The readout's ⋯ lives in its own file.
    for (const file of ["IdealTextOverlay.tsx", "ReadoutMenu.tsx"]) {
      const code = src("components", "willab", file);
      expect(code, `${file} marked copy`).toContain("copyAiGeneratedText(");
    }
  });
});
