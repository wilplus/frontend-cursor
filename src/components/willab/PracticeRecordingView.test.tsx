// @vitest-environment jsdom
/* While a practice attempt records, the sheet shows a recording screen
   (founder 2026-09-28: "when you hit record no new screen appears"). */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PracticeRecordingView from "./PracticeRecordingView";

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("the practice recording screen", () => {
  it("keeps the coach's words and says which attempt, with a running clock", () => {
    act(() => {
      root.render(createElement(PracticeRecordingView, {
        instruction: "Slow down on the last word.", attempt: 2,
      }));
    });
    expect(host.textContent).toContain("Slow down on the last word.");
    expect(host.textContent).toContain("Attempt 2 · 0:00");
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(host.textContent).toContain("Attempt 2 · 0:04");
  });

  it("draws no empty box for a video-only exercise", () => {
    act(() => {
      root.render(createElement(PracticeRecordingView, { instruction: "", attempt: 1 }));
    });
    expect(host.querySelectorAll(".rounded-2xl.border").length).toBe(0);
  });
});
