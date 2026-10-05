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

describe("a guest's \"your text is ready\" bubble (founder 2026-10-05)", () => {
  it("is the server's ready bubble: same kind, words and metadata", async () => {
    const { idealTextReadyDraft, IDEAL_TEXT_READY_BODY } = await import("./loungeReports");
    expect(IDEAL_TEXT_READY_BODY).toBe("Your ideal text is ready.");
    expect(idealTextReadyDraft({ arcId: "arc-1", version: 1, topic: "Pitch" })).toEqual({
      role: "bot",
      kind: "ideal_text",
      body: "Your ideal text is ready.",
      metadata: { arc_id: "arc-1", variant: "ready", version: 1, topic: "Pitch" },
    });
  });

  it("is posted for a guest when the text settles, in the Lab and in the Lounge", () => {
    const lab = read("LabOverlay.tsx");
    expect(lab).toMatch(/onSettled: \(take\) => \{\s*if \(signedIn === false && take\.arcId\) \{\s*void appendToThread\(idealTextReadyDraft\(/);
    const lounge = read("Lounge.tsx");
    expect(lounge).toMatch(/if \(!thread\.signedIn && take\.arcId\) \{\s*void thread\.append\(idealTextReadyDraft\(/);
  });

  it("matches the backend's wording", () => {
    const backend = "Your ideal text is ready.";
    expect(read("loungeReports.ts")).toContain(`"${backend}"`);
  });
});
