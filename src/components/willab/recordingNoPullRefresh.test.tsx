// @vitest-environment jsdom
/* The recording stage never lets a pull reach the page (founder 2026-10-06:
   pulling down on the recording screen reloaded it and lost the Take). The
   root's overscroll-behavior covers most browsers; the stage's own
   touchmove is the belt for those that ignore it (iOS before 16). */
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdfSlides", () => ({
  PdfPage: () => null,
  MockPresentationSlide: () => null,
  SlideRender: () => null,
}));

import RecordingRoadmap from "./RecordingRoadmap";
import { useLabNoPull } from "./labNoPull";

let root: Root;
let host: HTMLDivElement;
let slideSeen = 0;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  slideSeen = 0;
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  window.localStorage.clear();
});

const SLIDES = [0, 1, 2].map((i) => ({ title: `Slide ${i + 1}`, body: "" })) as never[];
const ROOTS = [0, 1, 2].map((slideIndex) => ({
  slideIndex,
  text: `words for slide ${slideIndex + 1}`,
  type: "neutral" as const,
}));

function Harness() {
  const [current, setCurrent] = useState(0);
  slideSeen = current;
  return createElement(RecordingRoadmap, {
    slides: SLIDES,
    presentationRef: null,
    currentSlide: current,
    roots: ROOTS,
    onSlideChange: setCurrent,
  });
}

function render() {
  act(() => root.render(createElement(Harness)));
  const scroller = host.querySelector<HTMLDivElement>(
    '[aria-label^="Speaking anchors"]',
  )!;
  const stage = scroller.closest(".flex-1.flex-col") as HTMLDivElement;
  return { scroller, stage };
}

/** jsdom lays nothing out: give the roots scroller real overflow. */
function overflow(scroller: HTMLElement, scrollTop: number) {
  Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1000 });
  Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 200 });
  scroller.scrollTop = scrollTop;
}

function touch(type: string, target: EventTarget, clientY: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientY }],
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

/** A drag from `from` to `to` in small steps; returns each move. */
function drag(target: EventTarget, from: number, to: number, steps = 6): Event[] {
  touch("touchstart", target, from);
  const moves: Event[] = [];
  for (let i = 1; i <= steps; i += 1) {
    moves.push(touch("touchmove", target, from + ((to - from) * i) / steps));
  }
  touch("touchend", target, to);
  return moves;
}

describe("the recording stage and the page's pull-to-refresh", () => {
  it("cancels a pull down from the slide on slide 1 with the scroller at its top", () => {
    const { scroller, stage } = render();
    overflow(scroller, 0);
    const slide = stage.firstElementChild!;
    const moves = drag(slide, 100, 130);
    expect(moves.every((m) => m.defaultPrevented)).toBe(true);
    expect(slideSeen).toBe(0);
  });

  it("cancels a pull down inside the scroller once it is at its top", () => {
    const { scroller } = render();
    overflow(scroller, 0);
    const moves = drag(scroller, 300, 330);
    expect(moves.every((m) => m.defaultPrevented)).toBe(true);
    expect(slideSeen).toBe(0);
  });

  it("never cancels a move the roots scroller can still take", () => {
    const { scroller } = render();
    overflow(scroller, 400);
    // Down and up from the middle: both are the scroller's own scroll.
    expect(drag(scroller, 300, 340).some((m) => m.defaultPrevented)).toBe(false);
    expect(drag(scroller, 300, 260).some((m) => m.defaultPrevented)).toBe(false);
    // At the top, a push up still scrolls the words.
    overflow(scroller, 0);
    expect(drag(scroller, 300, 260).some((m) => m.defaultPrevented)).toBe(false);
    expect(slideSeen).toBe(0);
  });

  it("still turns a big edge swipe into exactly one slide change", () => {
    const { scroller } = render();
    // No overflow: the scroller is at both edges, as on Take 1.
    const moves = drag(scroller, 400, 200, 8);
    expect(slideSeen).toBe(1);
    expect(moves.every((m) => m.defaultPrevented)).toBe(true);
    // Back up again: one slide back.
    drag(host.querySelector('[aria-label^="Speaking anchors"]')!, 200, 400, 8);
    expect(slideSeen).toBe(0);
  });

  it("changes nothing below the lock's 90px of travel (founder lock 2026-10-07)", () => {
    const { scroller } = render();
    // 60px moved a slide under the old 48px rule; now it springs back.
    const moves = drag(scroller, 400, 340);
    expect(slideSeen).toBe(0);
    // Still never a page pull while it follows the finger.
    expect(moves.every((m) => m.defaultPrevented)).toBe(true);
    drag(host.querySelector('[aria-label^="Speaking anchors"]')!, 400, 311);
    expect(slideSeen).toBe(0);
    drag(host.querySelector('[aria-label^="Speaking anchors"]')!, 400, 310);
    expect(slideSeen).toBe(1);
  });

  it("starts no page pull from the top bar or the strip either", () => {
    render();
    // A touch anywhere on the screen, outside the content, is still the
    // screen's: the listeners are on the document.
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    const moves = drag(outside, 100, 160);
    expect(moves.every((m) => m.defaultPrevented)).toBe(true);
    outside.remove();
  });

  it("keeps the rail dots' taps", () => {
    render();
    const dot = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Go to slide 3 of 3"]',
    )!;
    touch("touchstart", dot, 300);
    expect(touch("touchmove", dot, 302).defaultPrevented).toBe(true);
    touch("touchend", dot, 302);
    act(() => dot.click());
    expect(slideSeen).toBe(2);
  });
});

/* "Getting your mic ready" before a later Take (build plan D-RC-3): the
   Lab's own no-pull rule now covers lab_prerecord too, root and belt. */
describe("no pull-to-refresh on the later-Take mic wait", () => {
  type LabState = Parameters<typeof useLabNoPull>[0];
  type Mic = Parameters<typeof useLabNoPull>[1];
  function Probe({ state, mic }: { state: LabState; mic: Mic }) {
    useLabNoPull(state, mic);
    return null;
  }
  const html = () => document.documentElement.style.overscrollBehavior;
  const body = () => document.body.style.overscrollBehavior;
  const show = (state: LabState, mic: Mic = "stopped") =>
    act(() => root.render(createElement(Probe, { state, mic })));

  beforeEach(() => {
    document.documentElement.style.overscrollBehavior = "auto";
    document.body.style.overscrollBehavior = "contain";
  });
  afterEach(() => {
    document.documentElement.style.overscrollBehavior = "";
    document.body.style.overscrollBehavior = "";
  });

  it("sets overscroll-behavior none on lab_prerecord and keeps it into the recording", () => {
    show("lab_session_context");
    expect(html()).toBe("auto");
    show("lab_prerecord");
    expect(html()).toBe("none");
    expect(body()).toBe("none");
    show("lab_recording", "idle");
    expect(html()).toBe("none");
    show("lab_recording", "recording");
    expect(html()).toBe("none");
  });

  it("restores the page's own values when lab_prerecord falls back to the setup form", () => {
    show("lab_prerecord");
    expect(html()).toBe("none");
    show("lab_session_context");
    expect(html()).toBe("auto");
    expect(body()).toBe("contain");
  });

  it("restores them when the overlay closes on the mic wait", () => {
    show("lab_prerecord");
    act(() => root.unmount());
    expect(html()).toBe("auto");
    expect(body()).toBe("contain");
    act(() => {
      root = createRoot(host);
    });
  });

  it("cancels a pull outside any inner scroller on lab_prerecord", () => {
    show("lab_prerecord");
    const plain = document.createElement("div");
    host.appendChild(plain);
    expect(drag(plain, 100, 160).every((m) => m.defaultPrevented)).toBe(true);
    expect(drag(plain, 160, 100).every((m) => m.defaultPrevented)).toBe(true);
    plain.remove();
  });

  it("lets the training question scroll, and cancels the pull at its top", () => {
    show("lab_prerecord");
    const question = document.createElement("div");
    question.style.overflowY = "auto";
    const line = document.createElement("p");
    question.appendChild(line);
    host.appendChild(question);
    overflow(question, 300);
    expect(drag(line, 300, 340).some((m) => m.defaultPrevented)).toBe(false);
    expect(drag(line, 300, 260).some((m) => m.defaultPrevented)).toBe(false);
    // At its top a further pull down would reach the page: cancelled.
    overflow(question, 0);
    expect(drag(line, 300, 340).every((m) => m.defaultPrevented)).toBe(true);
    // Pushing up from the top still scrolls the question.
    expect(drag(line, 300, 260).some((m) => m.defaultPrevented)).toBe(false);
    question.remove();
  });

  it("takes the belt off again once the screen is left", () => {
    show("lab_prerecord");
    show("lab_session_context");
    const plain = document.createElement("div");
    host.appendChild(plain);
    expect(drag(plain, 100, 160).some((m) => m.defaultPrevented)).toBe(false);
    plain.remove();
  });
});
