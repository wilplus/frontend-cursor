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
import { LAB_FADE_IN_CLASS, useRecordingEntryFade } from "./labFade";
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

});

