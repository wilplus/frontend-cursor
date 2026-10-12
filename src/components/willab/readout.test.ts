import { describe, expect, it } from "vitest";
import {
  mapReadoutPayload,
} from "./readout";

describe("mapReadoutPayload", () => {

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
});
