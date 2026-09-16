import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (name: string) =>
  readFileSync(join(process.cwd(), "src", "components", "willab", name), "utf8");

describe("Ideal Text core-first screen contract", () => {
  for (const file of ["IdealTextOverlay.tsx", "IdealTextReadout.tsx"]) {
    it(`${file} paints core before requesting enrichment`, () => {
      const code = source(file);
      expect(code).toContain("fetchIdealTextCore");
      expect(code).toContain("fetchIdealTextEnrichment");
      expect(code.indexOf("applySingle(r, true)")).toBeLessThan(
        code.indexOf("await fetchIdealTextEnrichment"),
      );
      expect(code).toContain("mergeIdealTextEnrichment");
    });
  }

  it("the processing settle probe uses the strict core read", () => {
    const code = source("useDocumentSettle.ts");
    expect(code).toContain("fetchIdealTextCore");
    expect(code).not.toContain("fetchIdealText(");
  });
});


describe("the loop never waits for a coach", () => {
  /** Source with comments stripped: this screen explains at length why the
   *  dead end was one, and a fence that asserts absence must read code. */
  const code = (name: string) =>
    source(name)
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");

  it("offers a way to record while the ideal text is unapproved", () => {
    // Tapping Record on a project whose ideal text is not yet approved landed
    // here, and it rendered one sentence and NOTHING else. The user had asked
    // to record and could not, until a human acted — the live-loop fence, not
    // a rough edge.
    const screen = code("IdealTextPendingCoach.tsx");
    expect(screen).toContain("still shaping your ideal text");
    expect(screen).toContain("onReadAloud(null)");
    expect(screen).toContain("Record the next take");
    // And the overlay actually mounts it on that branch.
    expect(code("IdealTextOverlay.tsx")).toContain(
      "<IdealTextPendingCoach onReadAloud={onReadAloud} />",
    );
  });

  it("uses the SAME callback the ready state uses, not a second lane", () => {
    // onReadAloud is what IdealTextActions calls on the ready screen, so a
    // take started from the pending screen goes through the identical
    // submission path. A separate entry point here could drift from it.
    expect(code("IdealTextOverlay.tsx")).toContain(
      "onNewTake={() => onReadAloud(sd.version)}",
    );
    expect(code("IdealTextPendingCoach.tsx")).toContain(
      "onClick={() => onReadAloud(null)}",
    );
  });

  it("does not touch the pending document or surface coach state", () => {
    const screen = code("IdealTextPendingCoach.tsx");
    // L1: the coach's unapproved document is not read, rebuilt or edited here.
    expect(screen).not.toContain("setDraft");
    expect(screen).not.toContain("onLockIn");
    // BLIND COACH: the screen takes ONE prop and it is the way out. It cannot
    // surface a verdict, a guess or a review state because it is never handed
    // one. (Asserting the word "approved" is absent would be wrong — the
    // signed-off sentence itself says "the moment it's approved".)
    expect(screen).not.toContain("reviewStatus");
    expect(screen).toMatch(/\}: \{\s*onReadAloud\?: \(version: number \| null\) => void;\s*\}/);
  });
});
