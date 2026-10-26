// @vitest-environment jsdom
/*
STORY    As the founder, I want my life goals ladders on top of the Life Panel's Goals screen, with every version dated, so that my goals and my three bets are in one place.
OUTCOME
  O1  With a set goal, "Life goals" shows its ladder, "Set on {date}" and History, which lists every version newest first with its date; a tapped step opens the lens on that step.
  O2  Before the first goal is set, nothing new shows.
  O3  While a plan runs, the career ladder shows THIS WEEK with the plan's level, as a plain row, never a step to change.
PROVES   O1 -> shows my ladders with every version dated
         O2 -> shows nothing before my first goal
         O3 -> shows this week's level from my plan, read-only
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getLifeGoals: vi.fn(),
  quarterDue: vi.fn(),
}));
vi.mock("@/services/api/lifeGoals", () => api);

import LifeGoalsLadders from "./LifeGoalsLadders";

let container: HTMLDivElement;
let root: Root;

const CAREER = {
  id: "c1",
  space: "career",
  status: "active",
  ladder: { goal: "Make WillpowerLab the place people learn to speak with confidence.", quarter: { text: "Five teams.", by: "31 December" } },
  changes: { quarter: { on: "2026-11-05", earlier: "Ten paying teams." } },
  set_on: "2026-10-26",
  history: [{ on: "2026-11-05", step: "quarter", before: "Ten paying teams.", after: "Five teams." }],
};

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const text = () => document.body.textContent ?? "";

async function mount() {
  await act(async () => root.render(createElement(LifeGoalsLadders)));
  await act(async () => undefined);
}

describe("life goals on the Goals screen", () => {
  it("shows my ladders with every version dated", async () => {
    api.getLifeGoals.mockResolvedValue({ enabled: true, goals: [CAREER], draft: null });
    await mount();
    expect(text()).toContain("Life goals");
    expect(text()).toContain("Five teams.");
    expect(text()).toContain("Set on 26 October");
    expect(text()).not.toContain("Hide history");
    const history = [...document.querySelectorAll("button")].find((b) => b.textContent === "History");
    await act(async () => history?.click());
    expect(text()).toContain("5 November");
    expect(text()).toContain("This quarter: Five teams. Earlier: Ten paying teams.");
    expect(api.quarterDue).not.toHaveBeenCalled(); // the quarter comes back in the Lounge only
  });

  it("shows nothing before my first goal", async () => {
    api.getLifeGoals.mockResolvedValue({ enabled: true, goals: [], draft: null });
    await mount();
    expect(container.textContent).toBe("");
  });

  it("shows this week's level from my plan, read-only", async () => {
    api.getLifeGoals.mockResolvedValue({ enabled: true, goals: [{ ...CAREER, week: "Let your key line land" }], draft: null });
    await mount();
    expect(text()).toContain("THIS WEEK");
    expect(text()).toContain("from your practice");
    const buttons = [...document.querySelectorAll("button")].map((b) => b.textContent ?? "");
    expect(buttons.some((b) => b.includes("Let your key line land"))).toBe(false);
    expect(text()).toContain("Let your key line land");
  });
});
