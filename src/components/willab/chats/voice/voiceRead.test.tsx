// @vitest-environment jsdom
/*
STORY    A volunteer sees the model's steps, and a locked step never
         shows a hidden score.
OUTCOME
  O1  The reading names each step and says a locked one is not clear
      enough yet.
PROVES   O1 -> "a locked step has no score"
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VoiceRead } from "@/components/willab/chats/voice/VoiceRead";
import type { AnalyzeTake } from "@/lib/willab/experiments/types";

const take = {
  take_id: "t1",
  prompt_tag: "challenging",
  order: ["engagement", "arousal", "valence", "clarity"],
  moments: [{ t_start: 0, t_end: 1, grid: [{ step: "arousal", cue: "loudness", value: null, vs: "baseline" }] }],
  summary: {
    engagement: { score: 0.2, confidence: 0.9, vs: "baseline", unlocked: true },
    arousal: { score: null, confidence: 0.2, vs: "baseline", unlocked: false, score_if_unlocked: 0.8 },
    valence: { score: null, confidence: 0.1, vs: "reference", unlocked: false },
    clarity: { score: null, confidence: 0.1, vs: "reference", unlocked: false },
  },
  gate: { step: "arousal", reason: "confidence too low" },
} as AnalyzeTake;

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("the voice reading", () => {
  it("a locked step has no score", () => {
    act(() => root.render(createElement(VoiceRead, { take, tips: [] })));
    const locked = container.querySelector("[data-voice-step='arousal']");
    expect(locked?.textContent).toContain("Not clear enough yet");
    expect(locked?.textContent).not.toContain("0.8");
    expect(container.querySelector("[data-voice-tip]")).toBeNull();
    act(() => root.render(createElement(VoiceRead, { take, tips: [{ id: "i1", name: "Join in", text: "Say one more sentence.", step: "engagement" }] })));
    expect(container.querySelector("[data-voice-tip]")?.textContent).toBe("Say one more sentence.");
    expect(container.textContent).not.toContain("2.0");
  });
});
