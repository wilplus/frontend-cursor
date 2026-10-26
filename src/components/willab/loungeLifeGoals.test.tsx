// @vitest-environment jsdom
/*
STORY    As the founder, I want to set one life goal in the lens by answering one question at a time, so that the goal comes from my words and lands as a ladder in my chat.
OUTCOME
  O1  Start opens the lens with the paper-notebook line; the space, three open questions, Will's draft with my words, goal or want, ambitious, give up, the horizon and the quarter come one at a time, and the goal is set with its ladder and the line that sends me out to live it.
  O2  With every open question skipped, Will drafts nothing and says so.
PROVES   O1 -> sets a goal from my answers, one step at a time
         O2 -> drafts nothing when I said nothing
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getLifeGoals: vi.fn(),
  answerLifeGoalsAsk: vi.fn(),
  draftGoal: vi.fn(),
  redraftGoal: vi.fn(),
  saveDraft: vi.fn(),
  finishGoal: vi.fn(),
  changeStep: vi.fn(),
  transcribeAnswer: vi.fn(),
}));
vi.mock("@/services/api/lifeGoals", () => api);

import { useLifeGoals } from "./LoungeLifeGoals";

let container: HTMLDivElement;
let root: Root;
let goals: ReturnType<typeof useLifeGoals>;
const reload = vi.fn(async () => undefined);

function Harness() {
  goals = useLifeGoals({ signedIn: true, reload });
  return goals.lens;
}

const GOAL = "Make WillpowerLab the place people learn to speak with confidence.";

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  api.getLifeGoals.mockResolvedValue({ enabled: true, goals: [], draft: null });
  api.answerLifeGoalsAsk.mockResolvedValue(true);
  api.saveDraft.mockImplementation(async (id, space, ladder) => ({ id: "g1", space, status: "draft", ladder, changes: {} }));
  api.draftGoal.mockResolvedValue({ goal: GOAL, quotes: ["the place people learn to speak"] });
  api.finishGoal.mockImplementation(async () => [
    { body: "ladder", metadata: { life_goal: { id: "g1", space: "career", status: "active", ladder: { goal: GOAL }, changes: {} } } },
  ]);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Harness)));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const text = () => document.body.textContent ?? "";

async function settle() {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
  }
}

async function tap(label: string) {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(label));
  if (!button) throw new Error(`no button "${label}" in: ${text()}`);
  await act(async () => button.click());
  await settle();
}

async function type(words: string) {
  const field = document.querySelector("textarea");
  if (!field) throw new Error(`no field in: ${text()}`);
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    set?.call(field, words);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await tap("Next");
}

describe("life goals lens", () => {
  it("sets a goal from my answers, one step at a time", async () => {
    await act(async () => goals.answerAsk("start"));
    await settle();
    expect(api.answerLifeGoalsAsk).toHaveBeenCalledWith("start");
    expect(text()).toContain("📓 Use your notebook!");
    expect(text()).toContain("Which matters most right now?");
    await tap("Career");
    expect(text()).toContain("What do you truly want most in your career?");
    await type("To make WillpowerLab the place people learn to speak with confidence.");
    await tap("Skip");
    await type("I don't give up.");
    expect(text()).toContain("Will's draft, from your words:");
    expect(text()).toContain("From: “the place people learn to speak”");
    await tap("Accept");
    await tap("The long run");
    await tap("Yes");
    expect(text()).toContain("What will you give up for it?");
    await tap("Skip");
    await tap("1 year");
    expect(text()).toMatch(/What must be true by \d+ \w+, \w+ weeks from now\?/);
    await type("Ten paying teams.");
    expect(api.finishGoal).toHaveBeenCalledWith("g1", null);
    expect(text()).toContain("Noted. Your career goal is set.");
    expect(text()).toContain("That's the base. Now go and live it. Come back for a short recap.");
    expect(reload).toHaveBeenCalled();
  });

  it("drafts nothing when I said nothing", async () => {
    await act(async () => goals.openLens({ mode: "add", space: "personal" }));
    await settle();
    await tap("Yes, personal life");
    await tap("Skip");
    await tap("Skip");
    await tap("Skip");
    expect(text()).toContain("I have nothing of yours to draft from yet. Let's do this another time.");
    expect(api.draftGoal).not.toHaveBeenCalled();
    expect(api.finishGoal).not.toHaveBeenCalled();
  });
});
