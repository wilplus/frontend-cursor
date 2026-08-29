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
const HELPERS = code("src/components/willab/willabHelpers.ts");
const WAIT = code("src/components/willab/ProcessingWait.tsx");
const LOADING = code("src/components/willab/LoadingState.tsx");
const ANALYSIS = code(
  "src/components/willab/RecordingAnalysisPresentation.tsx",
);
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
    expect(LOUNGE).toMatch(
      /onSettled:\s*\(take\)[\s\S]*openIdealText\(take\.arcId, "notebook"\)/,
    );
  });

  it("observes the document version before analysis completes", () => {
    expect(LAB).toMatch(
      /enabled:\s*state === "lab_processing" \|\| state === "readout"/,
    );
  });

  it("every spoken take settles its exact Ideal Text review version", () => {
    for (const owner of [LAB, LOUNGE]) {
      expect(owner).toMatch(/transitionProcessingTakeToDocument\(/);
      expect(owner).not.toMatch(/processingTakeKeepsIdealText\(/);
      expect(owner).not.toMatch(/takeProcessedDraft\(\{/);
    }
    expect(LAB).toMatch(/waitsForReview[\s\S]*phase: "document"/);
    expect(LAB).toMatch(
      /completedTake\.arcId[\s\S]*transitionProcessingTakeToDocument/,
    );
  });

  it("retires the obsolete kept-unchanged card from persisted history", () => {
    expect(REPORT).not.toContain('variant === "take_processed"');
    expect(HELPERS).toMatch(
      /message\.kind === "ideal_text"[\s\S]*variant === "take_processed"/,
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
    expect(WAIT).toMatch(/<RecordingAnalysisPresentation/);
    expect(WAIT).toMatch(/label=\{PROCESSING_STAGES\[current\]\}/);
    expect(LOADING).toMatch(/<VoiceMark size=\{64\}/);
    expect(LOADING).not.toMatch(/While you wait|role="progressbar"/);
    expect(ANALYSIS).toMatch(/max-w-\[34rem\]/);
    expect(ANALYSIS).toMatch(/pb-\[12vh\]/);
    expect(ANALYSIS).toMatch(/h-\[3px\]/);
    expect(ANALYSIS).toMatch(/duration-700 ease-out/);
    expect(ANALYSIS).toMatch(/text-\[clamp\(1\.45rem,5\.2vw,2\.05rem\)\]/);
    expect(ANALYSIS).toMatch(/leading-\[1\.28\]/);
    expect(ANALYSIS).toMatch(/tracking-\[-0\.015em\]/);
    expect(ANALYSIS).toMatch(/text-balance/);
    expect(TIP_CYCLE).toMatch(/TIP_VISIBLE_MS = 7_000/);
    expect(TIP_CYCLE).toMatch(/TIP_FADE_MS = 420/);
    expect(ANALYSIS).toMatch(/aria-live="polite"/);
    expect(ANALYSIS).toMatch(/prefers-reduced-motion: reduce/);
    expect(ANALYSIS).toMatch(/percent === null \? "…"/);
    expect(ANALYSIS).toMatch(
      /aria-busy=\{percent === null \? true : undefined\}/,
    );
    expect(WAIT).not.toMatch(/markSize/);
    expect(ANALYSIS).not.toMatch(/snap-mandatory/);
  });
});
