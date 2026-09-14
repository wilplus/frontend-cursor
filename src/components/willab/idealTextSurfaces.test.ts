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

