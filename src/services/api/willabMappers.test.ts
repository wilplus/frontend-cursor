import { describe, expect, it } from "vitest";
import { mapCoachReviewSession } from "./coachReview";

describe("mapCoachReviewSession — features (C1 / §B.1)", () => {
  it("parses the per-snippet acoustic vector (snake→camel, mean_pause_seconds → meanPause)", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        {
          id: "n1",
          features: {
            f0_mean: 180,
            f0_sd: 30,
            speech_rate: 150,
            mean_pause_seconds: 0.4,
            pause_ratio: 0.3,
            loudness_range: 14,
            voiced_ratio: 0.7,
            f0_slope: -2,
            pause_regularity: 0.6,
            intensity_envelope: 0.5,
            f0_mid_end_delta: -8,
          },
        },
      ],
    });
    expect(s?.snippets[0].features).toEqual({
      f0Mean: 180,
      f0Sd: 30,
      speechRate: 150,
      speechRatePct: 120, // fallback: Math.round(150/125*100)
      meanPause: 0.4,
      pauseRatio: 0.3,
      loudnessRange: 14,
      voicedRatio: 0.7,
      f0Slope: -2,
      pauseRegularity: 0.6,
      intensityEnvelope: 0.5,
      f0MidEndDelta: -8,
    });
  });

  it("nulls features when the packet omits them (no all-null panel)", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [{ id: "n1" }],
    });
    expect(s?.snippets[0].features).toBeNull();
  });
});

describe("mapCoachReviewSession — no auto-comment or AI draft fields", () => {
  it("does not carry fields the coach packet never sends", () => {
    // The backend's coach snippet (routes/v2/coach.py
    // _shape_coach_review_snippet) is an explicit field list with neither
    // `auto_comment` nor an AI-draft note, and no component read the mapped
    // fields (audit 2026-09-26, glue finding 11). A stray value is ignored.
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        {
          id: "n1",
          acoustic_read: { potentiometer: 1.8, outside_normal_range: true },
          auto_comment: "The pace was steadier than nearby moments.",
          coach_state: { ai_draft_coach_note: "draft" },
        },
      ],
    });
    expect(s?.snippets[0]).not.toHaveProperty("autoComment");
    expect(s?.snippets[0]).not.toHaveProperty("aiDraftNote");
    expect(s?.snippets[0]).not.toHaveProperty("acousticRead");
  });
});

describe("mapCoachReviewSession — recording_kind (#191)", () => {
  it("labels spoken / read and defaults unknown to null", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        { id: "n1", recording_kind: "spoken" },
        { id: "n2", recording_kind: "read" },
        { id: "n3" },
        { id: "n4", recording_kind: "garbage" },
      ],
    });
    // Assert by id, not index — FP-5 reorders reads to the tail.
    const byId = (id: string) => s?.snippets.find((n) => n.id === id);
    expect(byId("n1")?.recordingKind).toBe("spoken");
    expect(byId("n2")?.recordingKind).toBe("read");
    expect(byId("n3")?.recordingKind).toBeNull();
    expect(byId("n4")?.recordingKind).toBeNull();
  });
});

describe("mapCoachReviewSession — re-read ordering (FP-5)", () => {
  it("slide-orders spoken snippets but keeps reads appended in BE order", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        // Out of slide order + a read interleaved among the spoken rows.
        { id: "spoken-b", recording_kind: "spoken", slide: { index: 2 } },
        { id: "read-x", recording_kind: "read", slide: { index: 1 } },
        { id: "spoken-a", recording_kind: "spoken", slide: { index: 1 } },
        { id: "read-y", recording_kind: "read", slide: { index: 2 } },
      ],
    });
    // Spoken sorted by slide (a before b); reads NOT sorted into them — kept in
    // BE append order at the tail (x before y), even though read-x's slide is 1.
    expect(s?.snippets.map((n) => n.id)).toEqual([
      "spoken-a",
      "spoken-b",
      "read-x",
      "read-y",
    ]);
  });

  it("maps take_session_id → takeSessionId (null when absent)", () => {
    const s = mapCoachReviewSession({
      session_id: "s",
      snippets: [{ id: "n1", take_session_id: "take-7" }, { id: "n2" }],
    });
    const byId = (id: string) => s?.snippets.find((n) => n.id === id);
    expect(byId("n1")?.takeSessionId).toBe("take-7");
    expect(byId("n2")?.takeSessionId).toBeNull();
  });
});

describe("mapCoachReviewSession — blind-first context gate", () => {
  it("uses the authoritative server gate and progress", () => {
    const session = mapCoachReviewSession({
      session_id: "s",
      context_unlocked: false,
      blind_label: { labelled: 1, total: 2, complete: false },
      snippets: [
        {
          id: "one",
          coach_state: { rating_value: "yes", rating_unrateable: false },
        },
        { id: "two", coach_state: {} },
      ],
    });
    expect(session?.contextUnlocked).toBe(false);
    expect(session?.blindLabel).toEqual({
      labelled: 1,
      total: 2,
      complete: false,
    });
  });

  it("keeps context locked when the server sends no gate (audit B4)", () => {
    // The blind progress is still derived from the labels, but it never opens
    // context on its own: only the server's context_unlocked does.
    const session = mapCoachReviewSession({
      session_id: "s",
      snippets: [
        {
          id: "one",
          coach_state: { rating_value: "neutral" },
        },
        {
          id: "two",
          coach_state: { rating_unrateable: true },
        },
      ],
    });
    expect(session?.contextUnlocked).toBe(false);
    expect(session?.blindLabel.complete).toBe(true);
  });
});
