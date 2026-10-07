// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  A SOFT 0.4 s FADE INTO AND OUT OF RECORDING MODE (build plan D-RC-7;       */
/*  walk lock 2026-10-06 "How screens move"; founder 2026-10-07, Q-B14 A (3)). */
/*                                                                            */
/*  Opening the Lab for a Take fades into the white screens; so does the      */
/*  text's "Record Take N" (readout -> lab_recording); closing the Lab fades  */
/*  back out. Instant with reduce motion.                                     */
/*                                                                            */
/*  LIVE LOOP: the fade never delays recording. `take_started` and            */
/*  `mic.start` are dispatched exactly as before, back to back, with nothing  */
/*  waiting in front of them; the fade is CSS on the screen that is already   */
/*  there, and the leaving veil takes no pointer events.                      */
/* -------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LAB_FADE_IN_CLASS, LAB_FADE_MS, LabFadeOut, useRecordingEntryFade } from "./labFade";
import type { WillabState } from "./useWillabFlow";

let root: Root;
let host: HTMLDivElement;

function reduceMotion(on: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({ matches: on && query.includes("reduce"), media: query }),
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  reduceMotion(false);
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

const veil = () => host.querySelector("[data-lab-fade-out]") as HTMLElement | null;

describe("the fade out, when the Lab closes", () => {
  it("draws nothing while the Lab is open, then a white veil that leaves after 0.4 s", () => {
    act(() => root.render(createElement(LabFadeOut, { open: true })));
    expect(veil()).toBeNull();
    act(() => root.render(createElement(LabFadeOut, { open: false })));
    const v = veil();
    expect(v).not.toBeNull();
    expect(v?.className).toContain("lab-fade-out");
    expect(v?.className).toContain("pointer-events-none");
    expect(v?.className).toContain("bg-background");
    expect(v?.getAttribute("aria-hidden")).toBe("true");
    act(() => vi.advanceTimersByTime(LAB_FADE_MS - 1));
    expect(veil()).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(veil()).toBeNull();
  });

  it("draws no veil when the Lab was never open", () => {
    act(() => root.render(createElement(LabFadeOut, { open: false })));
    expect(veil()).toBeNull();
  });

  it("is instant with reduce motion: no veil at all", () => {
    reduceMotion(true);
    act(() => root.render(createElement(LabFadeOut, { open: true })));
    act(() => root.render(createElement(LabFadeOut, { open: false })));
    expect(veil()).toBeNull();
  });
});

describe("the fade in, from the text into recording", () => {
  function Probe({ state }: { state: WillabState }) {
    return createElement("div", { "data-probe": "", className: useRecordingEntryFade(state) });
  }
  const cls = () => (host.querySelector("[data-probe]") as HTMLElement).className;
  const show = (state: WillabState) => act(() => root.render(createElement(Probe, { state })));

  it("fades the recording screens in on readout -> lab_recording, and only then", () => {
    show("readout");
    expect(cls()).toBe("");
    show("lab_recording");
    expect(cls()).toBe(LAB_FADE_IN_CLASS);
    show("lab_processing");
    expect(cls()).toBe("");
    show("readout");
    expect(cls()).toBe("");
  });

  it("does not fade again for a Take that opens the Lab afresh (the overlay's own fade covers it)", () => {
    show("lab_prerecord");
    show("lab_recording");
    expect(cls()).toBe("");
    show("lab_session_context");
    show("lab_recording");
    expect(cls()).toBe("");
  });

  it("the fade is 0.4 s and instant with reduce motion", () => {
    expect(LAB_FADE_MS).toBe(400);
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.lab-fade-in \{\s*animation: lab-fade-in 0\.4s ease both;/);
    expect(css).toMatch(/\.lab-fade-out \{\s*animation: lab-fade-out 0\.4s ease forwards;/);
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*\.lab-fade-in,\s*\.lab-fade-out \{\s*animation: none !important;/,
    );
  });
});

describe("LIVE LOOP: the fade never delays recording", () => {
  const LAB = readFileSync("src/components/willab/LabOverlay.tsx", "utf8");
  const SURFACE = readFileSync("src/components/willab/WillabSurface.tsx", "utf8");
  const FADE = readFileSync("src/components/willab/labFade.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("every take_started is followed at once by mic.start, with nothing waiting in front", () => {
    const starts = LAB.match(/dispatch\("take_started"\);/g) ?? [];
    expect(starts.length).toBe(5);
    expect(LAB.match(/dispatch\("take_started"\);\s*void mic\.start\(/g)?.length).toBe(5);
    // No timer, frame or animation wait anywhere near a start.
    for (const m of LAB.matchAll(/dispatch\("take_started"\);/g)) {
      const before = LAB.slice(Math.max(0, m.index! - 400), m.index);
      expect(before).not.toMatch(/setTimeout|requestAnimationFrame|animationend|LAB_FADE|await /);
    }
  });

  it("the fade is paint only: a class on the overlay and its column, a veil beside it", () => {
    expect(LAB).toMatch(/className=\{`\$\{LAB_FADE_IN_CLASS\} fixed inset-0 z-30 flex flex-col bg-background`\}/);
    expect(LAB).toMatch(/const recordingEntryFade = useRecordingEntryFade\(state\);/);
    expect(LAB).toMatch(/className=\{`\$\{labColumnClass\(state, mic\.state\.status\)\} \$\{recordingEntryFade\}`\}/);
    expect(SURFACE).toMatch(/<LabFadeOut open=\{flow\.labOverlayOpen\} \/>/);
    // The module never touches the mic, the flow or a timer that gates them.
    expect(FADE).not.toMatch(/mic\.|dispatch|take_started|onClose/);
  });

  it("the Lab's close is not held back for the fade", () => {
    const close = LAB.slice(LAB.indexOf("function handleClose()"), LAB.indexOf("return (", LAB.indexOf("function handleClose()")));
    expect(close).toMatch(/mic\.cancel\(\);\s*onClose\(\);/);
    expect(close).not.toMatch(/setTimeout|LAB_FADE/);
  });
});
