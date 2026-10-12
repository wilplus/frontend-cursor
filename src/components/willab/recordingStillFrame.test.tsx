// @vitest-environment jsdom
/* The recording screen while recording (founder lock 2026-10-12, N70):
   - Back and Next slide change the slide; on the last slide Next slide is
     the red Finish take, the only way a Take ends here;
   - only the slide and its helper words move, sideways; the top bar's
     "Take · Slide" line, the strip and the buttons stay still;
   - the keys work with no click first, never end a Take, and never take
     the Space that presses a focused button. */
import { act, createElement, Fragment, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdfSlides", () => ({
  PdfPage: () => null,
  MockPresentationSlide: () => null,
  SlideRender: ({ pageIndex }: { pageIndex: number }) =>
    createElement("div", { "data-testid": "slide" }, `page ${pageIndex + 1}`),
}));

import { RecordingPhase, RecordingWhere } from "./LabOverlay";

let root: Root;
let host: HTMLDivElement;
let seen: number[] = [];
let stops = 0;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  seen = [];
  stops = 0;
  host = document.createElement("div");
  document.body.appendChild(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const SLIDES = [0, 1, 2].map((i) => ({ title: `Slide ${i + 1}`, body: "" })) as never[];
const ROOTS = [0, 1, 2].map((slideIndex) => ({
  slideIndex,
  text: `words for slide ${slideIndex + 1}`,
  type: "flagship" as const,
}));

/** The overlay's frame, mirrored: the header with the top line and the ✕,
 *  then the recording phase. The slide setter records every change, as
 *  LabOverlay's selectSlide timestamps it. */
function Screen() {
  const [slide, setSlide] = useState(0);
  return createElement(
    Fragment,
    null,
    createElement(
      "header",
      { "data-testid": "top-bar" },
      createElement(RecordingWhere, {
        show: true,
        micStatus: "recording",
        takeNumber: 2,
        slide,
        slideCount: SLIDES.length,
      }),
      createElement("button", { type: "button", "aria-label": "Close" }),
    ),
    createElement(RecordingPhase, {
      micState: { status: "recording", partialText: "" },
      elapsed: 12,
      targetSec: 300,
      rejectedMsg: null,
      uploadRetry: null,
      onStop: () => {
        stops += 1;
      },
      onRecordAgain: () => undefined,
      slides: SLIDES,
      presentationRef: null,
      currentSlide: slide,
      roots: ROOTS,
      onSlideChange: (next: number) => {
        seen.push(next);
        setSlide(next);
      },
    } as never),
  );
}

function render() {
  act(() => root.render(createElement(Screen)));
}

function key(k: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

const where = () => host.querySelector('[data-testid="recording-where"]')!;

/** Every element of the still frame, captured by identity. */
function frame() {
  return {
    topBar: host.querySelector('[data-testid="top-bar"]')!,
    where: where(),
    strip: host.querySelector('[data-testid="recording-strip"]')!,
    back: button("Back"),
  };
}

function button(name: string) {
  return Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  ) as HTMLButtonElement | undefined;
}

function click(name: string) {
  act(() => button(name)!.click());
}

describe("the top bar", () => {
  it("reads Take N · Slide n of m, and nothing above the slide repeats it", () => {
    render();
    expect(where().textContent).toBe("Take 2 · Slide 1 of 3");
    expect(host.querySelectorAll('[data-testid="recording-where"]').length).toBe(1);
    expect(host.textContent).not.toMatch(/Recording/);
  });
});

describe("Back and Next slide (N70)", () => {

  it("turns Next slide into the red Finish take on the last slide, which ends the Take", () => {
    render();
    click("Next slide");
    click("Next slide");
    expect(button("Next slide")).toBeUndefined();
    const finish = button("Finish take")!;
    expect(finish.className).toMatch(/bg-record/);
    expect(finish.querySelector('[data-testid="finish-square"]')).not.toBeNull();
    expect(stops).toBe(0);
    click("Finish take");
    expect(stops).toBe(1);
  });
});

describe("the still frame", () => {
  it("keeps the top bar, the strip and the buttons through a slide change", () => {
    render();
    const before = frame();
    key("ArrowDown");
    expect(seen).toEqual([1]);
    const after = frame();
    expect(after.topBar).toBe(before.topBar);
    expect(after.where).toBe(before.where);
    expect(after.strip).toBe(before.strip);
    expect(after.back).toBe(before.back);
    expect(after.where.textContent).toBe("Take 2 · Slide 2 of 3");
    expect(host.querySelector('[data-testid="slide"]')!.textContent).toBe("page 2");
    expect(host.textContent).toContain("words for slide 2");
  });
});
