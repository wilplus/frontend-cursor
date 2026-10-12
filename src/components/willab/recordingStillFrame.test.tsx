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

import { RecordingPhase, RecordingWhere, labColumnClass } from "./LabOverlay";

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
const scroller = () => host.querySelector<HTMLElement>('[aria-label^="Speaking anchors"]')!;

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

  it("is an empty slot before the recording screen (mic ready)", () => {
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

describe("the strip, as the prototype draws it (build plan D-RC-2)", () => {
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

  it("has no slide dots and no Finish take in the strip", () => {
    render();
    expect(host.querySelector('nav[aria-label="Presentation slide position"]')).toBeNull();
    expect(button("Finish take")).toBeUndefined();
  });
});

describe("Back and Next slide (N70)", () => {
  it("move one slide each way; Back is greyed on the first slide", () => {
    render();
    expect(button("Back")!.disabled).toBe(true);
    click("Next slide");
    expect(seen).toEqual([1]);
    expect(button("Back")!.disabled).toBe(false);
    click("Back");
    expect(seen).toEqual([1, 0]);
  });

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
    click("Next slide");
    // Gliding out to the left and fading; the frame does not move.
    expect(slideBox.style.transform).toMatch(/translateX\(-/);
    expect(words.style.transform).toMatch(/translateX\(-/);
    expect(slideBox.style.transition).toContain("200ms");
    for (const el of [before.topBar, before.where, before.strip]) {
      expect((el as HTMLElement).style.transform).toBe("");
    }
    expect(seen).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // Swapped in place, landing from the right on the locked curve.
    expect(seen).toEqual([1]);
    expect(host.querySelector('[data-testid="slide"]')!.closest(".shrink-0")).toBe(slideBox);
    expect(scroller()).toBe(words);
    expect(slideBox.style.transition).toContain("420ms cubic-bezier(.16,1,.3,1)");
    expect(slideBox.style.transform).toBe("translateX(0px)");
    // A second press while it lands is not a second move.
    key("ArrowDown");
    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(seen).toEqual([1]);
    const after = frame();
    expect(after.where).toBe(before.where);
    expect(after.strip).toBe(before.strip);
  });
});

describe("the keyboard, with no click first", () => {
  it("← → change the slide, and never end the Take at the last slide (N70.1)", () => {
    render();
    key("ArrowRight");
    key("ArrowRight");
    expect(seen).toEqual([1, 2]);
    key("ArrowRight");
    key(" ");
    expect(seen).toEqual([1, 2]);
    expect(stops).toBe(0);
    key("ArrowLeft");
    expect(seen).toEqual([1, 2, 1]);
  });

  it("leaves Space to a focused button, but still moves on ← →", () => {
    render();
    const next = button("Next slide")!;
    expect(key(" ", {}, next).defaultPrevented).toBe(false);
    expect(seen).toEqual([]);
    key("ArrowRight", {}, next);
    expect(seen).toEqual([1]);
  });

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
