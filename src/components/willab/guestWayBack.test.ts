/* A GUEST'S WAY BACK TO THE TEXT (founder live test 2026-10-05). The
   recording bubble was saved without its project on a new deck, so it could
   not be tapped; and its tap opened the coach's feedback page, which needs an
   account. A guest gets no "your text is ready" bubble, so this bubble is the
   way back. Source pins: the Lounge and the Lab are too large to mount here. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  readFileSync(join(__dirname, file), "utf8");

describe("a guest's recording bubble", () => {
  it("is saved with the project the upload created", () => {
    const lab = read("LabOverlay.tsx");
    expect(lab.match(/appendRecordingSummary\(result\.sessionId, result\.arcId, projectId\)/g))
      .toHaveLength(3);
    expect(lab).toContain("arcId: takeArcId ?? uploadArcId ?? arcId ?? undefined");
  });

  it("opens the Ideal Text for a guest, the coach's page for an account", () => {
    const lounge = read("Lounge.tsx");
    expect(lounge).toMatch(
      /onOpenFeedback=\{\s*thread\.signedIn\s*\?\s*setFeedbackTarget\s*:\s*\(target\) => openIdealText\(target\.arcId\)\s*\}/,
    );
  });
});
