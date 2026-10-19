/*
STORY    As a speaker practising Confident Voice, I want my practice judged in
         words after each attempt, never with machine numbers, and an unclear
         answer treated as none, so that I'm not mis-judged or scored.
OUTCOME
  O1  Each attempt reaches the screen with its words and is offered for my
      judgement; the machine's numbers (wpm, internal strength) never reach
      the mapped practice. Never-1: no score or number shown to a speaker.
  O2  An answer the screen does not know reads as no answer, never a guess;
      a known one is kept.
PROVES   O1 -> "keeps the words and drops the machine's numbers"
         O2 -> "reads an unknown answer as none rather than guessing"
WHY      Founder 2026-09-25: practice is judged after every attempt.
*/
import { describe, expect, it } from "vitest";
import { mapConfidencePractice } from "./confidentVoicePractice";

const attemptRow = {
  id: "attempt-1", attempt_index: 1,
  audio_ref: "https://cdn.example/attempt.webm", duration_ms: 2200,
  assessment: "This sounded clearer and less rushed.",
  is_strongest: true, kept: false, user_answer: null,
  acoustic_metrics: { wpm: 184 }, comparison: { internal_strength: 0.8 },
};

const userPractice = {
  id: "practice-1",
  status: "open",
  exercise: {
    exercise_id: "hear-every-word-v1",
    version: 1,
    title: "Hear every word",
    instruction: "Read the same text again.",
    explanation_video_ref: "https://cdn.example/video.mp4",
  },
  passage: "The exact same passage.",
  original_audio_ref: "https://cdn.example/original.webm",
  original_start_offset_ms: 120,
  original_duration_ms: 2400,
  attempts: [attemptRow],
  attempts_remaining: 2,
  strongest_attempt: attemptRow,
  judgeable_attempt_id: "attempt-1",
  final_ready: false,
  final_message: "This was your clearest attempt. Listen once more and decide for yourself.",
  final_question: "Does this take sound confident to you?",
};

describe("practice is judged in words after every attempt (founder 2026-09-25)", () => {

  it("keeps the words and drops the machine's numbers", () => {
    const mapped = mapConfidencePractice(userPractice);
    expect(mapped?.attempts[0].assessment).toBe("This sounded clearer and less rushed.");
    expect(mapped?.strongestAttempt?.assessment).toBe("This sounded clearer and less rushed.");
    expect(mapped?.judgeableAttemptId).toBe("attempt-1");
    const wire = JSON.stringify(mapped);
    expect(wire).not.toMatch(/wpm|internal_strength|acoustic|comparison/i);
    expect(wire).not.toContain("184");
    expect(wire).not.toContain("0.8");
  });

  it("reads an unknown answer as none rather than guessing", () => {
    const unknown = mapConfidencePractice({
      ...userPractice,
      judgeable_attempt_id: undefined,
      final_user_answer: "maybe",
    });
    expect(unknown?.finalUserAnswer).toBeNull();
    expect(unknown?.judgeableAttemptId).toBeNull();
    const known = mapConfidencePractice({ ...userPractice, final_user_answer: "in_between" });
    expect(known?.finalUserAnswer).toBe("in_between");
  });
});
