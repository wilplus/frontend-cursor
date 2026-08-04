import { describe, expect, it } from "vitest";
import {
  mapConfidentVoice,
  mapReflectionClip,
} from "./reflectionGame";

/* F2 §1 — the game's wire mappers. The important property: the FE consumes
 * ONLY the allowlisted fields, and an extra field the BE must never send
 * (decoy identity, confidence) has no slot to land in even if it appeared. */

describe("mapReflectionClip", () => {
  const wire = {
    clip_id: "c1",
    audio_ref: "https://cdn/a.webm",
    start_offset_ms: 1200,
    duration_ms: 4800,
    arc_id: "a1",
    take_session_id: "t1",
  };

  it("maps the allowlisted shape", () => {
    expect(mapReflectionClip(wire)).toEqual({
      clipId: "c1",
      audioRef: "https://cdn/a.webm",
      startOffsetMs: 1200,
      durationMs: 4800,
      arcId: "a1",
      takeSessionId: "t1",
    });
  });

  it("drops an unplayable clip (no id / no audio) — never a dead player", () => {
    expect(mapReflectionClip({ ...wire, clip_id: "" })).toBeNull();
    expect(mapReflectionClip({ ...wire, audio_ref: "" })).toBeNull();
    expect(mapReflectionClip(null)).toBeNull();
    expect(mapReflectionClip("junk")).toBeNull();
  });

  it("never carries a field that could leak decoy identity or confidence", () => {
    const mapped = mapReflectionClip({
      ...wire,
      machine_flagged: true, // the BE must never send these; if one ever
      confidence: 0.93, //       slipped through, the mapper has no slot for it
      is_decoy: false,
    });
    expect(mapped).not.toBeNull();
    expect(Object.keys(mapped as object).sort()).toEqual([
      "arcId",
      "audioRef",
      "clipId",
      "durationMs",
      "startOffsetMs",
      "takeSessionId",
    ]);
  });

  it("degrades junk offsets to 0 (unclamped playback, not NaN)", () => {
    const m = mapReflectionClip({
      ...wire,
      start_offset_ms: "12",
      duration_ms: -5,
    });
    expect(m?.startOffsetMs).toBe(0);
    expect(m?.durationMs).toBe(0);
  });
});

describe("mapConfidentVoice", () => {
  it("maps the library row; unplayable rows drop", () => {
    expect(
      mapConfidentVoice({
        id: "m1",
        audio_ref: "https://cdn/m.webm",
        start_offset_ms: 0,
        duration_ms: 5000,
        arc_id: "a1",
        topic: "Q3 pitch",
        verified_at: "2026-08-04T10:00:00Z",
      })
    ).toEqual({
      id: "m1",
      audioRef: "https://cdn/m.webm",
      startOffsetMs: 0,
      durationMs: 5000,
      arcId: "a1",
      topic: "Q3 pitch",
      verifiedAt: "2026-08-04T10:00:00Z",
    });
    expect(mapConfidentVoice({ id: "m1", audio_ref: "" })).toBeNull();
  });
});
