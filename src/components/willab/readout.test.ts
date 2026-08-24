import { describe, expect, it } from "vitest";
import {
  mapReadoutPayload,
  mapReadoutSnippet,
  mockReadout,
  pickTopSnippet,
} from "./readout";

describe("mapReadoutSnippet", () => {
  it("maps the BE snake_case shape to camelCase", () => {
    const s = mapReadoutSnippet({
      id: "s1",
      start_offset_ms: 1200,
      duration_ms: 8000,
      transcript: "hello",
      audio_ref: "https://cdn/full.webm",
      features: {
        f0_mean: 165,
        f0_sd: 28,
        speech_rate: 148,
        mean_pause_seconds: 0.22,
        pause_ratio: 0.32,
        loudness_range: 14,
        voiced_ratio: 0.71,
        f0_slope: -2,
        pause_regularity: 0.6,
        intensity_envelope: 0.5,
        f0_mid_end_delta: -8,
      },
      stickiness: { composite: 0.72, comment: "nice" },
    });
    expect(s.id).toBe("s1");
    expect(s.startOffsetMs).toBe(1200);
    expect(s.durationMs).toBe(8000);
    expect(s.audioRef).toBe("https://cdn/full.webm");
    expect(s.features.speechRate).toBe(148);
    expect(s.features.pauseRatio).toBe(0.32);
    expect(s.features.meanPause).toBe(0.22); // BE-2: mean_pause_seconds (unit baked into the field name)
    expect(s.features.f0MidEndDelta).toBe(-8);
    expect(s.stickiness).toEqual({ composite: 0.72, comment: "nice" });
  });

  it("defaults offsets to 0 and missing metrics to null", () => {
    const s = mapReadoutSnippet({ id: "x" });
    expect(s.startOffsetMs).toBe(0);
    expect(s.durationMs).toBe(0);
    expect(s.audioRef).toBeNull();
    expect(s.transcript).toBe("");
    expect(s.features.speechRate).toBeNull();
    expect(s.stickiness).toEqual({ composite: null, comment: null });
  });

  it("rejects non-finite / wrong-typed metrics to null", () => {
    const s = mapReadoutSnippet({
      id: "x",
      features: { speech_rate: "fast", pause_ratio: NaN, f0_mean: 100 },
    });
    expect(s.features.speechRate).toBeNull();
    expect(s.features.pauseRatio).toBeNull();
    expect(s.features.f0Mean).toBe(100);
  });
});

describe("mapReadoutPayload", () => {
  it("maps a snippets array", () => {
    const p = mapReadoutPayload({ snippets: [{ id: "a" }, { id: "b" }] });
    expect(p.snippets.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("tolerates missing / non-array snippets", () => {
    expect(mapReadoutPayload({}).snippets).toEqual([]);
    expect(mapReadoutPayload(null).snippets).toEqual([]);
    expect(mapReadoutPayload({ snippets: "nope" }).snippets).toEqual([]);
  });

  it("maps exact-evidence feedback and the separate coach review", () => {
    const p = mapReadoutPayload({
      coach_review: {
        overall_message: "Strong session.",
        video_ref: "https://cdn/coach.mp4",
      },
      feedback_items: [{
        id: "coach:take-1:piece-1",
        family: "rewrite_for_clarity",
        message: "This sentence can be clearer.",
        review_state: "refined",
        replacement_text: "A clearer sentence.",
        application_guidance: "Use this when opening the proposal.",
        examples: ["A short example."],
        user_decision: "pending",
        evidence: {
          project_id: "project-1",
          take_id: "take-1",
          slide_index: 0,
          paragraph_index: 1,
          piece_id: "piece-1",
          evidence_span: { start: 5, end: 20, text: "Original sentence." },
          audio_interval: null,
        },
      }],
      snippets: [{ id: "piece-1" }],
    });
    expect(p.overallMessage).toBe("Strong session.");
    expect(p.videoRef).toBe("https://cdn/coach.mp4");
    expect(p.feedbackItems).toHaveLength(1);
    expect(p.feedbackItems[0]?.family).toBe("rewrite_for_clarity");
    expect(p.feedbackItems[0]?.evidence.pieceId).toBe("piece-1");
    expect(p.feedbackItems[0]?.replacementText).toBe("A clearer sentence.");
  });

  it("no longer carries the retired humanFeedbackVisible field", () => {
    const p = mapReadoutPayload({ snippets: [], human_feedback_visible: false });
    expect("humanFeedbackVisible" in p).toBe(false);
    // audit_paid still echoes through for the deliverable CTAs.
    expect(mapReadoutPayload({ snippets: [], audit_paid: false }).auditPaid).toBe(
      false
    );
  });

  it("defaults the unpublished coach layer to empty", () => {
    const p = mapReadoutPayload({ snippets: [] });
    expect(p.overallMessage).toBeNull();
    expect(p.feedbackItems).toEqual([]);
  });

  it("maps deck slides + complete per-slide transcripts (sorted, '' valid)", () => {
    const p = mapReadoutPayload({
      snippets: [{ id: "a" }],
      slides: [
        { index: 0, title: "Cover", body: "" },
        { index: 1, title: "Body", body: "x" },
      ],
      slide_transcripts: [
        // out of order + an empty (quiet) first slide → both kept, index-sorted
        { index: 1, transcript: "the middle bit", start_offset_ms: 9000, duration_ms: 4000 },
        { index: 0, transcript: "", start_offset_ms: 0, duration_ms: 9000 },
      ],
    });
    expect(p.slides.map((s) => s.index)).toEqual([0, 1]);
    expect(p.slideTranscripts.map((t) => t.index)).toEqual([0, 1]);
    expect(p.slideTranscripts[0]).toEqual({
      index: 0,
      transcript: "",
      startOffsetMs: 0,
      durationMs: 9000,
    });
    expect(p.slideTranscripts[1].transcript).toBe("the middle bit");
  });

  it("defaults slides + slideTranscripts to [] when absent (legacy readout)", () => {
    const p = mapReadoutPayload({ snippets: [{ id: "a" }] });
    expect(p.slides).toEqual([]);
    expect(p.slideTranscripts).toEqual([]);
  });
});

describe("pickTopSnippet (one comment per slide)", () => {
  const snip = (over: Record<string, unknown>) =>
    mapReadoutSnippet({ transcript: "t", ...over });

  it("returns null for a slide with no snippets", () => {
    expect(pickTopSnippet([])).toBeNull();
  });

  it("a slide with 2 snippets collapses to ONE — lowest rank wins", () => {
    const a = snip({ id: "a", rank: 3 });
    const b = snip({ id: "b", rank: 1 });
    expect(pickTopSnippet([a, b])?.id).toBe("b");
    expect(pickTopSnippet([b, a])?.id).toBe("b"); // order-independent
  });

  it("no rank → highest power_score (then overall_score)", () => {
    expect(
      pickTopSnippet([
        snip({ id: "a", power_score: 0.4 }),
        snip({ id: "b", power_score: 0.9 }),
      ])?.id
    ).toBe("b");
    expect(
      pickTopSnippet([
        snip({ id: "a", overall_score: 0.2 }),
        snip({ id: "b", overall_score: 0.7 }),
      ])?.id
    ).toBe("b");
  });

  it("no rank/power → highest stickiness composite", () => {
    expect(
      pickTopSnippet([
        snip({ id: "a", stickiness: { composite: 0.2 } }),
        snip({ id: "b", stickiness: { composite: 0.8 } }),
      ])?.id
    ).toBe("b");
  });

  it("all equal → earliest start offset", () => {
    expect(
      pickTopSnippet([
        snip({ id: "a", start_offset_ms: 5000 }),
        snip({ id: "b", start_offset_ms: 1000 }),
      ])?.id
    ).toBe("b");
  });
});

describe("mockReadout", () => {
  it("produces deterministic sample snippets carrying the topic", () => {
    const a = mockReadout("Q3 pitch");
    const b = mockReadout("Q3 pitch");
    expect(a).toEqual(b); // deterministic (no random/Date)
    expect(a.snippets.length).toBeGreaterThan(0);
    expect(a.snippets[0]?.transcript).toContain("Q3 pitch");
    expect(a.snippets[0]?.features.speechRate).not.toBeNull();
  });
});
