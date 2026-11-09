// @vitest-environment jsdom
/*
STORY    As a speaker, I want my Take's bubble in Will's chat to open what I
         said, slide by slide, so that I can read it back without leaving the
         chat, while the voice stays the first thing I meet.
OUTCOME
  O1  "Read it" sits under the Take's player, closed by default; it opens
      what was said, one paragraph per slide in the slides' order, and
      "Hide" closes it; reading never opens the Take's feedback (N576).
  O2  Nothing shows before there are words (N576 item 1, N331 item 2).
PROVES   O1 -> "a Take's bubble opens its words slide by slide behind Read it, and Hide closes them"
         O2 -> "a Take with no words yet shows no Read it"
WHY      Backend N576 items 1 to 3 (founder, 9 November 2026): every voice
         bubble opens its words, a Take's in Will's chat too; the words are
         the Lounge read's `metadata.words` (backend services/lounge_clips.py
         attach_take_words).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import ReportCard from "./ReportCard";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function take(metadata: Record<string, unknown>) {
  return {
    client_id: "rec2", role: "user" as const, kind: "recording_summary" as const, body: "",
    metadata: { session_id: "take-2", arc_id: "arc-1", take_index: 2, ...metadata },
    client_created_at: "2026-11-09T10:00:00Z",
  };
}

const buttonNamed = (name: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === name) ?? null;

it("a Take's bubble opens its words slide by slide behind Read it, and Hide closes them", async () => {
  const onOpenFeedback = vi.fn();
  await act(async () => {
    root.render(createElement(ReportCard, {
      message: take({ words: ["Hello, I am Ana.", "Then the price."] }),
      onOpenFeedback,
    }));
  });
  expect(buttonNamed("Read it")).not.toBeNull();
  expect(host.textContent).not.toContain("Hello, I am Ana.");

  await act(async () => buttonNamed("Read it")!.click());
  const words = host.querySelector("[data-chat-words]")!;
  expect(words.textContent).toBe("Hello, I am Ana.\n\nThen the price.");
  expect(onOpenFeedback).not.toHaveBeenCalled();

  await act(async () => buttonNamed("Hide")!.click());
  expect(host.querySelector("[data-chat-words]")).toBeNull();
  expect(buttonNamed("Read it")).not.toBeNull();
  expect(onOpenFeedback).not.toHaveBeenCalled();
});

it("a Take with no words yet shows no Read it", async () => {
  await act(async () => {
    root.render(createElement(ReportCard, { message: take({}), onOpenFeedback: vi.fn() }));
  });
  expect(host.textContent).toContain("Your Recording");
  expect(buttonNamed("Read it")).toBeNull();
  await act(async () => {
    root.render(createElement(ReportCard, { message: take({ words: ["  "] }), onOpenFeedback: vi.fn() }));
  });
  expect(buttonNamed("Read it")).toBeNull();
});
