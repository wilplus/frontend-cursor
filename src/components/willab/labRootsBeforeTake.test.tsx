// @vitest-environment jsdom
/*
STORY    As a speaker, I want Take 2 to start with its helper words already on
         the first slide, but never wait more than 1.5 s for them, so that
         recording is never blocked.
OUTCOME
  O1  A good read: the Take starts as soon as the words are read, and the
      very first frame of the recording screen already shows them.
  O2  Never 3 (record -> process -> Ideal Text -> next Take is never broken):
      when the read fails every time, the Take still starts within 1.5 s,
      after the first read and two retries.
  O3  Take 1 has no helper words, does not read them, and starts at once.
PROVES   O1 -> "a good read shows the words on the first frame"
         O2 -> "still starts within 1.5 s when the read fails every time"
         O3 -> "Take 1 starts at once, without a read"
WHY      Build plan D-RC-4: the words used to land a moment after the first
         slide. The host is LabOverlay's wiring in miniature (real hook, real
         auto-start, real recording phase).
*/
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ fetchRecordingRoots: vi.fn() }));
vi.mock("@/services/api/idealText", () => api);
vi.mock("./pdfSlides", () => ({
  PdfPage: () => null,
  MockPresentationSlide: () => null,
  SlideRender: ({ pageIndex }: { pageIndex: number }) =>
    createElement("div", { "data-testid": "slide" }, `page ${pageIndex + 1}`),
}));

import { ContinuedTakeAutoStart, RecordingPhase } from "./LabOverlay";
import { forgetLabHandover } from "@/lib/willab/labEntryHandover";
import { ROOTS_WAIT_CAP_MS, useRecordingRoots } from "./useRecordingRoots";

const WORDS = "Open with the one idea";
const SLIDES = [0, 1].map((i) => ({ title: `Slide ${i + 1}`, body: "" })) as never[];

let root: Root;
let host: HTMLDivElement;
let startedAt: number | null;
/** Each look at the recording screen: was the slide there, and its words? */
let frames: Array<{ slide: boolean; words: boolean }>;

function Host({ takeIndex }: { takeIndex: number }) {
  const [phase, setPhase] = useState<"prerecord" | "recording">("prerecord");
  const { roots, settled } = useRecordingRoots({
    arcId: "arc-1",
    initArc: null,
    takeIndex,
    signedIn: true,
    // lab_prerecord and lab_recording are both "entering" recording.
    entering: true,
  });
  if (phase === "prerecord") {
    return createElement(ContinuedTakeAutoStart, {
      ready: true,
      rootsSettled: settled,
      onStart: () => {
        startedAt = Date.now();
        setPhase("recording");
      },
    });
  }
  return createElement(RecordingPhase, {
    micState: { status: "recording", partialText: "" },
    elapsed: 0,
    targetSec: 300,
    rejectedMsg: null,
    uploadRetry: null,
    onStop: () => undefined,
    onRecordAgain: () => undefined,
    slides: SLIDES,
    presentationRef: null,
    currentSlide: 0,
    roots,
    onSlideChange: () => undefined,
  } as never);
}

const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
  record();
}

async function mount(takeIndex: number) {
  act(() => root.render(createElement(Host, { takeIndex })));
  await flush();
  record();
}

function record() {
  if (!host.querySelector('[data-testid="slide"]')) return;
  frames.push({
    slide: true,
    words: (host.textContent ?? "").includes(WORDS),
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(0);
  api.fetchRecordingRoots.mockReset();
  forgetLabHandover();
  startedAt = null;
  frames = [];
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

describe("a later Take waits for its helper words, never more than 1.5 s", () => {

  it("still starts within 1.5 s when the read fails every time", async () => {
    api.fetchRecordingRoots.mockResolvedValue({ kind: "error" });
    await mount(2);
    for (let t = 0; t < ROOTS_WAIT_CAP_MS && startedAt === null; t += 50) {
      await advance(50);
    }
    expect(startedAt).not.toBeNull();
    expect(startedAt!).toBeLessThanOrEqual(ROOTS_WAIT_CAP_MS);
    // The bounded retry: the first read and two more.
    expect(api.fetchRecordingRoots).toHaveBeenCalledTimes(3);
    expect(host.querySelector('[data-testid="slide"]')).not.toBeNull();
  });

  it("a good read shows the words on the first frame", async () => {
    api.fetchRecordingRoots.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ kind: "ready", roots: [{ slideIndex: 0, text: WORDS, type: "flagship" }] }),
            300,
          ),
        ),
    );
    await mount(2);
    // Waiting for the read: not started, no recording screen yet.
    expect(startedAt).toBeNull();
    for (let t = 0; t < ROOTS_WAIT_CAP_MS && startedAt === null; t += 50) {
      await advance(50);
    }
    expect(startedAt).toBe(300);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0]).toEqual({ slide: true, words: true });
    expect(api.fetchRecordingRoots).toHaveBeenCalledTimes(1);
  });

  it("Take 1 starts at once, without a read", async () => {
    await mount(1);
    expect(startedAt).toBe(0);
    expect(host.querySelector('[data-testid="slide"]')).not.toBeNull();
    expect(api.fetchRecordingRoots).not.toHaveBeenCalled();
  });
});
