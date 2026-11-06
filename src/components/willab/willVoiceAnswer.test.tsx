// @vitest-environment jsdom
/*
 * STORY    As a speaker in the Lounge, I want the answers I already gave Will
 *          out loud to stay in the chat, and after I answer the chat to show
 *          the newest bubble, so that I can always see where we are.
 * OUTCOME
 *   O1  A spoken answer to Will, already in the thread, shows on my side
 *       with the words he heard (N275).
 *   O3  Will's key line asks me to say it, so the bar gives me "Record your
 *       answer" and records it there, never the box (N544); his other
 *       questions keep taps and written words (N483).
 *   O2  After I answer, the chat lands on the newest bubble even when I had
 *       scrolled up (N319 item 9).
 * PROVES   O1 -> "a spoken answer already given stays as my bubble with its words"
 *          O2 -> "after an answer the chat lands on the newest bubble"
 *          O3 -> "the key line is said in the bar; other questions are not"
 * WHY      N294 items 2 and 3 (the spoken answers kept); 2026-11-01 (N319):
 *          "after the speaker answers, the chat moves to the new bubble";
 *          2026-11-04 (N483): no mic in any chat; 2026-11-06 (N544): "it asks
 *          to say it; but it doesnt give you the recorder".
 */
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { isWillVoice, keyLineWaiting, useKeyLineHear, WillVoiceBubble } from "./WillVoiceAnswer";
import { followNewest, usePinThreadBottom } from "./usePinThreadBottom";

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

it("a spoken answer already given stays as my bubble with its words", () => {
  const said = "The board, they decide the budget on Friday.";
  const row = { role: "user" as const, body: said, metadata: { will_voice: true } };
  expect(isWillVoice(row)).toBe(true);
  expect(isWillVoice({ ...row, role: "bot" as const })).toBe(false);
  act(() => root.render(createElement(WillVoiceBubble, { message: row })));
  const bubble = host.querySelector("[data-will-voice]")!;
  expect(bubble.getAttribute("data-row")).toBe("me");
  expect(bubble.textContent).toBe(said);
});

it("after an answer the chat lands on the newest bubble", () => {
  let thread: HTMLDivElement | null = null;
  function Thread() {
    const ref = useRef<HTMLDivElement | null>(null);
    const opened = useRef(true);
    usePinThreadBottom(ref, "3", false, opened);
    return createElement("div", { ref: (el: HTMLDivElement | null) => { ref.current = el; thread = el; } });
  }
  act(() => root.render(createElement(Thread)));
  Object.defineProperty(thread!, "scrollHeight", { value: 2000, configurable: true });
  thread!.scrollTop = 120; // scrolled up to read
  act(() => followNewest());
  expect(thread!.scrollTop).toBe(2000);
});

it("the key line is said in the bar; other questions are not", () => {
  const ask = (key: string) => ({
    metadata: { offer: "will_question", will_question: key, will_question_step: "ask", arc_id: "a1", take_session_id: "t1" },
  });
  expect(keyLineWaiting([ask("audience")])).toBeNull();
  expect(keyLineWaiting([ask("key_line"), { metadata: { will_question_step: "answer" } }])).toBeNull();
  let seen: ReturnType<typeof useKeyLineHear> | null = null;
  function Bar({ shown }: { shown: { metadata: Record<string, unknown> }[] }) {
    seen = useKeyLineHear({ shown, held: false, onSending: () => undefined, onSent: () => undefined });
    return createElement("div", null, seen.notNow);
  }
  act(() => root.render(createElement(Bar, { shown: [ask("key_line")] })));
  expect(seen!.asks).toBe(true);
  expect(seen!.hear).not.toBeNull();
  // "Not now" gives the bar back to the next Take.
  act(() => (host.querySelector("[data-key-line-not-now] button") as HTMLElement).click());
  expect(seen!.hear).toBeNull();
  expect(seen!.asks).toBe(true);
});
