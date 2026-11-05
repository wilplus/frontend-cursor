// @vitest-environment jsdom
/*
STORY    As a speaker using a keyboard, I want "Discard this take?" to take
         the keyboard when it opens, so that I can answer it without
         reaching behind it, and a stray Escape never throws my Take away.
OUTCOME
  O1  Focus moves onto the safe answer (keep the Take); Tab and Shift+Tab
      go round the two answers and never behind the dialog.
  O2  Escape keeps the Take, and focus is not left on the ✕ that opened
      it, so the recording screen's next Space turns the slide (N70.1).
PROVES   O1, O2 -> "the dialog takes the keyboard, and Escape keeps the Take"
WHY      The dialog said it was modal (aria-modal) but focus stayed behind it,
         Tab reached the screen under it and Escape did nothing.
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DiscardTakeDialog from "./DiscardTakeDialog";

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

const press = (key: string, shiftKey = false) =>
  act(() => {
    (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true, cancelable: true }));
  });

it("the dialog takes the keyboard, and Escape keeps the Take", () => {
  const onKeep = vi.fn();
  const onDiscard = vi.fn();
  // The ✕ that opened it.
  const close = document.createElement("button");
  document.body.appendChild(close);
  close.focus();

  act(() => root.render(createElement(DiscardTakeDialog, { lane: "recording", onKeep, onDiscard })));
  const [keep, discard] = Array.from(host.querySelectorAll("button"));
  expect(document.activeElement).toBe(keep);
  expect(keep.textContent).toBe("Keep recording");

  press("Tab");
  expect(document.activeElement).toBe(discard);
  press("Tab");
  expect(document.activeElement).toBe(keep);
  press("Tab", true);
  expect(document.activeElement).toBe(discard);

  press("Escape");
  expect(onKeep).toHaveBeenCalledTimes(1);
  expect(onDiscard).not.toHaveBeenCalled();

  act(() => root.render(createElement("div")));
  expect(document.activeElement).not.toBe(close);
  close.remove();
});
