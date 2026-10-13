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
    strip: null,
    onFinish: () => undefined,
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

});

/* "Getting your mic ready" before a later Take (build plan D-RC-3): the
   Lab's own no-pull rule covers lab_prerecord too, root and belt, and the
   belt is worn for the whole span (recording screens lock: never a reload). */
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

  // iOS before 16 ignores the root property: the mic wait and the processing
  // screen have no gesture hook, so the Lab's belt must cancel the pull.
  it("cancels a pull down on the mic wait and the processing screen", () => {
    show("lab_recording", "idle");
    expect(drag(host, 100, 160).every((m) => m.defaultPrevented)).toBe(true);
    show("lab_processing");
    expect(drag(host, 100, 160).every((m) => m.defaultPrevented)).toBe(true);
    show("lab_session_context");
    expect(drag(host, 100, 160).some((m) => m.defaultPrevented)).toBe(false);
  });
});
