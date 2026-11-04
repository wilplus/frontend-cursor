// @vitest-environment jsdom
/*
 * STORY    As a speaker in the Lounge after a Take, I want Will's one
 *          question to come with answers I can tap, or answer in my own
 *          words, so that I answer in a second and my next Take is never
 *          held up.
 * OUTCOME
 *   O1  While it is the newest bubble, the question shows its answers, the
 *       most likely last, nearest the thumb and filled (N371), and no Skip
 *       (N296: not answering is allowed); a tap goes to the backend
 *       once, which writes it and the reply; an older question shows no
 *       answers; a follow-up shows none, it takes my own words (N294).
 *   O2  The message after the Take waits while Will's question (or its
 *       follow-up) is the newest bubble.
 *   O3  Suggested answers keep one shape everywhere (N371): two side by
 *       side, three or four stacked, more than four the last three and
 *       "Show more", which shows the rest; "Not now", "Skip", "Cancel" and
 *       "Close" are a grey word, never the filled one (N467), and a lone
 *       answer is outlined, never filled (N415).
 *   O4  You type to Will only when he asks for words (N483 item 2): the box
 *       "Type your answer" opens when you tap "Something else", the first of
 *       his answers, and by itself for his follow-up with no answers or when
 *       words are what waits; while the plan asks it never opens (N371).
 * PROVES   O1 -> "the newest question shows its answers, no Skip, and a tap
 *                 goes to the backend once"
 *          O3 -> "suggested answers: two in a row, three stacked, a lone one outlined, saying no a grey word, more than four behind Show more"
 *          O4 -> "the box opens only when Will asks for words; the plan's questions never open it"
 *          O2 -> "the message after the Take waits under Will's question"
 * WHY      Founder 2026-10-20 (N82): "only buttons" in the walk, Will's
 *          questions in the Lounge, tap answers plus my own words;
 *          2026-10-31 (N296): "maybe we should not give them the option to
 *          skip; let's try that".
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRef } from "react";
import WillQuestionBubble, { SOMETHING_ELSE, TapRow, TYPE_YOUR_ANSWER, useWordsBox, willQuestionOf } from "./WillQuestion";
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

it("the newest question shows its answers, no Skip, and a tap goes to the backend once", async () => {
  const will = willQuestionOf(META)!;
  expect(will).toEqual({ arcId: "arc-1", takeSessionId: "take-1", chips: ["The board", "My team", "A buyer"] });
  const onAnswer = vi.fn((choice: string) => postWillQuestion(will.arcId, will.takeSessionId, choice).then(() => {}));
  const body = "Who were you talking to? 🎯";
  act(() => root.render(<WillQuestionBubble body={body} chips={will.chips} open onAnswer={onAnswer} />));
  // The most likely (the backend's first) sits last, nearest the thumb, filled
  // (N371); "Something else" is first, at the top (N483 item 2).
  const buttons = [...host.querySelectorAll("[data-will-answers] button")].map((b) => b.textContent);
  expect(buttons).toEqual([SOMETHING_ELSE, "A buyer", "My team", "The board"]);
  expect(host.querySelector("[data-will-answers] [data-goes]")?.textContent).toBe("The board");
  await act(async () => {
    (host.querySelector("[data-will-answers] [data-goes]") as HTMLButtonElement).click();
    (host.querySelector("[data-will-answers] [data-goes]") as HTMLButtonElement).click();
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
  // The follow-up takes their own words: nothing to tap.
  act(() => root.render(<WillQuestionBubble body="Who is it for, then? 👀" chips={[]} open onAnswer={onAnswer} />));
  expect(host.querySelector("[data-will-answers]")).toBeNull();
  expect(host.textContent).not.toContain("Skip");
});

it("the message after the Take waits under Will's question", () => {
  expect(askShowing([{ metadata: META }], false)).toBe(true);
  expect(askShowing([{ metadata: { ...META, will_question_step: "follow", chips: [] } }], false)).toBe(true);
  expect(askShowing([{ metadata: { will_question: "audience", will_question_step: "thanks" } }], false)).toBe(false);
});

it("suggested answers: two in a row, three stacked, a lone one outlined, saying no a grey word, more than four behind Show more", async () => {
  const row = () => host.querySelector("[data-t]") as HTMLElement;
  const shown = () => [...row().querySelectorAll("button")].map((b) => b.textContent);
  act(() => root.render(<TapRow labels={["Not now", "Practise it"]} onTap={() => {}} dataAttr={{ "data-t": "" }} />));
  expect(row().className).toContain("flex-wrap");
  expect(row().querySelector("[data-goes]")?.textContent).toBe("Practise it");
  // "Not now", "Skip", "Cancel" and "Close" leave: a grey word, never filled (backend N467 rule 3).
  expect(row().querySelector("[data-quiet]")?.textContent).toBe("Not now");
  act(() => root.render(<TapRow labels={["C", "B", "A"]} onTap={() => {}} dataAttr={{ "data-t": "" }} />));
  expect(row().className).toContain("flex-col");
  expect(row().querySelector("[data-goes]")?.textContent).toBe("A");
  // A lone answer is outlined, so it is not taken for a sent message (N415 item 1).
  act(() => root.render(<TapRow labels={["I want to continue my practice"]} onTap={() => {}} dataAttr={{ "data-t": "" }} />));
  expect(row().querySelector("[data-goes]")).toBeNull();
  act(() => root.render(<TapRow labels={["F", "E", "D", "C", "B", "A"]} onTap={() => {}} dataAttr={{ "data-t": "" }} />));
  expect(shown()).toEqual(["Show more", "C", "B", "A"]);
  await act(async () => (row().querySelector("[data-show-more]") as HTMLButtonElement).click());
  expect(shown()).toEqual(["F", "E", "D", "C", "B", "A"]);
});

function Bar({ shown, typingOff, wordsWait = false }: { shown: { metadata: Record<string, unknown> }[]; typingOff: boolean; wordsWait?: boolean }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const words = useWordsBox(shown, typingOff, "", box, wordsWait);
  return (
    <div>
      <button type="button" data-open onClick={words.start} />
      {words.show ? <textarea ref={box} placeholder={TYPE_YOUR_ANSWER} /> : <span data-middle="" />}
    </div>
  );
}

it("the box opens only when Will asks for words; the plan's questions never open it", async () => {
  const box = () => host.querySelector("textarea");
  // His question with answers: the box waits for "Something else".
  act(() => root.render(<Bar shown={[{ metadata: META }]} typingOff={false} />));
  expect(box()).toBeNull();
  await act(async () => (host.querySelector("[data-open]") as HTMLButtonElement).click());
  expect(box()?.placeholder).toBe(TYPE_YOUR_ANSWER);
  // His follow-up has nothing to tap: the box is there by itself.
  act(() => root.render(<Bar shown={[{ metadata: { ...META, will_question_step: "follow", chips: [] } }]} typingOff={false} />));
  expect(box()).not.toBeNull();
  // Words wait with no question of his (a setup's name, "What was missing?").
  act(() => root.render(<Bar shown={[]} typingOff={false} wordsWait />));
  expect(box()).not.toBeNull();
  // Nothing asked: the middle is the record button, no box.
  act(() => root.render(<Bar shown={[]} typingOff={false} />));
  expect(box()).toBeNull();
  // The plan asks: typing is off, even "Something else" opens nothing.
  act(() => root.render(<Bar shown={[{ metadata: META }]} typingOff />));
  await act(async () => (host.querySelector("[data-open]") as HTMLButtonElement).click());
  expect(box()).toBeNull();
});
