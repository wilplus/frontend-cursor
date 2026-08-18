import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const LAB = code("src/components/willab/LabOverlay.tsx");
const WAIT = code("src/components/willab/ProcessingWait.tsx");

describe("the processing-to-Ideal-Text journey", () => {
  it("opens Ideal Text automatically when processing finishes", () => {
    expect(LAB).toMatch(
      /state === "lab_processing" && processingReady && !uploadError[\s\S]*goTo\("readout"\)/
    );
    expect(LAB).not.toContain("View Ideal Text and feedback");
    expect(LAB).not.toContain("Your feedback is ready");
  });

  it("observes the document version before analysis completes", () => {
    expect(LAB).toMatch(
      /enabled:\s*state === "lab_processing" \|\| state === "readout"/
    );
  });

  it("keeps progress compact and shows one snap-paged tip at a time", () => {
    expect(WAIT).toMatch(/markSize = 44/);
    expect(WAIT).toMatch(/max-w-sm/);
    expect(WAIT).toMatch(/snap-y snap-mandatory scroll-smooth/);
    expect(WAIT).toMatch(/min-h-full snap-start snap-always/);
  });
});
