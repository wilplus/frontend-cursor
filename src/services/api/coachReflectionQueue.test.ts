import { describe, expect, it } from "vitest";
import { mapCoachReflectionClip } from "./coachReflectionQueue";

/* F2 §1d — the coach queue's wire mapper. The load-bearing property is
 * BLINDNESS: the coach's verdict is only worth something as an independent
 * third judgement, so this mapper consumes audio + transcript and has no slot
 * for the machine's flag or the student's vote even if one ever arrived. */

describe("mapCoachReflectionClip", () => {
  const wire = {
    clip_id: "c1",
    audio_ref: "https://cdn/a.webm",
    start_offset_ms: 1200,
    duration_ms: 4800,
    transcript: "the words they said",
  };

  it("maps the allowlisted blind shape", () => {
    expect(mapCoachReflectionClip(wire)).toEqual({
      clipId: "c1",
      audioRef: "https://cdn/a.webm",
      startOffsetMs: 1200,
      durationMs: 4800,
      transcript: "the words they said",
    });
  });

  it("drops an unplayable clip (no id / no audio) — never a dead player", () => {
    expect(mapCoachReflectionClip({ ...wire, clip_id: "" })).toBeNull();
    expect(mapCoachReflectionClip({ ...wire, audio_ref: "" })).toBeNull();
    expect(mapCoachReflectionClip(null)).toBeNull();
    expect(mapCoachReflectionClip("junk")).toBeNull();
  });

  it("never carries the machine flag, the user vote, or user identity", () => {
    const mapped = mapCoachReflectionClip({
      ...wire,
      machine_flagged: true, // the BE must never send any of these; if one
      user_vote: "best", //     ever slipped through, the mapper has no slot
      user_id: "u1",
      confidence: 0.93,
      named_emotion: "nervous",
    });
    expect(mapped).not.toBeNull();
    expect(Object.keys(mapped!).sort()).toEqual([
      "audioRef",
      "clipId",
      "durationMs",
      "startOffsetMs",
      "transcript",
    ]);
    // Belt and braces: nothing that could reveal the flag or the vote
    // survives serialization of what this lane hands the UI.
    const wireOut = JSON.stringify(mapped).toLowerCase();
    for (const leak of ["machine", "flag", "vote", "confidence", "emotion"]) {
      expect(wireOut).not.toContain(leak);
    }
  });

  it("tolerates a missing transcript and junk offsets", () => {
    const mapped = mapCoachReflectionClip({
      clip_id: "c1",
      audio_ref: "https://cdn/a.webm",
      start_offset_ms: -5,
      duration_ms: "nope",
    });
    expect(mapped).toEqual({
      clipId: "c1",
      audioRef: "https://cdn/a.webm",
      startOffsetMs: 0,
      durationMs: 0,
      transcript: "",
    });
  });
});
