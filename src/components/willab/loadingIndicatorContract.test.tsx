// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import LoadingState from "./LoadingState";
import ProcessingWait from "./ProcessingWait";
import TypingDots from "./TypingDots";

/*
STORY As a speaker, I want one centered loading indicator to stay in place while my Take moves through processing phases, so that the wait does not jump, duplicate or disappear.
OUTCOME O1  Generic full-surface waits render one frame and one indicator.
O2  Analysis to document assembly reuses the same processing frame and DOM indicator, with a fixed value slot.
O3  Inline chat typing dots remain a separate bubble and do not become a page loader.
PROVES LoadingState, ProcessingWait and TypingDots share the canonical loading contract without changing their intended surfaces.
WHY A visible loading jump interrupts the record → process → Ideal Text loop; this protects the locked wait and the intentional chat feedback separately.
*/

let host: HTMLDivElement;
let root: Root;

function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(node));
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

describe("full-surface loading indicator contract", () => {
  it("has one centered frame and one indicator for a generic wait", () => {
    mount(
      createElement(LoadingState, {
        placement: "surface",
        label: "Getting your mic ready",
        labelVisible: true,
      }),
    );

    const surface = host.querySelector('[data-loading-surface="generic"]');
    expect(surface).not.toBeNull();
    expect(surface?.getAttribute("data-loading-placement")).toBe("surface");
    expect(surface?.querySelectorAll("[data-loading-frame]")).toHaveLength(1);
    expect(surface?.querySelectorAll("[data-loading-indicator]")).toHaveLength(1);
    expect(surface?.querySelectorAll("[data-voice-mark]")).toHaveLength(1);
    expect(surface?.querySelector('[data-loading-label]')?.textContent).toBe(
      "Getting your mic ready",
    );
  });

  it("keeps the same processing frame and indicator across analysis and document phases", () => {
    mount(
      createElement(ProcessingWait, {
        phase: "analysis",
        progress: { stage: "transcribing", percent: 42 },
        cycleStartedAt: 100,
      }),
    );

    const firstSurface = host.querySelector('[data-loading-surface="processing"]');
    const firstIndicator = firstSurface?.querySelector("[data-loading-indicator]");
    const firstFrame = firstSurface?.querySelector("[data-loading-frame]");
    expect(firstSurface).not.toBeNull();
    expect(firstIndicator).not.toBeNull();
    expect(firstFrame).not.toBeNull();

    act(() =>
      root.render(
        createElement(ProcessingWait, {
          phase: "document",
          progress: { stage: "document_assembly", percent: null },
          cycleStartedAt: 100,
        }),
      ),
    );

    const nextSurface = host.querySelector('[data-loading-surface="processing"]');
    expect(nextSurface).toBe(firstSurface);
    expect(nextSurface?.querySelector("[data-loading-frame]")).toBe(firstFrame);
    expect(nextSurface?.querySelector("[data-loading-indicator]")).toBe(firstIndicator);
    expect(nextSurface?.querySelectorAll("[data-loading-indicator]")).toHaveLength(1);
    expect(nextSurface?.querySelector('[role="progressbar"]')?.getAttribute("aria-label")).toBe(
      "Building your Ideal Text",
    );
  });

  it("keeps the progress value slot dimensioned while the value changes", () => {
    mount(
      createElement(ProcessingWait, {
        progress: { stage: "processing_recording", percent: null },
        cycleStartedAt: 100,
      }),
    );

    expect(host.querySelector("[data-loading-percent]")?.className).toContain("w-[3ch]");
    expect(host.querySelector("[data-loading-content]")?.querySelector(".min-h-6")).not.toBeNull();
  });
});

describe("inline chat wait distinction", () => {
  it("keeps typing dots as an inline bubble, outside the full-surface contract", () => {
    mount(createElement(TypingDots, { label: "Will is replying" }));

    expect(host.querySelector("[data-typing-dots]")).not.toBeNull();
    expect(host.querySelector("[data-typing-glyph]")).not.toBeNull();
    expect(host.querySelector("[data-loading-surface]")).toBeNull();
    expect(host.querySelector("[data-loading-indicator]")).toBeNull();
  });
});
