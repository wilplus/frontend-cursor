/* SPEC §11.3 (founder 2026-08-14): the chunk is the step, the slide is the
 * section. These pins hold the bubbling rule itself — the component wiring
 * is a thin shell around them. */
import { describe, expect, it } from "vitest";

import {
  buildScreens,
  canBubble,
  firstUnreadScreenIndex,
  screenPositionOfPart,
  packByFit,
  safeCutPoints,
  splitTextToFit,
  estimatedChunkHeight,
  type ScreenFit,
  chunkCounts,
  clampPosition,
  IDLE_WHEEL_GESTURE,
  nearestChunkIndex,
  scrollEdge,
  stepPosition,
  wheelGestureStep,
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

describe("wheelGestureStep — one trackpad gesture, one slide", () => {
  it("moves the active paragraph immediately while it can scroll", () => {
    const result = wheelGestureStep(IDLE_WHEEL_GESTURE, {
      deltaY: 24,
      now: 0,
      innerCanScroll: true,
    });
    expect(result.action).toBe("scroll-inner");
    expect(result.state.boundaryDelta).toBe(0);
    expect(result.state.advanced).toBe(false);
  });

  it("accumulates small boundary deltas instead of leaking them to the page", () => {
    const first = wheelGestureStep(IDLE_WHEEL_GESTURE, {
      deltaY: 4,
      now: 0,
      innerCanScroll: false,
    });
    const second = wheelGestureStep(first.state, {
      deltaY: 8,
      now: 16,
      innerCanScroll: false,
    });
    const third = wheelGestureStep(second.state, {
      deltaY: 7,
      now: 32,
      innerCanScroll: false,
    });
    expect(first.action).toBe("swallow");
    expect(second.action).toBe("swallow");
    expect(third.action).toBe("advance-screen");
  });

  it("swallows the momentum tail after advancing", () => {
    const advanced = wheelGestureStep(IDLE_WHEEL_GESTURE, {
      deltaY: 30,
      now: 0,
      innerCanScroll: false,
    });
    const tail = wheelGestureStep(advanced.state, {
      deltaY: 80,
      now: 16,
      innerCanScroll: true,
    });
    expect(advanced.action).toBe("advance-screen");
    expect(tail.action).toBe("swallow");
  });

  /* ── THE MAC TRACKPAD (founder 2026-09-22) ─────────────────────────────
   * "when I scroll on mac ... I can not scroll easily, smth lags there and I
   * need to repeat it to work, the movement; though on the mouse it works
   * rather fine." One flick's momentum tail kept the latch alive for as long
   * as it ran, so the next real push was swallowed. These pin both halves:
   * the tail still may not steal a second slide, and a push after it must
   * land. */

  /** One macOS flick: a peak just after release, then decay to nothing. */
  const momentumTail = (from: number, at: number) => {
    const out: { deltaY: number; now: number }[] = [];
    let delta = from;
    let now = at;
    while (delta > 0.5) {
      out.push({ deltaY: delta, now });
      delta *= 0.82;
      now += 16;
    }
    return out;
  };

  it("lets a real push land while the previous tail is still running", () => {
    let state = wheelGestureStep(IDLE_WHEEL_GESTURE, {
      deltaY: 30,
      now: 0,
      innerCanScroll: false,
    }).state;
    let last = 0;
    for (const event of momentumTail(90, 16)) {
      const step = wheelGestureStep(state, { ...event, innerCanScroll: true });
      expect(step.action).toBe("swallow");
      state = step.state;
      last = event.now;
    }
    // The tail is long — that is the whole problem. The reader pushes again
    // while it is still emitting, and that push must move the page.
    expect(last).toBeGreaterThan(400);
    const push = wheelGestureStep(state, {
      deltaY: 40,
      now: last + 16,
      innerCanScroll: true,
    });
    expect(push.action).toBe("scroll-inner");
  });

  it("still gives one slide per gesture when the swipe simply continues", () => {
    // Fingers still down: deltas stay level rather than decaying, so this is
    // one gesture however long it runs, and it may not walk the deck.
    let state = wheelGestureStep(IDLE_WHEEL_GESTURE, {
      deltaY: 30,
      now: 0,
      innerCanScroll: false,
    }).state;
    for (let now = 16; now <= 1_200; now += 16) {
      const step = wheelGestureStep(state, {
        deltaY: 30,
        now,
        innerCanScroll: false,
      });
      expect(step.action).toBe("swallow");
      state = step.state;
    }
  });

  it("does not mistake the momentum peak for a second gesture", () => {
    // macOS momentum peaks AFTER release, so the events just past an advance
    // are bigger than the one that caused it. Same flick.
    const advanced = wheelGestureStep(IDLE_WHEEL_GESTURE, {
      deltaY: 20,
      now: 0,
      innerCanScroll: false,
    });
    for (const deltaY of [60, 120, 95]) {
      expect(
        wheelGestureStep(advanced.state, {
          deltaY,
          now: 48,
          innerCanScroll: false,
        }).action
      ).toBe("swallow");
    }
  });

  it("re-arms only after a quiet gap", () => {
    const advanced = wheelGestureStep(IDLE_WHEEL_GESTURE, {
      deltaY: 30,
      now: 0,
      innerCanScroll: false,
    });
    expect(
      wheelGestureStep(advanced.state, {
        deltaY: 30,
        now: 121,
        innerCanScroll: false,
      }).action
    ).toBe("advance-screen");
    expect(
      wheelGestureStep(advanced.state, {
        deltaY: -30,
        now: 16,
        innerCanScroll: false,
      }).action
    ).toBe("swallow");
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

describe("coming back from the email (§8)", () => {
  const deck = (unread: readonly string[]) => ({
    screens: buildScreens([
      { slideIndex: 0, chunks: ["a", "b"] },
      { slideIndex: 1, chunks: ["c"] },
      { slideIndex: 2, chunks: ["d", "e"] },
    ]),
    isUnread: (chunk: string) => unread.includes(chunk),
  });

  it("lands on the first screen carrying something unread", () => {
    const { screens, isUnread } = deck(["d"]);
    expect(firstUnreadScreenIndex(screens, isUnread)).toBe(2);
  });

  it("takes the FIRST one when several are waiting, not the last", () => {
    const { screens, isUnread } = deck(["c", "e"]);
    expect(firstUnreadScreenIndex(screens, isUnread)).toBe(1);
  });

  it("finds it wherever it sits inside the screen", () => {
    // "b" is the second chunk of the first screen. A rule that only looked at
    // the chunk a screen opens on would miss it.
    const { screens, isUnread } = deck(["b"]);
    expect(firstUnreadScreenIndex(screens, isUnread)).toBe(0);
  });

  it("returns null when nothing is waiting, which means DO NOT MOVE", () => {
    // Not 0. A speaker with nothing unread keeps the position they left —
    // scrolling them to the top would be a regression dressed as a feature.
    const { screens, isUnread } = deck([]);
    expect(firstUnreadScreenIndex(screens, isUnread)).toBeNull();
  });
});


describe("screenPositionOfPart — coming back to the paragraph you settled", () => {
  /* Founder 2026-09-17, locked: after a lock, "return to the slide, scrolled
     to that paragraph". The sheet closed onto wherever the deck happened to
     be standing, which after a reassembly could be a different paragraph. */
  const chunk = (id: string) => ({ part: { id } });
  const screen = (...ids: string[]) => ({
    slideIndex: 0,
    screenOfSlide: 0,
    screensInSlide: 1,
    chunks: ids.map(chunk),
  });

  it("finds the paragraph on its own screen, at its own place in it", () => {
    const screens = [screen("a", "b", "c"), screen("d", "e")];
    expect(screenPositionOfPart(screens, "a")).toEqual({ slide: 0, chunk: 0 });
    expect(screenPositionOfPart(screens, "c")).toEqual({ slide: 0, chunk: 2 });
    expect(screenPositionOfPart(screens, "e")).toEqual({ slide: 1, chunk: 1 });
  });

  it("says NOT HERE rather than guessing at the top", () => {
    // A lock reassembles the document. While the screens are being rebuilt
    // the id is simply absent, and the caller must WAIT rather than jump —
    // landing on slide 0 would be worse than not moving at all.
    const screens = [screen("a", "b")];
    expect(screenPositionOfPart(screens, "gone")).toBeNull();
    expect(screenPositionOfPart(screens, null)).toBeNull();
    expect(screenPositionOfPart(screens, "")).toBeNull();
    expect(screenPositionOfPart([], "a")).toBeNull();
  });

  it("lands on the FIRST screen of a paragraph that spans several", () => {
    /* Founder 2026-09-17, locked: "scroll to paragraph means scroll to the
       first screen of that paragraph — people will scroll to see it." Once an
       over-tall paragraph is split across screens, every one of them holds it,
       so which one you are put on is a real choice. The first: it is where the
       paragraph begins and where reading it starts. */
    const spanning = [
      screen("a"),
      { ...screen("long"), screenOfSlide: 0 },
      { ...screen("long"), screenOfSlide: 1 },
      { ...screen("long"), screenOfSlide: 2 },
    ];
    expect(screenPositionOfPart(spanning, "long")).toEqual({
      slide: 1, chunk: 0,
    });
  });

  it("follows the paragraph when the reassembly MOVED it", () => {
    // The whole reason this is looked up by id rather than remembered as a
    // position: a lock recomposes the served text, so the paragraph can end
    // up on a different screen than the one it was opened from.
    const before = [screen("a", "b", "c"), screen("d")];
    const after = [screen("a"), screen("b", "c", "d")];
    expect(screenPositionOfPart(before, "d")).toEqual({ slide: 1, chunk: 0 });
    expect(screenPositionOfPart(after, "d")).toEqual({ slide: 1, chunk: 3 - 1 });
  });
});


describe("packByFit — a long slide continues onto as many screens as it needs", () => {
  /* Founder 2026-09-17: "make it one screen view for the text, and if it
     exceeds then you make more screens with the text below, so it all fits."
     Reported as being stuck on the third slide — it was not stuck; the text
     ran past the bottom and had to be scrolled inside, which reads the same. */
  const FIT: ScreenFit = {
    budgetPx: 300,
    lineHeightPx: 30,      // 10 lines fit
    charsPerLine: 40,
    gapPx: 16,
  };
  const chunk = (id: string, chars: number) => ({ id, text: "x".repeat(chars) });
  const textOf = (c: { text: string }) => c.text;

  it("puts as many paragraphs on a screen as actually fit", () => {
    // 80 chars = 2 lines = 60px each. 300px budget, 16px gaps:
    // 60 + 76 + 76 + 76 = 288 fits; a fifth would be 364.
    const chunks = Array.from({ length: 5 }, (_, i) => chunk(`c${i}`, 80));
    const packs = packByFit(chunks, textOf, FIT);
    expect(packs.map((p) => p.length)).toEqual([4, 1]);
  });

  it("is NOT a fixed count — short paragraphs get more per screen", () => {
    // The old rule was always three. One line each (30px) + 16px gaps fits
    // six, not three.
    const chunks = Array.from({ length: 6 }, (_, i) => chunk(`c${i}`, 20));
    expect(packByFit(chunks, textOf, FIT)[0].length).toBeGreaterThan(3);
  });

  it("gives a paragraph taller than the whole screen one of its own", () => {
    // Never split a paragraph: it is the unit the speaker reads and decides
    // on. This is the one place scrolling inside a screen remains.
    const packs = packByFit(
      [chunk("small", 20), chunk("huge", 4000), chunk("after", 20)],
      textOf, FIT,
    );
    expect(packs.map((p) => p.map((c) => c.id))).toEqual([
      ["small"], ["huge"], ["after"],
    ]);
  });

  it("never loses or reorders a paragraph", () => {
    const chunks = Array.from({ length: 11 }, (_, i) => chunk(`c${i}`, 50 * i + 10));
    const flat = packByFit(chunks, textOf, FIT).flat();
    expect(flat.map((c) => c.id)).toEqual(chunks.map((c) => c.id));
  });

  it("degrades to one screen rather than dividing by zero", () => {
    const chunks = [chunk("a", 20), chunk("b", 20)];
    const broken = { ...FIT, budgetPx: 0 };
    expect(packByFit(chunks, textOf, broken)).toEqual([chunks]);
    expect(packByFit(chunks, textOf, { ...FIT, lineHeightPx: 0 })).toEqual([chunks]);
    expect(packByFit([], textOf, FIT)).toEqual([]);
  });

  it("estimates at least one line, even for an empty paragraph", () => {
    expect(estimatedChunkHeight("", FIT)).toBe(30);
    expect(estimatedChunkHeight("x".repeat(41), FIT)).toBe(60);
  });
});

describe("buildScreens with a fit — the slide keeps its identity", () => {
  const FIT: ScreenFit = {
    budgetPx: 100, lineHeightPx: 30, charsPerLine: 40, gapPx: 16,
  };
  const textOf = (c: { text: string }) => c.text;

  it("continues ONE slide across screens and says so", () => {
    const groups = [{
      slideIndex: 2,
      chunks: Array.from({ length: 4 }, (_, i) => ({ text: "x".repeat(80) })),
    }];
    const screens = buildScreens(groups, 3, { fit: FIT, textOf });
    expect(screens).toHaveLength(4);       // 60px each, only one fits in 100
    expect(screens.every((s) => s.slideIndex === 2)).toBe(true);
    expect(screens.map((s) => s.screenOfSlide)).toEqual([0, 1, 2, 3]);
    expect(screens.every((s) => s.screensInSlide === 4)).toBe(true);
  });

  it("without a fit it is exactly what it always was", () => {
    const groups = [{ slideIndex: 0, chunks: [1, 2, 3, 4, 5] }];
    expect(buildScreens(groups, 3).map((s) => s.chunks.length)).toEqual([3, 2]);
  });
});


describe("splitting a paragraph too tall for one screen", () => {
  /* Founder 2026-09-17, overruling the never-split rule shipped hours
     earlier: "it should be two screens, why is it worse?" They were right —
     scrolling inside a screen is the thing that read as being stuck. The cost
     is the CONTROLS, paid separately: the bookmark and Lock repeat on every
     screen the paragraph touches and each acts on the whole paragraph. */
  const FIT: ScreenFit = {
    budgetPx: 120, lineHeightPx: 30, charsPerLine: 20, gapPx: 10,
  };  // 4 lines x 20 chars = 80 chars a screen

  it("cuts a long paragraph into screenfuls, losing no words", () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const pieces = splitTextToFit(text, FIT);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.join(" ")).toBe(text);
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(80);
  });

  it("leaves a paragraph that already fits completely alone", () => {
    expect(splitTextToFit("short enough", FIT)).toEqual(["short enough"]);
  });

  it("NEVER cuts between a ** and its closing ** ", () => {
    // Emphasis is stored as markers in the paragraph's own text. A cut
    // between the pair renders literal asterisks at the reader — the defect
    // the chunk editor was fixed for once already.
    const text =
      "aaa bbb ccc ddd eee **fff ggg hhh iii jjj** kkk lll mmm nnn ooo ppp qqq";
    for (const piece of splitTextToFit(text, FIT)) {
      const markers = (piece.match(/\*\*/g) ?? []).length;
      expect(markers % 2).toBe(0);
    }
  });

  it("safeCutPoints skips every space inside a marker pair", () => {
    const text = "one **two three** four";
    const cuts = safeCutPoints(text);
    // The spaces inside **two three** are not offered.
    expect(cuts.map((at) => text.slice(at - 3, at))).not.toContain("two");
    expect(cuts.length).toBeGreaterThan(0);
  });

  it("one unbreakable word longer than a screen is left whole", () => {
    // Nowhere safe to cut. It takes its screen and scrolls — the honest floor.
    const wall = "x".repeat(400);
    expect(splitTextToFit(wall, FIT)).toEqual([wall]);
  });

  it("packByFit gives each piece its OWN screen, through sliceOf", () => {
    type Piece = { id: string; text: string; index?: number; count?: number };
    const long: Piece = {
      id: "big",
      text: Array.from({ length: 40 }, (_, i) => `w${i}`).join(" "),
    };
    const packs = packByFit<Piece>(
      [{ id: "before", text: "tiny" }, long, { id: "after", text: "tiny" }],
      (c) => c.text,
      FIT,
      (chunk, text, index, count) => ({ ...chunk, text, index, count }),
    );
    const bigScreens = packs.filter((p) => p.some((c) => c.id === "big"));
    expect(bigScreens.length).toBeGreaterThan(1);
    // Every piece keeps the paragraph's IDENTITY — that is what makes the
    // repeated controls one decision about one paragraph.
    for (const screen of bigScreens) {
      expect(screen).toHaveLength(1);
      expect(screen[0].id).toBe("big");
      expect(screen[0].count).toBe(bigScreens.length);
    }
    // ...and its neighbours are still their own screens, in order.
    expect(packs.flat().map((c) => c.id)[0]).toBe("before");
    expect(packs.flat().map((c) => c.id).at(-1)).toBe("after");
  });

  it("without sliceOf the over-tall chunk keeps its own scrolling screen", () => {
    const long = { id: "big", text: "w ".repeat(200) };
    const packs = packByFit([long], (c) => c.text, FIT);
    expect(packs).toEqual([[long]]);
  });
});
