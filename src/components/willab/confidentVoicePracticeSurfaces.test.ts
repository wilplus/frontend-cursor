import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
/** Source with comments removed. A fence that asserts something is ABSENT must
 *  read code, not prose: these modules explain what they deleted and why, so a
 *  raw `not.toContain` fails on the sentence describing the removal. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const modal = read("src/components/willab/DeckChunkModal.tsx");
/* The sheet's own practise step and its state machine (useConfidenceExercise)
   are GONE (founder 2026-10-10, "the practise screens should be the same in
   all cases"): every practise is the Feedback walk's (walkPractise.test.tsx). */
const walk = read("src/components/willab/useDeckFeedbackWalk.tsx");
const lounge = read("src/components/willab/Lounge.tsx");
const api = read("src/services/api/confidentVoicePractice.ts");
const steps = read("src/lib/willab/chunkSteps.ts");

describe("Confident Voice micro-practice journey fences", () => {
  it("reads one Confident Voice lane, and practises only in the walk", () => {
    // The lane predicate lives beside the ladder that sorts it first
    // (chunkSteps.ts, 2026-09-15), so the ordering rule and the card's own
    // render read the SAME definition. Still one definition, not here.
    expect(steps).toContain('item.feedbackFamily === "confident_voice"');
    expect(steps).toContain('item.source === "confident_voice"');
    expect(modal).toContain("isConfidentVoiceFeedback(suggestion)");
    // The judgement sheet records nothing of a practise any more.
    expect(code(modal)).not.toContain("useConfidenceExercise");
    expect(code(modal)).not.toContain("PracticeRecordingView");
    // The paragraph's practise opens the walk's practise screens.
    expect(walk).toContain("export function paragraphPractise(");
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
});
