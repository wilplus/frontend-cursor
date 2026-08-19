import { describe, expect, it } from "vitest";
import { mapConfidencePractice } from "./confidentVoicePractice";
import { mapCoachConfidencePractice } from "./coachConfidencePractice";

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

describe("practice payload fences", () => {
  it("maps only qualitative attempt feedback on the user surface", () => {
    const mapped = mapConfidencePractice(userPractice);
    expect(mapped?.attempts[0].assessment).toContain("clearer");
    expect(mapped?.attempts[0]).not.toHaveProperty("acousticMetrics");
    expect(mapped?.attempts[0]).not.toHaveProperty("comparison");
    expect(JSON.stringify(mapped)).not.toContain("internal_strength");
    expect(JSON.stringify(mapped)).not.toContain('"wpm"');
  });

  it("keeps machine, user and professional coach decisions in distinct fields", () => {
    const coach = mapCoachConfidencePractice({
      id: "practice-1",
      exact_passage: "The exact same passage.",
      original_user_answer: "yes",
      final_user_answer: "no",
      professional_coach_decision: "refine",
      exercise: {
        exercise_id: "hear-every-word-v1",
        title: "Hear every word",
        instruction: "Read the same text again.",
      },
      attempts: [{
        id: "attempt-1",
        attempt_index: 1,
        audio_ref: "https://cdn.example/attempt.webm",
        duration_ms: 2200,
        is_selected: true,
        coach_confidence_decision: "yes",
        user_answer: "yes",
      }],
    });
    expect(coach?.originalUserAnswer).toBe("yes");
    expect(coach?.finalUserAnswer).toBe("no");
    expect(coach?.professionalCoachDecision).toBe("refine");
    expect(coach?.attempts[0].isSelected).toBe(true);
    expect(coach?.attempts[0].coachConfidenceDecision).toBe("yes");
  });
});
