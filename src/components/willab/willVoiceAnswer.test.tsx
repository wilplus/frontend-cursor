// @vitest-environment jsdom
/*
 * STORY    As a speaker in the Lounge, I want the answers I already gave Will
 *          out loud to stay in the chat, and after I answer the chat to show
 *          the newest bubble, so that I can always see where we are.
 * OUTCOME
 *   O1  A spoken answer to Will, already in the thread, shows on my side
 *       with the words he heard (N275). Since N483 Will's question is
 *       answered with a tap or written words, so no new ones are made.
 *   O2  After I answer, the chat lands on the newest bubble even when I had
 *       scrolled up (N319 item 9).
 * PROVES   O1 -> "a spoken answer already given stays as my bubble with its words"
 *          O2 -> "after an answer the chat lands on the newest bubble"
 * WHY      N294 items 2 and 3 (the spoken answers kept); 2026-11-01 (N319):
 *          "after the speaker answers, the chat moves to the new bubble";
 *          2026-11-04 (N483): no mic in any chat.
 */
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";
import { isWillVoice, WillVoiceBubble } from "./WillVoiceAnswer";
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
    usePinThreadBottom(ref, 3, false, opened);
    return createElement("div", { ref: (el: HTMLDivElement | null) => { ref.current = el; thread = el; } });
  }
  act(() => root.render(createElement(Thread)));
  Object.defineProperty(thread!, "scrollHeight", { value: 2000, configurable: true });
  thread!.scrollTop = 120; // scrolled up to read
  act(() => followNewest());
  expect(thread!.scrollTop).toBe(2000);
});
