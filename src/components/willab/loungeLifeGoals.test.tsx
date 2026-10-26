// @vitest-environment jsdom
/*
STORY    As the founder, I want to set one life goal in the lens by answering one question at a time, so that the goal comes from my words and lands as a ladder in my chat.
OUTCOME
  O1  Start opens the lens with the paper-notebook line; the space, three open questions, Will's draft with my words, goal or want, ambitious, give up, the horizon and the quarter come one at a time, and the goal is set with its ladder and the line that sends me out to live it.
  O2  With every open question skipped, Will drafts nothing and says so.
  O3  A new goal that pulls against a kept one is asked "When they clash, which wins?" before it is set, and the answer is noted for both ladders (N185).
  O4  When the quarter comes back, Start asks "Did it move?" (never a score), what got in the way, shows my own notes that say it too, and asks for the next quarter's step (N186).
  O5  Under a note that sounds like a change, Change changes the goal the newest ask named, and the thread is read again (N190).
PROVES   O1 -> sets a goal from my answers, one step at a time
         O2 -> drafts nothing when I said nothing
         O3 -> asks which wins when two goals clash, before the new one is set
         O4 -> brings the quarter back: did it move, my notes, the next step
         O5 -> a note that sounds like a change: Change goes to the goal it asked about
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
  checkClash: vi.fn(),
  answerClash: vi.fn(),
  quarterDue: vi.fn(),
  answerQuarterAsk: vi.fn(),
  quarterNotes: vi.fn(),
  reviewQuarter: vi.fn(),
  answerNoteChange: vi.fn(),
}));
vi.mock("@/services/api/lifeGoals", () => api);

import { changeAskOf, useLifeGoals } from "./LoungeLifeGoals";

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
  api.checkClash.mockResolvedValue(null);
  api.quarterDue.mockResolvedValue(false);
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

  it("asks which wins when two goals clash, before the new one is set", async () => {
    const career = { id: "c1", space: "career", status: "active", ladder: { goal: GOAL, give: "My evenings." }, changes: {} };
    api.getLifeGoals.mockResolvedValue({ enabled: true, goals: [career], draft: null });
    api.checkClash.mockResolvedValue({
      with: "c1",
      line: "💼 Career will want your evenings. 🏡 Personal life gives up work after 7 pm.",
      options: [
        { wins: "g1", emoji: "🏡", label: "Personal life" },
        { wins: "c1", emoji: "💼", label: "Career" },
        { wins: "each_time", emoji: "⚖️", label: "I decide each time" },
      ],
    });
    api.answerClash.mockResolvedValue({ text: "🏡 Personal life wins", goal: {} });
    await act(async () => goals.openLens({ mode: "add", space: "personal" }));
    await settle();
    await tap("Yes, personal life");
    await type("Dinner with my family, every evening.");
    await tap("Skip");
    await tap("Skip");
    await tap("Accept");
    await tap("The long run");
    await tap("Yes");
    await type("Work after 7 pm.");
    await tap("1 year");
    await type("Home by 7, four nights a week.");
    expect(text()).toContain("When they clash, which wins?");
    expect(api.finishGoal).not.toHaveBeenCalled();
    await tap("Personal life");
    expect(api.answerClash).toHaveBeenCalledWith("g1", "c1", "g1");
    expect(text()).toContain("Noted. On both ladders: when they clash, personal life wins.");
    expect(api.finishGoal).toHaveBeenCalledWith("g1", null);
  });

  it("brings the quarter back: did it move, my notes, the next step", async () => {
    const career = {
      id: "c1",
      space: "career",
      status: "active",
      ladder: { goal: GOAL, quarter: { text: "Ten paying teams.", by: "31 December", asked: "2026-12-31" } },
      changes: {},
    };
    api.getLifeGoals.mockResolvedValue({ enabled: true, goals: [career], draft: null });
    api.quarterNotes.mockResolvedValue([{ text: "Too many late calls again.", on: "12 November" }]);
    api.reviewQuarter.mockResolvedValue({ ...career, ladder: { ...career.ladder, quarter: { text: "Twenty paying teams.", by: "31 March" } } });
    await act(async () => goals.openLens({ mode: "quarter", goalId: "c1" }));
    await settle();
    expect(text()).toContain("Did it move?");
    await tap("It moved");
    expect(text()).toContain("What got in the way?");
    await type("Late calls.");
    expect(api.quarterNotes).toHaveBeenCalledWith("c1", "Late calls.");
    expect(text()).toContain("Your notes said it too:");
    expect(text()).toContain("“Too many late calls again.”");
    expect(text()).toContain("What would move it forward by 31 March?");
    await type("Twenty paying teams.");
    expect(api.reviewQuarter).toHaveBeenCalledWith("c1", "moved", "Late calls.", "Twenty paying teams.");
    expect(text()).toContain("Noted.");
  });

  it("a note that sounds like a change: Change goes to the goal it asked about", async () => {
    api.answerNoteChange.mockResolvedValue(true);
    const rows = [
      { metadata: { offer: "life_goals_change", life_goal_change: "old" } },
      { metadata: { life_goal_change: "c1" } },
      { metadata: { offer: "life_goals_change", life_goal_change: "c1" } },
    ];
    await act(async () => goals.answerChange(changeAskOf(rows), "change"));
    await settle();
    expect(api.answerNoteChange).toHaveBeenCalledWith("c1", "change");
    expect(reload).toHaveBeenCalled();
  });
});
