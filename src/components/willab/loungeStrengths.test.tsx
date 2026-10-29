// @vitest-environment jsdom
/*
STORY    As a speaker, I want Will to show me a strength my notes keep showing, and keep it only in words I accept, so that I go on stage remembering what I am good at.
OUTCOME
  O1  Look opens the lens: the notes it came from with their days, "Will suggests a strength:", then Accept, Edit or Not now; Accept or my own words keep it ("Noted. Added to your strengths.") (backend N241 N2).
  O2  Not now on the ask keeps nothing and opens nothing (N2).
  O3  "That's your 💪 … again." takes me to that strength on the Life Panel (N3).
PROVES   O1 -> Look shows the notes, and I keep the strength in my words
         O2 -> Not now keeps nothing
         O3 -> the strength again links to the Life Panel
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  strengthsToday: vi.fn(),
  getSuggestion: vi.fn(),
  answerStrengthAsk: vi.fn(),
  decideStrength: vi.fn(),
}));
vi.mock("@/services/api/lifeStrengths", () => api);
vi.mock("@/services/api/lifeGoals", () => ({ transcribeAnswer: vi.fn() }));

import { StrengthAgainBubble, strengthAskOf, useStrengths } from "./LoungeStrengths";

let container: HTMLDivElement;
let root: Root;
let strengths: ReturnType<typeof useStrengths>;
const reload = vi.fn(async () => undefined);

function Harness() {
  strengths = useStrengths({ signedIn: true, reload });
  return strengths.lens;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  api.strengthsToday.mockResolvedValue(false);
  api.answerStrengthAsk.mockResolvedValue(true);
  api.decideStrength.mockResolvedValue(true);
  api.getSuggestion.mockResolvedValue({
    id: "s1",
    title: "Calm when it goes wrong",
    status: "suggested",
    notes: [
      { body: "Client shouted. I stayed calm", on: "2026-10-26", on_label: "26 October", label: null },
      { body: "The demo crashed and I kept talking", on: "2026-10-28", on_label: "28 October", label: null },
    ],
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

const ASK = [{ metadata: { strength_step: "head", strength_id: "s1" } }, { metadata: { offer: "strengths", strength_id: "s1" } }];

describe("strengths lens", () => {
  it("Look shows the notes, and I keep the strength in my words", async () => {
    await act(async () => strengths.answerAsk(strengthAskOf(ASK), "look"));
    await settle();
    expect(api.getSuggestion).toHaveBeenCalledWith("s1");
    expect(text()).toContain("From your notes:");
    expect(text()).toContain("“The demo crashed and I kept talking”28 October");
    expect(text()).toContain("Will suggests a strength:");
    expect(text()).toContain("💪 Calm when it goes wrong");
    await tap("Edit");
    const field = document.querySelector("textarea");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(field, "Steady under fire");
      field?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await tap("Add strength");
    expect(api.decideStrength).toHaveBeenCalledWith("s1", "edit", "Steady under fire");
    expect(text()).toContain("Noted. Added to your strengths.");
    expect(reload).toHaveBeenCalled();
  });

  it("Not now keeps nothing", async () => {
    await act(async () => strengths.answerAsk(strengthAskOf(ASK), "not_now"));
    await settle();
    expect(api.answerStrengthAsk).toHaveBeenCalledWith("s1", "not_now");
    expect(api.getSuggestion).not.toHaveBeenCalled();
    expect(api.decideStrength).not.toHaveBeenCalled();
  });

  it("the strength again links to the Life Panel", async () => {
    await act(async () =>
      root.render(createElement(StrengthAgainBubble, { body: "That's your 💪 Calm when it goes wrong again.", strengthId: "s1" })),
    );
    const link = document.querySelector("a[data-strength-again]");
    expect(link?.getAttribute("href")).toBe("/panel/strengths?open=s1");
    expect(link?.textContent).toContain("That's your 💪 Calm when it goes wrong again.");
  });
});
