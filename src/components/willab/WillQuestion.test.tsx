// @vitest-environment jsdom
/* -------------------------------------------------------------------------- */
/*  STORY    As a speaker in the Lounge after a Take, I want Will's one       */
/*           question to come with answers I can tap (or Skip), so that I     */
/*           answer in a second and my next Take is never held up.            */
/*  OUTCOME                                                                   */
/*    O1  While it is the newest bubble, the question shows its answers and   */
/*        Skip; a tap goes to the backend once, which writes it and the       */
/*        reply; an older question shows no answers.                          */
/*    O2  The message after the Take waits while Will's question (or its      */
/*        follow-up) is the newest bubble.                                    */
/*  PROVES   O1 -> "the newest question shows its answers and Skip, and a tap */
/*                  goes to the backend once"                                 */
/*           O2 -> "the message after the Take waits under Will's question"  */
/*  WHY      Founder 2026-10-20 (N82): "only buttons" in the walk, Will's    */
/*           questions in the Lounge, tap answers plus my own words.         */
/* -------------------------------------------------------------------------- */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import WillQuestionBubble, { willQuestionOf } from "./WillQuestion";
import { askShowing } from "./afterTake";
import { postWillQuestion } from "@/services/api/willQuestion";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const bffFetch = vi.hoisted(() => vi.fn(async (_url: string, _init: unknown) => ({ kind: "response", ok: true })));
vi.mock("@/lib/api/bffFetch", () => ({ bffFetch }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  bffFetch.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const META = {
  offer: "will_question",
  will_question: "audience",
  will_question_step: "ask",
  chips: ["The board", "My team", "A buyer"],
  arc_id: "arc-1",
  take_session_id: "take-1",
};

it("the newest question shows its answers and Skip, and a tap goes to the backend once", async () => {
  const will = willQuestionOf(META)!;
  expect(will).toEqual({ arcId: "arc-1", takeSessionId: "take-1", chips: ["The board", "My team", "A buyer"] });
  const onAnswer = vi.fn((choice: string) => postWillQuestion(will.arcId, will.takeSessionId, choice).then(() => {}));
  const body = "Quick one: who's this talk really for? 🎯";
  act(() => root.render(<WillQuestionBubble body={body} chips={will.chips} open onAnswer={onAnswer} />));
  const buttons = [...host.querySelectorAll("[data-will-answers] button")].map((b) => b.textContent);
  expect(buttons).toEqual(["The board", "My team", "A buyer", "Skip"]);
  await act(async () => {
    (host.querySelector("[data-will-answers] button") as HTMLButtonElement).click();
    (host.querySelector("[data-will-answers] button") as HTMLButtonElement).click();
  });
  expect(onAnswer).toHaveBeenCalledTimes(1);
  expect(bffFetch).toHaveBeenCalledWith("/api/v2/explore/arc/arc-1/will-question", expect.objectContaining({
    method: "POST",
    json: { take_session_id: "take-1", choice: "The board" },
  }));
  // An older question: the words stay, the answers are gone.
  act(() => root.render(<WillQuestionBubble body={body} chips={will.chips} open={false} onAnswer={onAnswer} />));
  expect(host.textContent).toContain(body);
  expect(host.querySelector("[data-will-answers]")).toBeNull();
  expect(willQuestionOf({ offer: "whatsapp", arc_id: "a", take_session_id: "t" })).toBeNull();
});

it("the message after the Take waits under Will's question", () => {
  expect(askShowing([{ metadata: META }], false)).toBe(true);
  expect(askShowing([{ metadata: { ...META, will_question_step: "follow", chips: [] } }], false)).toBe(true);
  expect(askShowing([{ metadata: { will_question: "audience", will_question_step: "thanks" } }], false)).toBe(false);
});
