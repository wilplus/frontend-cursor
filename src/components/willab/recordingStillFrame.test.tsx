// @vitest-environment jsdom
/*
STORY    As a speaker recording, I want the top bar to read "Take N · Slide n
         of m", Back and Next slide to move slides, Finish take on the last
         slide to be the only way to end, and only the slide to move, so
         that recording feels steady and I never end a Take by accident.
OUTCOME
  O1  The top bar reads "Take 2 · Slide 1 of 3", once; a question to
      someone (N483 item 4) reads "To Sarah · Slide 1 of 3".
  O2  On the last slide Next slide becomes the red Finish take, which ends
      the Take.
  O3  Space after clicking Back goes forward, not Back again.
  O4  The top bar, the strip and the buttons stay put when the slide
      changes; only the slide and its helper words change.
  O5  An answer (N441): the top bar is the person's name alone, its one
      slide is drawn as "{name} asks" over the question, and Finish take
      stands alone in the row; it has no five-minute cap (N486 item 4), so
      half an hour in, it is still recording until Finish take.
  O6  A chosen fragment keeps its original deck pages and helper words;
      Back and keyboard navigation cannot leave it; Finish take ends it.
  O7  Whole-presentation rehearsal starts on slide 1 and can pass five minutes.
PROVES   O1 -> "reads Take N · Slide n of m, and nothing above the slide repeats it"
         O2 -> "turns Next slide into the red Finish take on the last slide, which ends the Take"
         O3 -> "goes forward, never presses the clicked Back again"
         O4 -> "keeps the top bar, the strip and the buttons through a slide change"
         O5 -> "an answer: the name alone, the asker on its one slide, Finish take alone, no five-minute cap"
         O6 -> "as a speaker repeating slides 2–3, I stay within that fragment and finish on its last slide"
         O7 -> "as a speaker rehearsing the whole presentation after Take 1, I start on slide 1 and can record beyond five minutes"
WHY      Founder lock 2026-10-12 (N70); locked recording screen.
*/
import { act, createElement, Fragment, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdfSlides", () => ({
  PdfPage: () => null,
  MockPresentationSlide: () => null,
  SlideRender: ({ pageIndex, asks, title }: { pageIndex: number; asks?: string | null; title: string }) =>
    createElement("div", { "data-testid": "slide", "data-asks": asks ?? "", "data-title": title }, `page ${pageIndex + 1}`),
}));

import { RecordingPhase, RecordingWhere, usePracticeChunkEnds } from "./LabOverlay";
import { practiceSlideRange, readPracticeResume, writePracticeResume, type PracticeResumeSelection } from "@/lib/willab/practiceResume";

let root: Root;
let host: HTMLDivElement;
let seen: number[] = [];
let stops = 0;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  document.documentElement.lang = "en";
  delete document.documentElement.dataset.uiLocale;
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
  document.documentElement.lang = "";
  delete document.documentElement.dataset.uiLocale;
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
function Screen({ selection = null, elapsed = 12, slides = SLIDES }: { selection?: PracticeResumeSelection | null; elapsed?: number; slides?: typeof SLIDES }) {
  const [slide, setSlide] = useState(() => practiceSlideRange(selection, slides.length).first);
  usePracticeChunkEnds(true, "lab_recording", "recording", elapsed, () => { stops += 1; }, selection);
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
        slideCount: slides.length,
      }),
      createElement("button", { type: "button", "aria-label": "Close" }),
    ),
    createElement(RecordingPhase, {
      micState: { status: "recording", partialText: "" },
      elapsed,
      targetSec: 300,
      rejectedMsg: null,
      uploadRetry: null,
      onStop: () => {
        stops += 1;
      },
      onRecordAgain: () => undefined,
      slides,
      presentationRef: null,
      currentSlide: slide,
      practiceSelection: selection,
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
    // A question to someone names them in its place.
    act(() => root.render(createElement(RecordingWhere, { show: true, micStatus: "recording", to: "Sarah", takeNumber: 1, slide: 0, slideCount: 3 })));
    expect(where().textContent).toBe("To Sarah · Slide 1 of 3");
  });

  it("uses the Polish app locale for chrome and leaves the speaker's slide words alone", () => {
    document.documentElement.lang = "pl";
    render();

    expect(where().textContent).toBe("Nagranie 2 · Slajd 1 z 3");
    expect(button("Wstecz")).toBeDefined();
    expect(button("Następny slajd")).toBeDefined();
    expect(host.querySelector('[data-testid="slide"]')?.getAttribute("data-title")).toBe("Slide 1");

    click("Następny slajd");
    click("Następny slajd");
    expect(button("Zakończ nagranie")).toBeDefined();
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

describe("Space after a mouse click (keys lock N70.1)", () => {
  it("goes forward, never presses the clicked Back again", () => {
    render();
    click("Next slide");
    click("Next slide");
    const back = button("Back")!;
    // A mouse click focuses the button first (Chrome, Firefox); detail 1.
    back.focus();
    act(() => {
      back.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    });
    expect(seen).toEqual([1, 2, 1]);
    key(" ", {}, document.activeElement ?? document.body);
    expect(seen).toEqual([1, 2, 1, 2]);
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

describe("the five-minute presentation-practice chunk", () => {
  it("as a speaker repeating slides 2–3, I stay within that fragment and finish on its last slide", () => {
    vi.useFakeTimers();
    writePracticeResume("u", "a", { scope: "fragment", startSlide: 2, endSlide: 3 });
    const selection = readPracticeResume("u", "a");
    const slides = [...SLIDES, { title: "Outside fragment", body: "" }] as typeof SLIDES;
    act(() => root.render(createElement(Screen, { selection, slides })));
    expect(where().textContent).toBe("Take 2 · Slide 2 of 4");
    expect(button("Back")!.disabled).toBe(true);
    key("ArrowLeft");
    act(() => vi.advanceTimersByTime(1000));
    expect(seen).toEqual([]);
    click("Next slide");
    act(() => vi.advanceTimersByTime(1000));
    expect(seen).toEqual([2]);
    expect(where().textContent).toBe("Take 2 · Slide 3 of 4");
    expect(host.querySelector('[data-testid="slide"]')!.textContent).toBe("page 3");
    expect(host.textContent).toContain("words for slide 3");
    expect(button("Next slide")).toBeUndefined();
    key("ArrowRight");
    act(() => vi.advanceTimersByTime(1000));
    expect(seen).toEqual([2]);
    expect(stops).toBe(0);
    click("Finish take");
    expect(stops).toBe(1);
  });

  it("as a speaker rehearsing the whole presentation after Take 1, I start on slide 1 and can record beyond five minutes", () => {
    vi.useFakeTimers();
    writePracticeResume("u", "a", { scope: "whole" });
    const selection = readPracticeResume("u", "a");
    act(() => root.render(createElement(Screen, { selection, elapsed: 601 })));
    expect(where().textContent).toBe("Take 2 · Slide 1 of 3");
    expect(stops).toBe(0);
    click("Next slide");
    act(() => vi.advanceTimersByTime(1000));
    click("Next slide");
    act(() => vi.advanceTimersByTime(1000));
    expect(seen).toEqual([1, 2]);
    click("Finish take");
    expect(stops).toBe(1);
  });

  it("stops a presentation practice at five minutes without capping an answer", () => {
    function Cap({ enabled, elapsed }: { enabled: boolean; elapsed: number }) {
      usePracticeChunkEnds(enabled, "lab_recording", "recording", elapsed, () => {
        stops += 1;
      });
      return null;
    }
    act(() => root.render(createElement(Cap, { enabled: true, elapsed: 299 })));
    expect(stops).toBe(0);
    act(() => root.render(createElement(Cap, { enabled: true, elapsed: 300 })));
    expect(stops).toBe(1);
    act(() => root.render(createElement(Cap, { enabled: false, elapsed: 1800 })));
    expect(stops).toBe(1);
  });
});

describe("an answer (N441)", () => {
  it("an answer: the name alone, the asker on its one slide, Finish take alone, no five-minute cap", () => {
    const question = [{ title: "Would the scalp treatment help?", body: "" }] as never[];
    const elapsed = 1800;
    function Answer() {
      return createElement(
        Fragment,
        null,
        createElement(RecordingWhere, { show: true, micStatus: "recording", who: "Sarah", takeNumber: 1, slide: 0, slideCount: 1 }),
        createElement(RecordingPhase, {
          micState: { status: "recording", partialText: "" },
          elapsed,
          targetSec: null,
          rejectedMsg: null,
          uploadRetry: null,
          onStop: () => undefined,
          onRecordAgain: () => undefined,
          slides: question,
          presentationRef: null,
          currentSlide: 0,
          roots: [],
          onSlideChange: () => undefined,
          asks: "Sarah",
        } as never),
      );
    }
    act(() => root.render(createElement(Answer)));
    expect(where().textContent).toBe("Sarah");
    expect(host.querySelector('[data-testid="slide"]')?.getAttribute("data-asks")).toBe("Sarah");
    expect(button("Back")).toBeUndefined();
    expect(button("Finish take")).toBeDefined();
    expect(stops).toBe(0);
  });

  it("an answer to their Take: the name and Slide n of m, the Take's own slides, no asker on them (N493 item 1)", () => {
    const slides = [{ title: "Hook", body: "" }, { title: "The cities", body: "" }] as never[];
    function Answer() {
      return createElement(
        Fragment,
        null,
        createElement(RecordingWhere, { show: true, micStatus: "recording", of: "Amira", takeNumber: 1, slide: 0, slideCount: 2 }),
        createElement(RecordingPhase, {
          micState: { status: "recording", partialText: "" },
          elapsed: 12,
          targetSec: null,
          rejectedMsg: null,
          uploadRetry: null,
          onStop: () => undefined,
          onRecordAgain: () => undefined,
          slides,
          presentationRef: null,
          currentSlide: 0,
          roots: [],
          onSlideChange: () => undefined,
          asks: null,
        } as never),
      );
    }
    act(() => root.render(createElement(Answer)));
    expect(where().textContent).toBe("Amira · Slide 1 of 2");
    expect(host.querySelector('[data-testid="slide"]')?.getAttribute("data-asks") ?? "").toBe("");
    expect(button("Next slide")).toBeDefined();
  });
});
