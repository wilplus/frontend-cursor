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

});

