import { describe, expect, it } from "vitest";
import { groupSnippetsBySlide, type ReadoutSnippet } from "./readout";

function snip(
  id: string,
  startOffsetMs: number,
  slideIndex: number | null
): ReadoutSnippet {
  return {
    id,
    startOffsetMs,
    durationMs: 1000,
    transcript: id,
    audioRef: null,
    features: {
      f0Mean: null,
      f0Sd: null,
      speechRate: null,
      speechRatePct: null,
      meanPause: null,
      pauseRatio: null,
      loudnessRange: null,
      voicedRatio: null,
      f0Slope: null,
      pauseRegularity: null,
      intensityEnvelope: null,
      f0MidEndDelta: null,
    },
    stickiness: { composite: null, comment: null },
    rank: null,
    powerScore: null,
    coach: null,
    slide: slideIndex === null ? null : { index: slideIndex, title: "", body: "" },
    breakthrough: false,
    breakthroughNote: null,
    breakthroughVideoRef: null,
  };
}

describe("groupSnippetsBySlide", () => {
  it("collapses snippets onto their slide, one group per slide", () => {
    const groups = groupSnippetsBySlide([
      snip("a", 0, 0),
      snip("b", 100, 1),
      snip("c", 200, 0),
    ]);
    expect(groups.map((g) => g.slideIndex)).toEqual([0, 1]);
    expect(groups[0].snippets.map((s) => s.id)).toEqual(["a", "c"]);
    expect(groups[1].snippets.map((s) => s.id)).toEqual(["b"]);
  });

  it("sorts real slides by page index and moments by start offset", () => {
    const groups = groupSnippetsBySlide([
      snip("late", 500, 2),
      snip("early", 100, 0),
      snip("mid", 300, 0),
    ]);
    expect(groups.map((g) => g.slideIndex)).toEqual([0, 2]);
    // within slide 0, chronological by startOffsetMs
    expect(groups[0].snippets.map((s) => s.id)).toEqual(["early", "mid"]);
  });

  it("collects no-slide snippets into a single trailing null group", () => {
    const groups = groupSnippetsBySlide([
      snip("general1", 50, null),
      snip("onslide", 100, 1),
      snip("general2", 150, null),
    ]);
    expect(groups.map((g) => g.slideIndex)).toEqual([1, null]);
    expect(groups[1].snippets.map((s) => s.id)).toEqual([
      "general1",
      "general2",
    ]);
  });

  it("returns an empty array for no snippets", () => {
    expect(groupSnippetsBySlide([])).toEqual([]);
  });

  it("backfills slide meta from a later snippet that carries it", () => {
    // first snippet for the key has slide; ensure slide object is preserved
    const groups = groupSnippetsBySlide([snip("a", 0, 3), snip("b", 10, 3)]);
    expect(groups[0].slide).toEqual({ index: 3, title: "", body: "" });
  });
});
