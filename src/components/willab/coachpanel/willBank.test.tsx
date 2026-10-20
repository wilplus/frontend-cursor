// @vitest-environment jsdom
/*
STORY    As the founder, I want to change Will's questions and fill empty
         slots from the coach panel, so that Will asks my words from the
         next Take without a code change.
OUTCOME
  O1  My queue has one row under the blind lists, "Will's questions", with
      how many questions and empty slots; another coach's queue has none.
  O2  The row opens the questions in their groups; I change a question or a
      tap answer, or fill an empty slot, and Save sends only what changed;
      a refusal shows the backend's sentence and keeps my words.
PROVES   O1 -> "the founder's queue has Will's questions under the blind lists; a coach's has none"
         O2 -> "Save sends only what changed, an empty slot takes a question, and a refusal says why"
WHY      Founder 2026-10-20 (N83): "show me where would you add it in the
         coach panel … below the users"; prototype
         https://claude.ai/artifact/WLZ1KY6dX1RBLXiNU73F9N, "OK".
*/
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueueScreen } from "./CoachPanelScreens";
import { WillBankScreen } from "./WillBankScreen";
import { panelReducer, type PanelState } from "@/lib/willab/coachPanel";
import { COACH_PANEL_COPY as COPY } from "@/lib/willab/coachPanelCopy";
import type { WillBank } from "@/services/api/willBank";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const BANK: WillBank = {
  questions: 2,
  empty: 1,
  groups: [
    { label: "Who it's for", items: [{
      key: "audience_check", when: "The Take names it twice", question: "Sounds like this one's for {the board}. Right? 🎯",
      chips: ["Yes", "Someone else"], ownWords: false, empty: false, asked: 14 }] },
    { label: "Deeper, from Take 3", items: [
      { key: "most_you", when: "Basics known", question: "Which part of this talk is most you?", chips: [], ownWords: true, empty: false, asked: 1 },
      { key: "slot_1", when: "Basics known", question: "", chips: [], ownWords: true, empty: true, asked: 0 }] },
  ],
};

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

it("the founder's queue has Will's questions under the blind lists; a coach's has none", () => {
  const onOpen = vi.fn();
  act(() => root.render(<QueueScreen speakers={[]} loading={false} blind={null} onSpeaker={() => undefined}
    onClose={() => undefined} will={{ questions: 9, empty: 2, onOpen }} />));
  const row = host.querySelector("[data-testid='coach-panel-will']")!;
  expect(row.textContent).toContain(COPY.willSection);
  expect(row.textContent).toContain(COPY.willQuestions);
  expect(row.textContent).toContain("9 questions · 2 empty slots");
  act(() => (row.querySelector("button") as HTMLButtonElement).click());
  expect(onOpen).toHaveBeenCalledTimes(1);
  // The row opens the editor; back is the queue.
  const queue: PanelState = { screen: { key: "queue" }, history: [], rated: {}, marks: {} };
  const open = panelReducer(queue, { type: "willBank" });
  expect(open.screen.key).toBe("willbank");
  expect(panelReducer(open, { type: "back" }).screen.key).toBe("queue");

  act(() => root.render(<QueueScreen speakers={[]} loading={false} blind={null} onSpeaker={() => undefined}
    onClose={() => undefined} />));
  expect(host.querySelector("[data-testid='coach-panel-will']")).toBeNull();
});

it("Save sends only what changed, an empty slot takes a question, and a refusal says why", async () => {
  const onSave = vi.fn(async () => "Keep {the board} in this question: it is the speaker's own words." as string | null);
  act(() => root.render(<WillBankScreen bank={BANK} onSave={onSave} onBack={() => undefined} onClose={() => undefined} />));
  const save = () => host.querySelector<HTMLButtonElement>("[data-testid='will-bank-save']")!;
  expect(save().disabled).toBe(true);
  expect(host.textContent).toContain(COPY.askedTimes(14));
  // A tap answer renamed.
  const chip = host.querySelector<HTMLInputElement>("[data-will-item='audience_check'] input:nth-of-type(2)")!;
  act(() => type(chip, "Not quite"));
  // The empty slot takes a question.
  act(() => host.querySelector<HTMLButtonElement>("[data-will-slot='slot_1']")!.click());
  const slot = host.querySelector<HTMLTextAreaElement>("[data-will-item='slot_1'] textarea")!;
  act(() => type(slot, "What would make you proud of this talk?"));
  expect(save().disabled).toBe(false);
  await act(async () => save().click());
  expect(onSave).toHaveBeenCalledWith([
    { key: "audience_check", question: "Sounds like this one's for {the board}. Right? 🎯", chips: ["Yes", "Not quite"] },
    { key: "slot_1", question: "What would make you proud of this talk?", chips: [] },
  ]);
  // Refused: the backend's sentence, and the words stay as typed.
  expect(host.querySelector("[role='alert']")!.textContent).toContain("Keep {the board}");
  expect(host.querySelector<HTMLTextAreaElement>("[data-will-item='slot_1'] textarea")!.value).toBe("What would make you proud of this talk?");
});
