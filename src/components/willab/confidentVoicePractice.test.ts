import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const modal = read("src/components/willab/DeckChunkModal.tsx");
const practice = read("src/components/willab/ConfidentVoicePractice.tsx");
const lounge = read("src/components/willab/Lounge.tsx");
const api = read("src/services/api/confidentVoicePractice.ts");
const coach = read("src/components/willab/CoachConfidencePracticeReview.tsx");

describe("Confident Voice micro-practice journey fences", () => {
  it("stays hidden until the owner answers, then supports either answer", () => {
    expect(modal).toContain('suggestion?.feedbackFamily === "confident_voice"');
    expect(modal).toContain('!agreeSaved ?');
    expect(modal).toContain('agreeValue === "no" ?');
    expect(modal).toContain('<ConfidentVoicePractice');
    expect(modal).toContain('originalUserAnswer="no"');
    expect(modal).toContain('originalUserAnswer="yes"');
    expect(practice).toContain("offer.yesIntroduction");
    expect(practice).toContain("offer.noIntroduction");
    expect(practice).toContain("originalUserAnswer,");
  });

  it("keeps the exact passage visible and caps the session at three", () => {
    expect(practice).toContain("Read this exact passage");
    expect(practice).toContain("practice?.passage ?? offer.passage");
    expect(practice).toContain("of 3 attempts remaining");
    expect(practice).not.toContain("textarea");
    expect(practice).not.toContain("contentEditable");
  });

  it("can close locally without resolving or blocking the parent modal", () => {
    expect(practice).toMatch(/function closePractice\(\)[\s\S]*?mic\.cancel\(\);[\s\S]*?setView\("closed"\)/);
    expect(practice).toContain("Close practice");
    expect(practice).not.toContain("onLockIn");
    expect(practice).not.toContain("onCloseIdealText");
  });

  it("keeps all writes inside isolated practice endpoints", () => {
    expect(api).toContain("/confidence-practice");
    for (const forbidden of ["ideal-text", "flagship", "root-phrase", "voice-album", "styling"]) {
      expect(api).not.toContain(forbidden);
    }
  });

  it("renders coach follow-up only for an explicitly shared practice message", () => {
    expect(lounge).toContain('message.metadata?.note === "confidence_practice_shared"');
    expect(lounge).toContain("Open exercise");
    expect(lounge).toContain("<ConfidencePracticeOverlay");
  });

  it("lets the professional coach select a reviewed exercise or draft a new one", () => {
    expect(coach).toContain("Existing exercise");
    expect(coach).toContain("Create new exercise");
    expect(coach).toContain("Share with user");
    expect(coach).toContain('kind: "custom"');
    expect(coach).toContain("Does the selected practice recording sound confident?");
    expect(coach).toContain("selectedAttemptDecision");
  });
});
