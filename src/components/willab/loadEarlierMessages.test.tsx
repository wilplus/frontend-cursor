// @vitest-environment jsdom
/*
STORY    As a speaker reading back through my chat, I want older messages to
         come in above what I am reading, so that "Load earlier messages"
         never throws me back to the bottom.
OUTCOME
  O1  Older messages put above the chat leave the bubble I was reading
      where I saw it; only a new message moves the chat to the bottom.
PROVES   O1 -> "older messages come in above what is read; a new one lands at the bottom"
WHY      Founder 2026-09-28: "Only a new message moves the thread; reading
         history otherwise stays where it is." The chat took a page of older
         messages for a new bubble and jumped to the bottom.
*/
import { act, createElement, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useKeepPlaceAbove, usePinThreadBottom } from "./usePinThreadBottom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROW = 100; // every row of this chat is 100px tall, one under the other

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  // The layout jsdom does not do: rows stacked in the chat, which scrolls.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const chat = this.parentElement;
    const top = chat?.hasAttribute("data-chat") ? Array.from(chat.children).indexOf(this) * ROW - chat.scrollTop : 0;
    return { top, bottom: top + ROW, left: 0, right: 0, width: 0, height: ROW, x: 0, y: top, toJSON: () => ({}) };
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

it("older messages come in above what is read; a new one lands at the bottom", () => {
  let chat: HTMLDivElement | null = null;
  let beforeOlder: () => void = () => undefined;
  function Chat({ ids }: { ids: string[] }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const opened = useRef(true);
    usePinThreadBottom(ref, ids.at(-1) ?? null, false, opened);
    beforeOlder = useKeepPlaceAbove(ref, ids[0] ?? null);
    return createElement(
      "div",
      {
        "data-chat": "",
        ref: (el: HTMLDivElement | null) => {
          ref.current = el;
          chat = el;
        },
      },
      createElement("button", { "data-load-older": "" }),
      ...ids.map((id) => createElement("div", { key: id }, id)),
    );
  }
  act(() => root.render(createElement(Chat, { ids: ["5", "6"] })));
  Object.defineProperty(chat!, "scrollHeight", { get: () => chat!.children.length * ROW, configurable: true });
  chat!.scrollTop = 0; // reading at the top, by the button

  // Two older messages come in above "5".
  act(() => beforeOlder());
  act(() => root.render(createElement(Chat, { ids: ["3", "4", "5", "6"] })));
  expect(chat!.scrollTop).toBe(2 * ROW);

  // A new message: the chat lands on it.
  act(() => root.render(createElement(Chat, { ids: ["3", "4", "5", "6", "7"] })));
  expect(chat!.scrollTop).toBe(6 * ROW);
});
