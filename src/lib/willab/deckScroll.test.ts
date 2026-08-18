/* SPEC §11.3 (founder 2026-08-14): the chunk is the step, the slide is the
 * section. These pins hold the bubbling rule itself — the component wiring
 * is a thin shell around them. */
import { describe, expect, it } from "vitest";

import {
  buildScreens,
  canBubble,
  chunkCounts,
  clampPosition,
  nearestChunkIndex,
  scrollEdge,
  stepPosition,
  wheelDestination,
} from "./deckScroll";

const COUNTS = [3, 1, 2]; // slide 0: 3 chunks, slide 1: 1, slide 2: 2

describe("stepPosition — the §11.3 bubbling rule", () => {
  it("steps through chunks WITHIN the slide first", () => {
    expect(stepPosition(COUNTS, { slide: 0, chunk: 0 }, 1)).toEqual({
      slide: 0,
      chunk: 1,
    });
    expect(stepPosition(COUNTS, { slide: 0, chunk: 1 }, 1)).toEqual({
      slide: 0,
      chunk: 2,
    });
  });

  it("bubbles to the next slide ONLY from the final chunk", () => {
    expect(stepPosition(COUNTS, { slide: 0, chunk: 2 }, 1)).toEqual({
      slide: 1,
      chunk: 0,
    });
  });

  it("a one-chunk slide bubbles immediately", () => {
    expect(stepPosition(COUNTS, { slide: 1, chunk: 0 }, 1)).toEqual({
      slide: 2,
      chunk: 0,
    });
  });

  it("backwards from the first chunk lands on the previous slide's LAST chunk", () => {
    expect(stepPosition(COUNTS, { slide: 2, chunk: 0 }, -1)).toEqual({
      slide: 1,
      chunk: 0,
    });
    expect(stepPosition(COUNTS, { slide: 1, chunk: 0 }, -1)).toEqual({
      slide: 0,
      chunk: 2,
    });
  });

  it("backwards within a slide steps chunks without changing the slide", () => {
    expect(stepPosition(COUNTS, { slide: 0, chunk: 2 }, -1)).toEqual({
      slide: 0,
      chunk: 1,
    });
  });

  it("the deck's ends absorb the step — no wrap", () => {
    expect(stepPosition(COUNTS, { slide: 0, chunk: 0 }, -1)).toEqual({
      slide: 0,
      chunk: 0,
    });
    expect(stepPosition(COUNTS, { slide: 2, chunk: 1 }, 1)).toEqual({
      slide: 2,
      chunk: 1,
    });
  });

  it("clamps a stale position before stepping", () => {
    // A reassembly can shrink a slide's chunk list under the reader.
    expect(stepPosition(COUNTS, { slide: 0, chunk: 9 }, 1)).toEqual({
      slide: 1,
      chunk: 0,
    });
    expect(clampPosition(COUNTS, { slide: 9, chunk: 9 })).toEqual({
      slide: 2,
      chunk: 1,
    });
    expect(clampPosition([], { slide: 3, chunk: 3 })).toEqual({
      slide: 0,
      chunk: 0,
    });
  });
});

describe("scrollEdge + canBubble — bubbling needs the edge", () => {
  it("mid-scroll never bubbles", () => {
    const edge = scrollEdge({
      scrollTop: 120,
      clientHeight: 400,
      scrollHeight: 900,
    });
    expect(edge).toBeNull();
    expect(canBubble(edge, 1)).toBe(false);
    expect(canBubble(edge, -1)).toBe(false);
  });

  it("the bottom edge bubbles forward only", () => {
    const edge = scrollEdge({
      scrollTop: 500,
      clientHeight: 400,
      scrollHeight: 900,
    });
    expect(edge).toBe("bottom");
    expect(canBubble(edge, 1)).toBe(true);
    expect(canBubble(edge, -1)).toBe(false);
  });

  it("the top edge bubbles backward only", () => {
    const edge = scrollEdge({
      scrollTop: 0,
      clientHeight: 400,
      scrollHeight: 900,
    });
    expect(edge).toBe("top");
    expect(canBubble(edge, -1)).toBe(true);
    expect(canBubble(edge, 1)).toBe(false);
  });

  it("content that FITS is at both edges — short slides must not swallow the gesture", () => {
    const edge = scrollEdge({
      scrollTop: 0,
      clientHeight: 400,
      scrollHeight: 400,
    });
    expect(edge).toBe("both");
    expect(canBubble(edge, 1)).toBe(true);
    expect(canBubble(edge, -1)).toBe(true);
  });

  it("tolerates sub-pixel positions at the bottom", () => {
    expect(
      scrollEdge({ scrollTop: 499.4, clientHeight: 400, scrollHeight: 900 })
    ).toBe("bottom");
  });
});

describe("wheelDestination — the whole desktop is one scroll surface", () => {
  it("leaves native scrolling alone over the active paragraph column", () => {
    expect(wheelDestination(true, false)).toBe("native-inner");
  });

  it("routes a wheel from desktop whitespace into the paragraph column", () => {
    expect(wheelDestination(false, false)).toBe("proxy-inner");
  });

  it("advances only after the active paragraph column reaches its edge", () => {
    expect(wheelDestination(true, true)).toBe("advance-screen");
    expect(wheelDestination(false, true)).toBe("advance-screen");
  });
});

describe("nearestChunkIndex — micro-progress for the indicator", () => {
  it("is the last chunk whose top has been reached", () => {
    const offsets = [0, 220, 470];
    expect(nearestChunkIndex(offsets, 0)).toBe(0);
    expect(nearestChunkIndex(offsets, 217)).toBe(0);
    // A scroller that settles sub-pixel short of a chunk top has still
    // reached it (the same 2px tolerance scrollEdge uses).
    expect(nearestChunkIndex(offsets, 219)).toBe(1);
    expect(nearestChunkIndex(offsets, 221)).toBe(1);
    expect(nearestChunkIndex(offsets, 9999)).toBe(2);
  });

  it("empty offsets stand on chunk 0", () => {
    expect(nearestChunkIndex([], 50)).toBe(0);
  });
});

describe("chunkCounts", () => {
  it("one count per group, floored at 1", () => {
    expect(
      chunkCounts([{ chunks: [1, 2] }, { chunks: [] }, { chunks: [3] }])
    ).toEqual([2, 1, 1]);
  });
});

describe("buildScreens — the §11.7.2 screen grain", () => {
  it("packs at most 3 chunks per screen, continuing the slide", () => {
    const screens = buildScreens([
      { slideIndex: 0, chunks: ["a", "b", "c", "d", "e"] },
      { slideIndex: 1, chunks: ["f"] },
    ]);
    expect(
      screens.map((s) => [s.slideIndex, s.screenOfSlide, s.screensInSlide])
    ).toEqual([
      [0, 0, 2],
      [0, 1, 2],
      [1, 0, 1],
    ]);
    expect(screens[0].chunks).toEqual(["a", "b", "c"]);
    expect(screens[1].chunks).toEqual(["d", "e"]);
  });

  it("a short slide stays one screen", () => {
    const screens = buildScreens([{ slideIndex: 2, chunks: ["a", "b"] }]);
    expect(screens).toHaveLength(1);
    expect(screens[0].screensInSlide).toBe(1);
  });

  it("an empty group still yields a navigable screen", () => {
    expect(buildScreens([{ slideIndex: null, chunks: [] }])).toHaveLength(1);
  });
});
