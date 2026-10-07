// @vitest-environment jsdom
/* Take 1's learning screen (founder lock 2026-10-07): no slide, no clock, no
   Finish take; "Scroll down to start" on a phone, the arrow keys with "Click
   down to start" on a desktop; a swipe, a scroll, ↓, Page Down, Space or
   Enter starts the recording. It replaces the first-time "Scroll down" hint
   that was remembered per device. */
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdfSlides", () => ({
  PdfPage: () => null,
  MockPresentationSlide: () => null,
  SlideRender: () => createElement("div", { "data-testid": "slide" }),
}));

import { RecordingPhase, labColumnClass, showsMicWait } from "./LabOverlay";
import { resetSharedWheel } from "./useRecordingGestures";

let root: Root;
let host: HTMLDivElement;
let begun = 0;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  resetSharedWheel();
  begun = 0;
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
});

const SLIDES = [0, 1, 2].map((i) => ({ title: `Slide ${i + 1}`, body: "" })) as never[];

function render(over: Record<string, unknown> = {}) {
  act(() => {
    root.render(
      createElement(RecordingPhase, {
        micState: { status: "idle" },
        armed: true,
        onBegin: () => {
          begun += 1;
        },
        elapsed: 0,
        targetSec: 300,
        rejectedMsg: null,
        uploadRetry: null,
        onStop: () => undefined,
        onRecordAgain: () => undefined,
        slides: SLIDES,
        presentationRef: null,
        currentSlide: 0,
        roots: [],
        onSlideChange: () => undefined,
        ...over,
      } as never),
    );
  });
}

function key(k: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function touch(type: string, clientY: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientY }],
  });
  act(() => {
    document.body.dispatchEvent(event);
  });
  return event;
}

describe("the learning screen", () => {
  it("shows the two signed lines and nothing of the recording screen", () => {
    render();
    expect(host.textContent).toContain("Scroll down to start");
    expect(host.textContent).toContain("Click down to start");
    expect(host.querySelector('[data-testid="slide"]')).toBeNull();
    expect(host.textContent).not.toContain("Finish take");
    expect(host.querySelector(".tabular-nums")).toBeNull();
    expect(host.querySelector('nav[aria-label="Presentation slide position"]')).toBeNull();
    // The phone line shows on coarse pointers only; the keys on the rest.
    expect(host.innerHTML).toContain("[@media(pointer:coarse)]:flex");
    expect(host.innerHTML).toContain("[@media(pointer:coarse)]:hidden");
    expect(host.innerHTML).toContain("motion-safe:animate-nudge");
  });

  it("is not shown while the mic is still opening: Getting your mic ready", () => {
    render({ armed: false });
    expect(host.textContent).toContain("Getting your mic ready");
    expect(host.textContent).not.toContain("Scroll down to start");
  });

  it.each(["ArrowDown", "PageDown", " ", "Enter"])(
    "starts the recording on %j, with no click first",
    (k) => {
      render();
      const event = key(k);
      expect(event.defaultPrevented).toBe(true);
      expect(begun).toBe(1);
    },
  );

  it("does not start on ↑, Page Up or another key", () => {
    render();
    key("ArrowUp");
    key("PageUp");
    key("a");
    expect(begun).toBe(0);
  });

  it("starts once, however many keys arrive", () => {
    render();
    key("ArrowDown");
    key("Enter");
    expect(begun).toBe(1);
  });

  it("does not take a key typed into a field", () => {
    render();
    const input = document.createElement("input");
    document.body.appendChild(input);
    key("Enter", input);
    key(" ", input);
    expect(begun).toBe(0);
    input.remove();
  });

  it("starts on a swipe of 90px, not on a shorter one", () => {
    render();
    touch("touchstart", 500);
    touch("touchmove", 440);
    touch("touchend", 440);
    expect(begun).toBe(0);
    touch("touchstart", 500);
    const move = touch("touchmove", 410);
    touch("touchend", 410);
    expect(move.defaultPrevented).toBe(true);
    expect(begun).toBe(1);
  });

  it("starts on a wheel push of 140, or of 90 that rests 220ms", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    render();
    const wheel = (deltaY: number) => {
      const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true });
      act(() => {
        window.dispatchEvent(event);
      });
      return event;
    };
    expect(wheel(70).defaultPrevented).toBe(true);
    act(() => {
      vi.advanceTimersByTime(220);
    });
    // 70 is under the soft 90: it sprang back.
    expect(begun).toBe(0);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    wheel(50);
    wheel(45);
    expect(begun).toBe(0);
    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(begun).toBe(1);
  });

  it("starts on a click or tap of the screen", () => {
    render();
    const start = host.querySelector<HTMLButtonElement>('button[aria-label="Start recording"]')!;
    act(() => start.click());
    expect(begun).toBe(1);
  });

  it("gives way to the recording screen once the recording has begun", () => {
    render();
    key("ArrowDown");
    render({ micState: { status: "recording", partialText: "" }, armed: false });
    expect(host.textContent).not.toContain("Scroll down to start");
    expect(host.querySelector('[data-testid="slide"]')).not.toBeNull();
    expect(host.textContent).toContain("Finish take");
  });
});

describe("the retired first-time hint", () => {
  it("is gone, with its per-device memory", () => {
    const roadmap = readFileSync("src/components/willab/RecordingRoadmap.tsx", "utf8");
    expect(roadmap).not.toMatch(/scrollHintSeen|NextSlideHint|"Scroll down"/);
  });
});

describe("the learning screen and the mic waits keep the prototype's 24px top gap (build plan D-RC-1)", () => {
  const top = (cls: string) => cls.split(" ").filter((c) => /^pt-/.test(c));

  it("is pt-0 only while the mic records", () => {
    expect(top(labColumnClass("lab_recording", "recording"))).toEqual(["pt-0"]);
    // Take 1's learning screen and the mic still opening: mic idle.
    expect(top(labColumnClass("lab_recording", "idle"))).toEqual(["pt-6"]);
    // "Getting your mic ready" before a later Take.
    expect(top(labColumnClass("lab_prerecord", "idle"))).toEqual(["pt-6"]);
    expect(top(labColumnClass("lab_prerecord", "stopped"))).toEqual(["pt-6"]);
    expect(top(labColumnClass("lab_recording", "error"))).toEqual(["pt-6"]);
  });

  it("shows one mic wait from lab_prerecord through the mic opening", () => {
    // Before a later Take, once the training question is out of the way.
    expect(showsMicWait("lab_prerecord", true, "stopped", false, null)).toBe(true);
    expect(showsMicWait("lab_prerecord", false, "stopped", false, null)).toBe(false);
    // The same wait while getUserMedia resolves on the recording screen.
    expect(showsMicWait("lab_recording", true, "idle", false, null)).toBe(true);
    // Not the learning screen, not the recording, not a rejected take.
    expect(showsMicWait("lab_recording", true, "idle", true, null)).toBe(false);
    expect(showsMicWait("lab_recording", true, "recording", false, null)).toBe(false);
    expect(showsMicWait("lab_recording", true, "idle", false, "Too short")).toBe(false);
  });

  it("draws nothing while the host draws the wait", () => {
    render({ armed: false, micWaitShownByHost: true });
    expect(host.textContent).not.toContain("Getting your mic ready");
    expect(host.textContent).not.toContain("Scroll down to start");
    expect(host.childElementCount).toBe(0);
  });
});

