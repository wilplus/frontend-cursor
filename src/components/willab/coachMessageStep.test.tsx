// @vitest-environment jsdom
/*
STORY    As a speaker, I want my coach's message to open only when I ask for
         it, with the words, the Take and the video, so that it never
         interrupts me.
OUTCOME
  O1  The message never opens by itself; Review feedback opens it with the
      coach's words, the Take number and the video.
  O2  The walk shows only the word of the Take on screen, never another
      Take's.
PROVES   O1 -> "never opens by itself (Q1); Review feedback shows the words, the Take and the video"
         O2 -> "is the Take's own word, never an earlier Take's"
WHY      Founder 2026-09-29, Q1 (Final Screens L8); founder 2026-10-20 and
         backend N77 (the word shows on its own Take only).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CoachStepLayer } from "./CoachMessageSheet";
import { useCoachStep } from "./useCoachStep";
import { ownCoachWord } from "./TranscriptReviewDeck";
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

/* The walk shows only this Take's coach word (founder 2026-10-20, "change
 * it!"; backend N77): a word for another Take opens nothing in this Take's
 * review; an earlier Take's word stays in the Lounge as its bubble. */
describe("the coach's word in a new Take's walk", () => {
  const word = { ...MSG, takeSessionId: "take-2" };
  it("is the Take's own word, never an earlier Take's", () => {
    expect(ownCoachWord(word, "take-2", 2)).toBe(word);
    expect(ownCoachWord(word, "take-3", 3)).toBeNull();
    // Without session ids, the Take's index decides.
    expect(ownCoachWord(MSG, null, 2)).toBe(MSG);
    expect(ownCoachWord(MSG, null, 3)).toBeNull();
    expect(ownCoachWord(null, "take-3", 3)).toBeNull();
  });
});
