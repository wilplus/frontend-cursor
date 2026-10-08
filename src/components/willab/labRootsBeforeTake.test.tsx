// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  Take 2 starts once its helper words are read (build plan D-RC-4).         */
/*                                                                            */
/*  A later Take used to start the instant its setup arrived, so its helper   */
/*  words landed a moment after the first slide, and the read was dropped    */
/*  and started again on the move from "Getting your mic ready" to the        */
/*  recording screen. The start now waits for the setup AND the words' read, */
/*  capped at 1.5 s: after that the Take starts anyway (LIVE LOOP: recording  */
/*  is never blocked by the words). Take 1 has no words and does not wait.   */
/*                                                                            */
/*  The host here is LabOverlay's wiring in miniature, with the real hook,    */
/*  the real auto-start and the real recording phase: the entry state keeps  */
/*  "entering" true from lab_prerecord to lab_recording, as LabOverlay does. */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
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
import { forgetLabHandover, primeLabRoots } from "@/lib/willab/labEntryHandover";
import { ROOTS_WAIT_CAP_MS, useRecordingRoots } from "./useRecordingRoots";

const SLIDES = [0, 1].map((i) => ({ title: `Slide ${i + 1}`, body: "" })) as never[];
const READY = {
  kind: "ready",
  roots: [{ partId: "p1", slideIndex: 0, text: "Open with the one idea", type: "flagship" }],
  documentSnapshotId: "snap",
  documentSnapshotSha256: "a".repeat(64),
};

let root: Root;
let host: HTMLDivElement;
let startedAt: number | null;
/** Each render of the recording screen: was the slide there, and its words? */
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

function record() {
  if (!host.querySelector('[data-testid="slide"]')) return;
  frames.push({
    slide: true,
    words: (host.textContent ?? "").includes("Open with the one idea"),
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
  it("mounts the words with the first slide when the read is slow", async () => {
    api.fetchRecordingRoots.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(READY), 800)),
    );
    act(() => root.render(createElement(Host, { takeIndex: 2 })));
    await flush();
    await advance(799);
    expect(startedAt).toBeNull();
    expect(host.querySelector('[data-testid="slide"]')).toBeNull();
    await advance(1);
    expect(startedAt).toBe(800);
    expect(frames.length).toBeGreaterThan(0);
    // The very first frame with the slide already carries its words.
    expect(frames[0]).toEqual({ slide: true, words: true });
    // One read, never dropped and started again by the move into recording.
    expect(api.fetchRecordingRoots).toHaveBeenCalledTimes(1);
  });

  it("still starts within 1.5 s when the read fails every time", async () => {
    api.fetchRecordingRoots.mockResolvedValue({ kind: "error" });
    act(() => root.render(createElement(Host, { takeIndex: 2 })));
    await flush();
    for (let t = 0; t < ROOTS_WAIT_CAP_MS && startedAt === null; t += 50) {
      await advance(50);
    }
    expect(startedAt).not.toBeNull();
    expect(startedAt!).toBeLessThanOrEqual(ROOTS_WAIT_CAP_MS);
    // The bounded retry: the first read and two more.
    expect(api.fetchRecordingRoots).toHaveBeenCalledTimes(3);
    expect(host.querySelector('[data-testid="slide"]')).not.toBeNull();
  });

  it("starts at 1.5 s when the read never answers, and the words join later", async () => {
    let answer: (value: unknown) => void = () => undefined;
    api.fetchRecordingRoots.mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    act(() => root.render(createElement(Host, { takeIndex: 2 })));
    await flush();
    await advance(ROOTS_WAIT_CAP_MS - 1);
    expect(startedAt).toBeNull();
    await advance(1);
    expect(startedAt).toBe(ROOTS_WAIT_CAP_MS);
    expect(host.querySelector('[data-testid="slide"]')).not.toBeNull();
    expect(host.textContent).not.toContain("Open with the one idea");
    answer(READY);
    await flush();
    expect(host.textContent).toContain("Open with the one idea");
    expect(api.fetchRecordingRoots).toHaveBeenCalledTimes(1);
  });

  it("leaves Take 1 alone: no read and no wait", async () => {
    act(() => root.render(createElement(Host, { takeIndex: 1 })));
    await flush();
    expect(startedAt).toBe(0);
    expect(api.fetchRecordingRoots).not.toHaveBeenCalled();
  });
});

describe("the Ideal Text page's words start the Take at once (P2)", () => {
  it("starts with no wait on the words the page just read, and still reads behind", async () => {
    primeLabRoots("arc-1", READY.roots as never);
    let answer: (value: unknown) => void = () => undefined;
    api.fetchRecordingRoots.mockImplementation(
      () => new Promise((resolve) => (answer = resolve)),
    );
    act(() => root.render(createElement(Host, { takeIndex: 2 })));
    await flush();
    record();
    expect(startedAt).toBe(0);
    expect(frames[0]).toEqual({ slide: true, words: true });
    // The read behind still runs, and its newer answer replaces the words.
    expect(api.fetchRecordingRoots).toHaveBeenCalledTimes(1);
    answer({ ...READY, roots: [{ partId: "p1", slideIndex: 0, text: "A newer lock", type: "flagship" }] });
    await flush();
    expect(host.textContent).toContain("A newer lock");
    expect(host.textContent).not.toContain("Open with the one idea");
  });

  it("waits for its own read as before when the page handed nothing over", async () => {
    primeLabRoots("another-arc", READY.roots as never);
    api.fetchRecordingRoots.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(READY), 800)),
    );
    act(() => root.render(createElement(Host, { takeIndex: 2 })));
    await flush();
    await advance(799);
    expect(startedAt).toBeNull();
    await advance(1);
    expect(startedAt).toBe(800);
  });
});

describe("LabOverlay waits on the read it keeps", () => {
  const HOST = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");
  it("hands the auto-start the read's answer", () => {
    const prerecord = HOST.slice(HOST.indexOf('{state === "lab_prerecord" && ('));
    const block = prerecord.slice(0, prerecord.indexOf("</TrainingAskGate>"));
    expect(block).toMatch(/rootsSettled=\{rootsSettled\}/);
    expect(HOST).toMatch(/settled: rootsSettled \} = useRecordingRoots\(/);
  });
});
