// @vitest-environment jsdom
/*
STORY    As a speaker, I want to write my why, my vision and how I want to treat people once in my own words, and see one of them each day, so that I remember why I do this.
OUTCOME
  O1  Start opens the lens; three questions come one at a time, each with Skip; Will drafts each line only from my words and quotes them; Accept or my own words keep it, and "Noted. Your why is set." (backend N255 Q1, Q2).
  O2  The day's why's › opens that line as it is now; my change is kept, dated (Q6).
PROVES   O1 -> sets my why from my answers, one question at a time
         O2 -> the day's why opens its line to change it
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getYourWhy: vi.fn(),
  yourWhyToday: vi.fn(),
  answerYourWhyAsk: vi.fn(),
  draftYourWhy: vi.fn(),
  saveYourWhy: vi.fn(),
  changeYourWhy: vi.fn(),
  WHY_LINES: ["why", "vision", "treat"],
}));
vi.mock("@/services/api/yourWhy", () => api);
vi.mock("@/services/api/lifeGoals", () => ({ transcribeAnswer: vi.fn() }));

import { useYourWhy } from "./LoungeYourWhy";

let container: HTMLDivElement;
let root: Root;
let why: ReturnType<typeof useYourWhy>;
const reload = vi.fn(async () => undefined);

function Harness() {
  why = useYourWhy({ signedIn: true, reload });
  return why.lens;
}

const SET = { why: "Speaking changed my life.", vision: null, treat: "With patience." };

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  api.getYourWhy.mockResolvedValue({ enabled: true, lines: { why: null, vision: null, treat: null }, set_on: null, changes: {} });
  api.yourWhyToday.mockResolvedValue(false);
  api.answerYourWhyAsk.mockResolvedValue(true);
  api.saveYourWhy.mockResolvedValue(true);
  api.draftYourWhy.mockResolvedValue({
    why: { line: "Speaking changed my life.", quote: "it changed my life" },
    vision: null,
    treat: { line: "With patience, every time.", quote: "patience" },
  });
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

async function type(words: string, keep = "Next") {
  const field = document.querySelector("textarea");
  if (!field) throw new Error(`no field in: ${text()}`);
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    set?.call(field, words);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await tap(keep);
}

describe("your why lens", () => {
  it("sets my why from my answers, one question at a time", async () => {
    await act(async () => why.answerAsk("start"));
    await settle();
    expect(api.answerYourWhyAsk).toHaveBeenCalledWith("start");
    expect(text()).toContain("Why do you do this?");
    expect(text()).not.toContain("What do you see when it works?");
    await type("Because it changed my life");
    expect(text()).toContain("What do you see when it works?");
    await tap("Skip");
    await type("With patience");
    expect(api.draftYourWhy).toHaveBeenCalledWith({ why: "Because it changed my life", vision: null, treat: "With patience" });
    expect(text()).toContain("Will's draft, from your words:");
    expect(text()).toContain("From: “it changed my life”");
    await tap("Accept");
    await tap("Edit");
    await type("With patience.", "Keep this line");
    expect(api.saveYourWhy).toHaveBeenCalledWith({ why: "Speaking changed my life.", treat: "With patience." });
    expect(text()).toContain("Noted. Your why is set.");
    expect(text()).toContain("It will be here each day, the first time you open the app.");
    expect(reload).toHaveBeenCalled();
  });

  it("the day's why opens its line to change it", async () => {
    api.getYourWhy.mockResolvedValue({ enabled: true, lines: SET, set_on: "2026-10-28", changes: {} });
    api.changeYourWhy.mockResolvedValue({ enabled: true, lines: { ...SET, why: "Speaking set me free." }, set_on: "2026-10-28", changes: {} });
    await act(async () => why.openLens({ mode: "change", line: "why" }));
    await settle();
    expect(text()).toContain("Now: Speaking changed my life.");
    expect(text()).toContain("What should it say?");
    await type("Speaking set me free.", "Keep the change");
    expect(api.changeYourWhy).toHaveBeenCalledWith("why", "Speaking set me free.");
    expect(text()).toContain("Noted. Changed on");
    expect(text()).toContain("Speaking set me free.");
  });
});
