import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const LAB = code("src/components/willab/LabOverlay.tsx");
const LOUNGE = code("src/components/willab/Lounge.tsx");
const REPORT = code("src/components/willab/ReportCard.tsx");
const WAIT = code("src/components/willab/ProcessingWait.tsx");
const LOADING = code("src/components/willab/LoadingState.tsx");
const TIP_CYCLE = code("src/components/willab/processingTipCycle.ts");
const EVENTS = code(
  "src/app/api/v2/lab/recordings/[sessionId]/events/route.ts",
);

describe("the processing-to-Ideal-Text journey", () => {
  it("opens Ideal Text automatically when processing finishes", () => {
    expect(LAB).toMatch(
      /state === "lab_processing" && processingReady && !uploadError[\s\S]*goTo\("readout"\)/,
    );
    expect(LAB).not.toContain("View Ideal Text and feedback");
    expect(LAB).not.toContain("Your feedback is ready");
  });

  it("observes the document version before analysis completes", () => {
    expect(LAB).toMatch(
      /enabled:\s*state === "lab_processing" \|\| state === "readout"/,
    );
  });

  it("later takes finish per session instead of waiting for a forbidden version bump", () => {
    for (const owner of [LAB, LOUNGE]) {
      expect(owner).toMatch(/processingTakeKeepsIdealText\(/);
      expect(owner).toMatch(/takeProcessedDraft\(\{/);
      expect(owner).toMatch(/clearProcessingTake\(/);
      expect(owner).toMatch(/transitionProcessingTakeToDocument\(/);
    }
    // Lab owns two transport completions: synchronous 201 and background-job
    // terminal. Both must append through the same result abstraction.
    expect(
      LAB.match(/void appendToThread\(\s*takeProcessedDraft\(\{/g),
    ).toHaveLength(2);
  });

  it("replaces the working bubble with the approved two-action terminal card", () => {
    expect(REPORT).toContain('variant === "take_processed"');
    expect(REPORT).toContain("Open your Ideal Text");
    expect(REPORT).toContain("View this take&apos;s feedback");
    expect(REPORT).toMatch(
      /onOpenFeedback!\(\{[\s\S]*takeSessionId,[\s\S]*takeIndex/,
    );
  });

  it("never clears an unconfirmed Take 1 as success and offers artifact-only retry", () => {
    expect(REPORT).toContain('variant === "ideal_text_unconfirmed"');
    expect(REPORT).toContain("Try creating it again");
    expect(REPORT).toContain("View this take&apos;s feedback");
    expect(LOUNGE).toContain("retryIdealTextGeneration");
    expect(LOUNGE).toContain('r.state === "failed_ideal_text_unconfirmed"');
    expect(LAB).toContain('r.state === "failed_ideal_text_unconfirmed"');
    expect(EVENTS).toMatch(
      /TERMINAL_STATES[\s\S]*"failed_ideal_text_unconfirmed"/,
    );
  });

  it("uses the sealed, proportional processing hero", () => {
    expect(WAIT).toMatch(/<LoadingPresentation/);
    expect(WAIT).toMatch(/label=\{PROCESSING_STAGES\[current\]\}/);
    expect(LOADING).toMatch(/<VoiceMark size=\{64\}/);
    expect(LOADING).toMatch(/max-w-\[34rem\]/);
    expect(LOADING).toMatch(/pb-\[12vh\]/);
    expect(LOADING).toMatch(/h-\[3px\]/);
    expect(LOADING).toMatch(/duration-700 ease-out/);
    expect(LOADING).toMatch(/text-\[clamp\(1\.45rem,5\.2vw,2\.05rem\)\]/);
    expect(LOADING).toMatch(/leading-\[1\.28\]/);
    expect(LOADING).toMatch(/tracking-\[-0\.015em\]/);
    expect(LOADING).toMatch(/text-balance/);
    expect(TIP_CYCLE).toMatch(/TIP_VISIBLE_MS = 7_000/);
    expect(TIP_CYCLE).toMatch(/TIP_FADE_MS = 420/);
    expect(LOADING).toMatch(/aria-live="polite"/);
    expect(LOADING).toMatch(/prefers-reduced-motion: reduce/);
    expect(LOADING).toMatch(/percent === null \? "…"/);
    expect(LOADING).toMatch(
      /aria-busy=\{percent === null \? true : undefined\}/,
    );
    expect(WAIT).not.toMatch(/markSize/);
    expect(LOADING).not.toMatch(/snap-mandatory/);
  });
});
