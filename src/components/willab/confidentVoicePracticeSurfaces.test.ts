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
/* ConfidentVoicePractice.tsx is GONE (founder 2026-09-16, §3). It drew its own
   buttons, a passage screen and a per-attempt review — all three deleted by the
   ladder, which gives every screen ONE footer owned by the sheet. Its state
   machine is what was worth keeping and it moved to useConfidenceExercise.ts;
   the rendering moved into the sheet as step three. These fences follow it
   rather than lapse: what they pin is product rules, not a file. */
const exercise = read("src/components/willab/useConfidenceExercise.ts");
const lounge = read("src/components/willab/Lounge.tsx");
const api = read("src/services/api/confidentVoicePractice.ts");
const coach = read("src/components/willab/CoachConfidencePracticeReview.tsx");
const firstClient = read("src/components/willab/Mlc3FirstClientPractice.tsx");
const practiceFlow = read("src/components/willab/usePracticeFlow.ts");
const firstClientApi = read("src/services/api/mlc3FirstClient.ts");
const steps = read("src/lib/willab/chunkSteps.ts");

describe("Confident Voice micro-practice journey fences", () => {
  it("is its own step, offered on either answer", () => {
    // The lane predicate lives beside the ladder that sorts it first
    // (chunkSteps.ts, 2026-09-15), so the ordering rule and the card's own
    // render read the SAME definition. Still one definition, not here.
    expect(steps).toContain('item.feedbackFamily === "confident_voice"');
    expect(steps).toContain('item.source === "confident_voice"');
    expect(modal).toContain("isConfidentVoiceFeedback(suggestion)");
    // The exercise is a STEP now, not a card nested under the answered
    // confidence screen — so the ladder has to be able to produce one.
    expect(steps).toContain('steps.push({ kind: "exercise", id: "exercise" })');
    expect(modal).toContain('step.kind === "exercise"');
    // Offered on a Yes and on a No alike: the practice is matched to the clip,
    // not awarded for a verdict. Only the introduction copy differs.
    expect(modal).toContain('originalUserAnswer: judgement === "yes" ? "yes" : "no"');
  });

  it("never resumes a judged attempt — Practise again records a new one", () => {
    // The defect this replaced: begin() did
    //     setView(opened.finalReady ? "final" : "practice")
    // so once an attempt was judged-ready, Practise took the speaker BACK to
    // the judgement they had just walked away from, and offer.resume did the
    // same on mount. Recording is now the only thing the pill does.
    expect(exercise).toContain("setRecording(true)");
    expect(exercise).toMatch(/const practise = useCallback\(\(\) => \{[\s\S]*?void mic\.start\(\)/);
    expect(code(exercise)).not.toContain("finalReady ? \"judgement\" : \"offer\"");
    expect(code(exercise)).not.toContain("offer.resume");
    // Attempts stay capped, and Practise again is what spends one.
    expect(exercise).toContain("attemptsRemaining");
  });

  it("closes the practice row so a declined exercise does not return", () => {
    // "Not now" is a decision, not a deferral: it closes the row server-side.
    expect(exercise).toContain('finishConfidencePractice(opened.id, { action: "dismiss" })');
    // Done answers it with the attempt the SERVER chose, never a local pick.
    expect(exercise).toContain("const strongest = practice?.strongestAttempt");
    expect(exercise).toContain("attempt_id: strongest.id");
    expect(exercise).not.toContain("onLockIn");
    expect(exercise).not.toContain("onCloseIdealText");
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
    // Relabelled 2026-09-16 (founder). The capabilities are unchanged; the
    // WORDS changed because "Create new exercise" sounded like it added to the
    // library and does not — it makes a one-off welded to this recording,
    // which can never reach a second speaker. "Just for them" says so.
    expect(coach).toContain("From the library");
    expect(coach).toContain("Just for them");
    // And the third door, which is the one that really does add to the
    // catalogue: straight into the exercise lane, skipping the fork.
    expect(coach).toContain("Add to the library");
    expect(coach).toContain('href="/cms/new/exercise/1"');
    expect(coach).toContain("Share with user");
    expect(coach).toContain('kind: "custom"');
    expect(coach).toContain("Does the practice recording sound better than the original?");
    expect(coach).toContain("selectedAttemptDecision");
  });

  it("keeps unresolved capture bytes and identity until exact replay succeeds", () => {
    expect(practiceFlow).toContain("const captureId = freshId()");
    expect(practiceFlow).toContain("capture.idempotencyKey");
    expect(practiceFlow).toContain("capture.audio ??= audio");
    expect(practiceFlow).toContain("setRetryPending(true)");
    expect(firstClient).toContain('"Retry saving"');
    expect(practiceFlow).toContain("if (activeCapture.current)");
    expect(practiceFlow).not.toContain("nextAttemptIndex");
    expect(practiceFlow).not.toContain("const attemptIndex = attempts.length + 1");
    expect(firstClientApi).not.toContain('form.append("attempt_index"');
    expect(firstClientApi).toContain('form.append("capture_completed_at", captureCompletedAt)');
    expect(firstClientApi).not.toContain(
      'form.append("capture_completed_at", new Date().toISOString())',
    );
  });

  it("requires an explicit self-voice action for each comparison recording", () => {
    expect(firstClient).toContain("Is this your voice in this recording?");
    expect(firstClient).toContain("Yes, this is my voice");
    expect(firstClient).toContain("Not sure or someone else");
    expect(firstClient).toContain("It is not a confidence score");
    expect(practiceFlow).toContain("confirmSourceSelfSpeaker");
    expect(practiceFlow).toContain("confirmPracticeSelfSpeaker");
    expect(practiceFlow).toContain('setSourceSpeakerState("declined")');
    expect(practiceFlow).toContain("speakerConfirmationRequired");
    expect(firstClientApi).toContain('assertion: "this_is_my_voice"');
    expect(firstClientApi).not.toContain('assertion: "not_my_voice"');
  });
});
