// @vitest-environment jsdom
/* Step 0 of the Feedback sheet: the coach's overall message (founder
   2026-09-29, Q1; Final Screens L8). */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CoachStepLayer } from "./CoachMessageSheet";
import { useCoachStep } from "./useCoachStep";
import { type CoachMessage } from "@/services/api/idealText";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MSG: CoachMessage = {
  text: "Let the pause after doubled breathe.",
  videoUrl: "https://media/coach.mp4",
  takeIndex: 2,
  publishedAt: "2026-09-29T08:00:00Z",
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function Host({ message, next, ready = true, stepsAhead = 0 }: {
  message: CoachMessage | null; next: () => void; ready?: boolean; stepsAhead?: number;
}) {
  const step = useCoachStep({ arcId: "arc-1", message, ready, next });
  return createElement("div", null,
    createElement("button", { "data-review": true, onClick: () => { step.show(); } }, "review"),
    createElement(CoachStepLayer, { step, message, stepsAhead }));
}

const sheet = () => host.querySelector("[data-coach-message-step]");

describe("step 0", () => {
  it("never opens by itself (Q1); Review feedback shows the words, the Take and the video", () => {
    act(() => root.render(createElement(Host, { message: MSG, next: () => {} })));
    expect(sheet()).toBeNull();
    act(() => host.querySelector<HTMLButtonElement>("[data-review]")!.click());
    expect(sheet()).not.toBeNull();
    expect(sheet()?.textContent).toContain("Your coach");
    expect(sheet()?.textContent).toContain("Take 2");
    expect(sheet()?.textContent).toContain("Let the pause after doubled breathe.");
    expect(sheet()?.querySelector("video")?.getAttribute("src")).toBe(MSG.videoUrl);
  });
});

