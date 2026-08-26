import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
}

const LOADING = code("src/components/willab/LoadingState.tsx");
const PROCESSING = code("src/components/willab/ProcessingWait.tsx");
const ANALYSIS = code(
  "src/components/willab/RecordingAnalysisPresentation.tsx",
);
const OAUTH = code("src/app/auth/oauth-complete/page.tsx");

describe("the app-wide loading contract", () => {
  it("seals one mark-only 64px composition for generic waits", () => {
    expect(LOADING).toMatch(/<VoiceMark size=\{64\}/);
    expect(LOADING.match(/<VoiceMark size=\{64\}/g)).toHaveLength(2);
    expect(LOADING).toMatch(/placement: "viewport" \| "surface"/);
    expect(LOADING).toMatch(/min-h-full[\s\S]*self-stretch/);
    expect(LOADING).toMatch(/<span className="sr-only" role="status">/);
    expect(LOADING).not.toMatch(/While you wait/);
    expect(LOADING).not.toMatch(/role="progressbar"/);
    expect(LOADING).not.toMatch(/processingTipFrame|WAITING_TIPS/);
    expect(LOADING).not.toMatch(/fullscreen/);
    expect(LOADING).not.toMatch(/withTip/);
    expect(LOADING).not.toMatch(/VoiceMark size=\{96\}/);
    expect(LOADING).not.toMatch(/VoiceMark size=\{48\}/);
  });

  it("keeps recommendations and real progress exclusive to recording analysis", () => {
    expect(PROCESSING).toMatch(/<RecordingAnalysisPresentation/);
    expect(PROCESSING).toMatch(/percent=\{/);
    expect(ANALYSIS).toMatch(/max-w-\[34rem\]/);
    expect(ANALYSIS).toMatch(/pb-\[12vh\]/);
    expect(ANALYSIS).toMatch(/h-\[3px\]/);
    expect(ANALYSIS).toMatch(/While you wait/);
    expect(ANALYSIS).toMatch(/processingTipFrame/);
    expect(LOADING).not.toMatch(/RecordingAnalysisPresentation/);
    expect(LOADING).not.toMatch(/setInterval/);
  });

  it("has one semantic owner for real stage and progress announcements", () => {
    expect(ANALYSIS).toMatch(/role="progressbar"/);
    expect(ANALYSIS).toMatch(/aria-valuetext=/);
    expect(LOADING).toMatch(/role="status"/);
    expect(LOADING).not.toMatch(/aria-valuetext=/);
  });

  it("uses the canonical presentation for both OAuth wait paths", () => {
    expect(OAUTH).not.toMatch(/Loader2/);
    expect(
      OAUTH.match(
        /<LoadingState placement="viewport" label="Signing you in" \/>/g,
      ),
    ).toHaveLength(2);
    expect(OAUTH).toMatch(/role="alert"/);
  });

  it("keeps route fallbacks on the same viewport loader", () => {
    const routes = [
      "src/app/chat/loading.tsx",
      "src/app/game/loading.tsx",
      "src/app/panel/loading.tsx",
      "src/app/audits/loading.tsx",
      "src/app/coach/loading.tsx",
      "src/app/blog/loading.tsx",
      "src/app/(protected)/loading.tsx",
    ];
    for (const route of routes) {
      expect(code(route), route).toMatch(
        /<LoadingState placement="viewport" \/>/,
      );
    }
  });

  it("removes arbitrary marks and generic spinners from blocking surfaces", () => {
    const blockingSurfaces = [
      "src/app/audits/page.client.tsx",
      "src/app/coach/audit/[studentId]/page.client.tsx",
      "src/app/coach/compare/page.client.tsx",
      "src/app/coach/corpus/page.client.tsx",
      "src/app/coach/corpus/summary/[sessionId]/page.client.tsx",
      "src/components/willab/RaterLanguageGate.tsx",
      "src/components/willab/CoachReviewOverlay.tsx",
      "src/components/willab/CoachStarVerdictOverlay.tsx",
      "src/components/willab/ConfidencePracticeOverlay.tsx",
      "src/components/willab/LibraryOverlay.tsx",
      "src/components/willab/StudentDetailOverlay.tsx",
      "src/components/willab/StudentRosterOverlay.tsx",
      "src/components/willab/SendGate.tsx",
    ];
    for (const surface of blockingSurfaces) {
      const source = code(surface);
      expect(source, surface).not.toMatch(/VoiceMark size=\{(?:40|48|72|96)\}/);
    }
  });
});
