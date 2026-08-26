import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lounge = readFileSync("src/components/willab/Lounge.tsx", "utf8");
const overlay = readFileSync(
  "src/components/willab/ProcessingResumeOverlay.tsx",
  "utf8",
);

describe("chat processing re-entry", () => {
  it("opens a presentation-only overlay for the exact persisted session", () => {
    expect(lounge).toMatch(/aria-haspopup="dialog"/);
    expect(lounge).toMatch(
      /setOpenedProcessingSessionId\(processingResume\.sessionId\)/,
    );
    expect(lounge).toMatch(
      /processingResume\?\.sessionId === openedProcessingSessionId/,
    );
    expect(lounge).toMatch(
      /<ProcessingResumeOverlay[\s\S]*?progress=\{processingResume\.progress\}[\s\S]*?cycleStartedAt=\{processingResume\.startedAt\}/,
    );
    expect(overlay).toContain("<ProcessingWait");
    expect(overlay).toContain("cycleStartedAt={cycleStartedAt}");
    const openAction = lounge.match(
      /onClick=\{\(\) =>[\s\S]*?setOpenedProcessingSessionId\(processingResume\.sessionId\)[\s\S]*?\}/,
    )?.[0];
    expect(openAction).toBeTruthy();
    expect(openAction).not.toContain('goTo("lab_processing")');
  });

  it("keeps lifecycle ownership in Lounge and never starts another job observer", () => {
    expect(lounge).toMatch(
      /!isLabOverlay\(state\)\s*\?\s*\(resumeWatch\?\.sessionId \?\? null\)\s*: null/,
    );
    expect(overlay).not.toContain("useLabReadoutLive");
    expect(overlay).not.toContain("useDocumentSettle");
    expect(overlay).not.toContain("submitLabRecording");
    expect(overlay).not.toContain("goTo(");
    expect(lounge).toContain("window.setInterval(syncMarker, 500)");
    expect(lounge).toContain('window.addEventListener("storage", syncMarker)');
  });

  it("closes with the shared Back behavior and restores focus without scrolling", () => {
    expect(overlay).toContain("useBackDismiss(onClose)");
    expect(lounge).toMatch(/focus\(\{ preventScroll: true \}\)/);
    expect(overlay).toContain("onKeyDown={keepFocusInside}");
    expect(overlay).toContain('event.key !== "Tab"');
  });
});
