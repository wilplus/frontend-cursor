import { describe, expect, it } from "vitest";
import { mapConfidencePractice } from "./confidentVoicePractice";

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
  attempts: [{
    id: "attempt-1", attempt_index: 1,
    audio_ref: "https://cdn.example/attempt.webm", duration_ms: 2200,
    assessment: "This sounded clearer and less rushed.",
    is_strongest: true, kept: false, user_answer: null,
    acoustic_metrics: { wpm: 184 }, comparison: { internal_strength: 0.8 },
  }],
  attempts_remaining: 2,
  strongest_attempt: {
    id: "attempt-1", attempt_index: 1,
    audio_ref: "https://cdn.example/attempt.webm", duration_ms: 2200,
    assessment: "This sounded clearer and less rushed.",
    is_strongest: true, kept: false, user_answer: null,
  },
  final_ready: false,
  final_message: "This was your clearest attempt. Listen once more and decide for yourself.",
  final_question: "Does this take sound confident to you?",
};

describe("practice is judged after every attempt (founder 2026-09-25)", () => {
  it("keeps all five answers and names the attempt to judge", () => {
    const mapped = mapConfidencePractice({
      ...userPractice,
      attempts: [
        { ...userPractice.attempts[0], user_answer: "not_sure" },
        {
          ...userPractice.attempts[0],
          id: "attempt-2",
          attempt_index: 2,
          user_answer: null,
        },
      ],
      final_user_answer: "in_between",
      judgeable_attempt_id: "attempt-2",
    });
    expect(mapped?.attempts[0].userAnswer).toBe("not_sure");
    expect(mapped?.finalUserAnswer).toBe("in_between");
    expect(mapped?.judgeableAttemptId).toBe("attempt-2");
  });

  it("reads an unknown answer as none rather than guessing", () => {
    const mapped = mapConfidencePractice({
      ...userPractice,
      final_user_answer: "maybe",
    });
    expect(mapped?.finalUserAnswer).toBeNull();
    expect(mapped?.judgeableAttemptId).toBeNull();
  });
});
