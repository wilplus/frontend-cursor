import { describe, expect, it } from "vitest";
import { mapReadoutPayload, mapReadoutSnippet, mockReadout } from "./readout";

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
        mean_pause: 400,
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
    expect(s.features.meanPause).toBe(0.4); // pause_ms 400 → 0.4s (ms→s at boundary)
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

  it("maps the post-publish coach lane (overall_message + snippet.coach)", () => {
    const p = mapReadoutPayload({
      insights_payload: { overall_message: "Strong session." },
      snippets: [
        { id: "a", coach: { note: "nice open", tag: "strong" } },
        { id: "b", coach: { note: "rushed", tag: "to_work_on" } },
        { id: "c" }, // no coach yet
      ],
    });
    expect(p.overallMessage).toBe("Strong session.");
    expect(p.snippets[0]?.coach).toEqual({
      note: "nice open",
      tag: "strong",
      when: null,
      examples: [],
    });
    expect(p.snippets[1]?.coach?.tag).toBe("to_work_on");
    expect(p.snippets[2]?.coach).toBeNull();
  });

  it("maps the coach When guidance + examples, dropping blank examples", () => {
    const p = mapReadoutPayload({
      snippets: [
        {
          id: "a",
          coach: {
            note: "great open",
            tag: "strong",
            when: "Reuse this opener when you want to land emphasis.",
            examples: ["Why should you care?", "", "Why us?"],
          },
        },
      ],
    });
    expect(p.snippets[0]?.coach?.when).toBe(
      "Reuse this opener when you want to land emphasis."
    );
    expect(p.snippets[0]?.coach?.examples).toEqual([
      "Why should you care?",
      "Why us?",
    ]);
  });

  it("defaults overall_message to null pre-publish", () => {
    expect(mapReadoutPayload({ snippets: [] }).overallMessage).toBeNull();
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
