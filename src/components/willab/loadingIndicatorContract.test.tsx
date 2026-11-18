// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import LoadingState, { LoadingBubble } from "./LoadingState";
import ProcessingWait from "./ProcessingWait";
import TypingDots from "./TypingDots";
import WalkLoading from "./walk/WalkLoading";

/*
STORY As a speaker, I want one centered loading indicator to stay in place while my Take moves through processing phases, so that the wait does not jump, duplicate or disappear.
OUTCOME O1  Generic full-surface waits render one stable frame and one circular three-dot bubble.
O2  Analysis to document assembly reuses the same processing presentation, bubble and progress rail.
O3  Inline chat typing dots remain a separate response bubble and do not become a page loader.
PROVES LoadingState, ProcessingWait and TypingDots keep the canonical page/response distinction.
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
    expect(surface?.querySelectorAll("[data-loading-bubble]")).toHaveLength(1);
    expect(surface?.querySelectorAll("[data-loading-dot]")).toHaveLength(3);
    expect(surface?.querySelector('[data-loading-label]')?.textContent).toBe(
      "Getting your mic ready",
    );
  });

  it("keeps the same processing presentation, indicator and rail across phases", () => {
    mount(
      createElement(ProcessingWait, {
        phase: "analysis",
        progress: { stage: "transcribing", percent: 42 },
        cycleStartedAt: 100,
      }),
    );

    const firstSurface = host.querySelector("[data-processing-wait]");
    const firstIndicator = firstSurface?.querySelector("[data-voice-mark]");
    const firstFrame = firstSurface?.querySelector('[role="progressbar"]');
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

    const nextSurface = host.querySelector("[data-processing-wait]");
    expect(nextSurface).toBe(firstSurface);
    expect(nextSurface?.querySelector('[role="progressbar"]')).toBe(firstFrame);
    expect(nextSurface?.querySelector("[data-voice-mark]")).toBe(firstIndicator);
    expect(nextSurface?.querySelectorAll("[data-voice-mark]")).toHaveLength(1);
    expect(nextSurface?.querySelectorAll("[data-loading-bubble]")).toHaveLength(1);
    expect(nextSurface?.querySelectorAll("[data-loading-dot]")).toHaveLength(3);
  });

  it("keeps the three-dot bubble as the smallest shared primitive", () => {
    mount(createElement(LoadingBubble, { size: 64 }));
    expect(host.querySelectorAll("[data-loading-bubble]")).toHaveLength(1);
    expect(host.querySelectorAll("[data-loading-dot]")).toHaveLength(3);
  });

  it("uses the full-surface bubble for a walk wait, not a bottom-corner response bubble", () => {
    mount(createElement(WalkLoading));
    expect(host.querySelector("[data-walk-loading] [data-loading-surface]")).not.toBeNull();
    expect(host.querySelectorAll("[data-walk-loading] [data-loading-bubble]")).toHaveLength(1);
    expect(host.querySelectorAll("[data-walk-loading] [data-loading-dot]")).toHaveLength(3);
    expect(host.querySelector("[data-walk-loading] [data-typing-dots]")).toBeNull();
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
