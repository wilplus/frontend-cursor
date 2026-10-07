// @vitest-environment jsdom
/* The recording screen while recording (founder lock 2026-10-07):
   - only the slide and its helper words move; the top bar's "Take · Slide"
     line, the slide dots and the strip stay still and are never re-mounted
     during a slide change;
   - the keyboard works with no click first;
   - the wheel moves a slide at 140, or 90 that rests, and swallows the
     momentum tail. */
import { act, createElement, Fragment, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdfSlides", () => ({
  PdfPage: () => null,
  MockPresentationSlide: () => null,
  SlideRender: ({ pageIndex }: { pageIndex: number }) =>
    createElement("div", { "data-testid": "slide" }, `page ${pageIndex + 1}`),
}));

import { RecordingPhase, RecordingWhere, labColumnClass } from "./LabOverlay";
import { resetSharedWheel } from "./useRecordingGestures";

let root: Root;
let host: HTMLDivElement;
let seen: number[] = [];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  resetSharedWheel();
  seen = [];
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
      onStop: () => undefined,
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

function wheel(deltaY: number) {
  const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

const where = () => host.querySelector('[data-testid="recording-where"]')!;
const scroller = () => host.querySelector<HTMLElement>('[aria-label^="Speaking anchors"]')!;

/** Every element of the still frame, captured by identity. */
function frame() {
  return {
    topBar: host.querySelector('[data-testid="top-bar"]')!,
    where: where(),
    rail: host.querySelector('nav[aria-label="Presentation slide position"]')!,
    dots: Array.from(host.querySelectorAll('nav[aria-label="Presentation slide position"] button')),
    strip: host.querySelector('[data-testid="recording-strip"]')!,
    finish: host.querySelector('button[aria-label="Finish take"]')!,
  };
}

describe("the top bar", () => {
  it("reads Take N · Slide n of m, and nothing above the slide repeats it", () => {
    render();
    expect(where().textContent).toBe("Take 2 · Slide 1 of 3");
    expect(host.querySelectorAll('[data-testid="recording-where"]').length).toBe(1);
    expect(host.textContent).not.toMatch(/Recording/);
  });

  it("is an empty slot before the recording screen (learning screen, mic ready)", () => {
    act(() =>
      root.render(
        createElement(RecordingWhere, {
          show: true,
          micStatus: "idle",
          takeNumber: 1,
          slide: 0,
          slideCount: 3,
        }),
      ),
    );
    expect(host.textContent).toBe("");
  });
});

describe("the strip and the dots, as the prototype draws them (build plan D-RC-2)", () => {
  it("sits 20px off the bottom on the recording screen only", () => {
    const rec = labColumnClass("lab_recording", "recording").split(" ");
    expect(rec).toContain("pb-5");
    expect(rec).not.toContain("pb-8");
    for (const [state, mic] of [
      ["lab_recording", "idle"],
      ["lab_prerecord", "idle"],
      ["lab_session_context", "idle"],
      ["lab_processing", "stopped"],
      ["readout", "stopped"],
    ] as const) {
      const cls = labColumnClass(state, mic).split(" ");
      expect(cls).toContain("pb-8");
      expect(cls).not.toContain("pb-5");
    }
  });

  it("does not grow Finish take on hover; its stop square is 12px with 2px corners", () => {
    render();
    const { finish } = frame();
    expect(finish.className).not.toMatch(/hover:/);
    expect(finish.className).not.toMatch(/scale/);
    const square = finish.querySelector('[data-testid="finish-square"]')!;
    expect(square.className.split(" ")).toEqual(
      expect.arrayContaining(["h-3", "w-3", "rounded-[2px]", "bg-current"]),
    );
    expect(finish.querySelector("svg")).toBeNull();
  });

  it("animates the dots' height in 200ms, with no hover colour", () => {
    render();
    const marks = frame().dots.map((b) => b.querySelector("span")!.className);
    expect(marks).toHaveLength(3);
    for (const cls of marks) {
      expect(cls).toMatch(/transition-\[height\] duration-200/);
      expect(cls).not.toMatch(/hover:/);
    }
  });
});

describe("the still frame", () => {
  it("keeps the top bar, the dots and the strip through a slide change", () => {
    render();
    const before = frame();
    key("ArrowDown");
    expect(seen).toEqual([1]);
    const after = frame();
    expect(after.topBar).toBe(before.topBar);
    expect(after.where).toBe(before.where);
    expect(after.rail).toBe(before.rail);
    expect(after.dots).toEqual(before.dots);
    expect(after.strip).toBe(before.strip);
    expect(after.finish).toBe(before.finish);
    for (const el of [after.where, after.rail, after.strip]) {
      expect(el.isConnected).toBe(true);
    }
    // Only the text and the current dot changed.
    expect(after.where.textContent).toBe("Take 2 · Slide 2 of 3");
    expect(after.dots[1].getAttribute("aria-current")).toBe("step");
    expect(after.dots[0].hasAttribute("aria-current")).toBe(false);
    expect(host.querySelector('[data-testid="slide"]')!.textContent).toBe("page 2");
    expect(host.textContent).toContain("words for slide 2");
  });

  it("moves only the slide and its helper words while a slide glides", () => {
    // Motion on: a real glide, out in 200ms and landing in 420ms.
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    render();
    act(() => {
      vi.advanceTimersByTime(500); // the entrance lands
    });
    const before = frame();
    const slideBox = host.querySelector('[data-testid="slide"]')!.closest(".shrink-0") as HTMLElement;
    const words = scroller();
    key("ArrowDown");
    // Gliding out: the content moves up and fades; the frame does not move.
    expect(slideBox.style.transform).toMatch(/translateY\(-/);
    expect(words.style.transform).toMatch(/translateY\(-/);
    expect(slideBox.style.transition).toContain("200ms");
    for (const el of [before.topBar, before.where, before.rail, before.strip]) {
      expect((el as HTMLElement).style.transform).toBe("");
    }
    expect(seen).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Swapped in place, landing from below on the locked curve.
    expect(seen).toEqual([1]);
    expect(host.querySelector('[data-testid="slide"]')!.closest(".shrink-0")).toBe(slideBox);
    expect(scroller()).toBe(words);
    expect(slideBox.style.transition).toContain("420ms cubic-bezier(.16,1,.3,1)");
    expect(slideBox.style.transform).toBe("translateY(0px)");
    // A second press while it lands is not a second move.
    key("ArrowDown");
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(seen).toEqual([1]);
    const after = frame();
    expect(after.where).toBe(before.where);
    expect(after.rail).toBe(before.rail);
    expect(after.strip).toBe(before.strip);
  });
});

describe("the keyboard, with no click first", () => {
  it("↓ Page Down Space go forward; ↑ Page Up go back", () => {
    render();
    key("ArrowDown");
    key("PageDown");
    expect(seen).toEqual([1, 2]);
    key(" "); // the last slide: nowhere to go
    expect(seen).toEqual([1, 2]);
    key("ArrowUp");
    key("PageUp");
    expect(seen).toEqual([1, 2, 1, 0]);
    key(" ");
    expect(seen).toEqual([1, 2, 1, 0, 1]);
  });

  it("Enter does not move a slide while recording", () => {
    render();
    const event = key("Enter");
    expect(event.defaultPrevented).toBe(false);
    expect(seen).toEqual([]);
  });

  it("leaves fields, shortcuts and the Discard dialog alone", () => {
    render();
    const input = document.createElement("textarea");
    document.body.appendChild(input);
    key("ArrowDown", {}, input);
    key("ArrowDown", { metaKey: true });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    document.body.appendChild(dialog);
    key("ArrowDown");
    key(" ", {}, dialog);
    expect(seen).toEqual([]);
    dialog.remove();
    input.remove();
    key("ArrowDown");
    expect(seen).toEqual([1]);
  });

  it("scrolls long helper words first, then moves from their edge", () => {
    render();
    const sc = scroller();
    Object.defineProperty(sc, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(sc, "clientHeight", { configurable: true, value: 200 });
    sc.scrollTop = 0;
    key("ArrowDown");
    expect(seen).toEqual([]);
    expect(sc.scrollTop).toBeGreaterThan(0);
    sc.scrollTop = 800; // at their end
    key("ArrowDown");
    expect(seen).toEqual([1]);
  });
});

describe("the wheel", () => {
  it("moves at 140, swallows the tail, and moves again after a quiet 450ms", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    render();
    expect(wheel(100).defaultPrevented).toBe(true);
    expect(seen).toEqual([]);
    wheel(40);
    expect(seen).toEqual([1]);
    // The momentum tail, 16ms apart, for over a second: ignored.
    for (let i = 0; i < 70; i += 1) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
      wheel(Math.max(2, 80 - i));
    }
    expect(seen).toEqual([1]);
    act(() => {
      vi.advanceTimersByTime(460);
    });
    wheel(150);
    expect(seen).toEqual([1, 2]);
  });

  it("moves at 90 once the wheel rests 220ms, and not below", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    render();
    wheel(80);
    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(seen).toEqual([]);
    wheel(60);
    wheel(35);
    act(() => {
      vi.advanceTimersByTime(219);
    });
    expect(seen).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(seen).toEqual([1]);
  });
});
