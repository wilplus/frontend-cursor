// @vitest-environment jsdom
/*
STORY    As someone suggested for a Take, I want "Read it" in the asking chat
         to open the Take's words under its player, one paragraph per slide,
         so that I can read what the speaker said before I answer.
OUTCOME
  O1  Before "Open Take" the asking chat shows no words and no "Read it";
      after it, the Take's player with "Read it" under it, its words
      closed; "Read it" opens them under the player, one paragraph per
      slide, and "Hide" closes them (App Model MATCH-13; N331, N576
      item 1).
  O2  Once my answer is sent and its Undo time is over, nothing asks me
      anything about it: no card after Sent, no "Help Will hear what you
      heard?", no "Teach Will", no rating; the asking chat goes and my list
      is read again (App Model MATCH-04; N518 item 1). The rating inside
      the answer waits for its prototype (N518 item 9) and is not built.
PROVES   O1 -> "Read it opens the Take's words under its player, one paragraph per slide"
         O2 -> "no card follows Sent: the answer goes and nothing asks about it"
WHY      O2: founder, 5 November 2026, N518 item 1 ("No, never ask") and
         item 9. O1: founder, the App Model of 9 November 2026, MATCH-13 (its Then: "the
         Take's words open under its player, one paragraph per slide"); a
         voice's words are closed behind "Read it" (backend N331).
*/
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const OUTSIDE = {
  id: "m1",
  state: "new" as const,
  pseudonym: "Bright Finch",
  role: "Sales lead",
  about: "opening an investor pitch",
  sentAt: "2026-11-04T11:05:00Z",
  name: null,
  chatId: null,
};
const OPENED = {
  ...OUTSIDE,
  state: "opened" as const,
  name: "Amira",
  words: "Why now, and why us.\n\nThe first number: we grew forty percent.",
  slideTitles: ["Why now", "The first number"],
  durationMs: 161_000,
};
const api = vi.hoisted(() => ({
  getInquiry: vi.fn(),
  acceptInquiry: vi.fn(),
  declineInquiry: vi.fn(async () => true),
  answerInquiry: vi.fn(async () => "sent" as const),
  undoInquiry: vi.fn(async () => "sent" as const),
  inquiryAudioSrc: (id: string) => `/api/v2/take-matches/${id}/recording`,
}));
vi.mock("@/services/api/takeMatches", () => api);
vi.mock("@/services/api/projects", () => ({ createProject: vi.fn(async () => ({ kind: "ok", projectId: "answer-project" })) }));

import InquiryThread, { inquiryChatId } from "./InquiryThread";
import { answerRecorded, answerTake, endAnswer, forgetAnswers, startAnswer, UNDO_MS, type AnswerFor } from "@/lib/willab/chatAnswer";
import type { Chat } from "@/services/api/chats";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  api.getInquiry.mockResolvedValue(OUTSIDE);
  api.acceptInquiry.mockResolvedValue(OPENED);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const tap = async (el: Element | null | undefined) => {
  await act(async () => (el as HTMLElement).click());
};

it("Read it opens the Take's words under its player, one paragraph per slide", async () => {
  const chat = { id: inquiryChatId("m1"), kind: "inquiry", title: "Bright Finch", subtitle: "Sales lead" } as unknown as Chat;
  await act(async () => {
    root.render(createElement(InquiryThread, { chat, inquiry: OUTSIDE, onBack: () => {}, onGone: () => {}, onRecordAnswer: () => {} }));
  });
  // Before Open Take: who asks and about what; no words, nothing to read.
  expect(host.textContent).toContain("It's about opening an investor pitch.");
  expect(host.querySelector("[data-chat-read]")).toBeNull();
  expect(host.textContent).not.toContain("Why now, and why us.");

  await tap(host.querySelector("[data-inquiry-open-take]"));
  const open = host.querySelector("[data-chat-take-open]");
  expect(open).not.toBeNull();
  // The words are closed under the player until "Read it".
  const read = open!.querySelector("[data-chat-read]");
  expect(read?.textContent).toBe("Read it");
  expect(open!.querySelector("[data-chat-words]")).toBeNull();
  const player = open!.querySelector("[data-plan-player]");
  expect(player).not.toBeNull();

  await tap(read);
  const words = open!.querySelector("[data-chat-words]");
  // Under the player: the words come after it and after "Read it".
  expect(player!.compareDocumentPosition(words!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(words?.previousElementSibling).toBe(read);
  // One paragraph per slide, in the slides' order.
  expect(words?.textContent?.split("\n\n")).toEqual(["Why now, and why us.", "The first number: we grew forty percent."]);
  expect(read?.textContent).toBe("Hide");

  await tap(read);
  expect(open!.querySelector("[data-chat-words]")).toBeNull();
  expect(read?.textContent).toBe("Read it");
});

it("no card follows Sent: the answer goes and nothing asks about it", async () => {
  vi.useFakeTimers();
  try {
    forgetAnswers();
    api.getInquiry.mockResolvedValue(OPENED);
    const chat = { id: inquiryChatId("m1"), kind: "inquiry", title: "Amira", subtitle: "Sales lead" } as unknown as Chat;
    const onGone = vi.fn();
    let asked: AnswerFor | null = null;
    await act(async () => {
      root.render(
        createElement(InquiryThread, { chat, inquiry: OPENED, onBack: () => {}, onGone, onRecordAnswer: (a: AnswerFor) => (asked = a) }),
      );
    });
    await tap(host.querySelector("[data-chat-record-answer]"));
    expect(asked).not.toBeNull();
    // Recorded and sent: the answer waits its five seconds for Undo.
    await act(async () => {
      await startAnswer(asked!, null, () => {});
      answerRecorded(42_000);
      answerTake("answer-take");
      endAnswer();
    });
    expect(api.answerInquiry).toHaveBeenCalledWith("m1", "answer-take", 42_000, expect.any(Number));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNDO_MS + 100);
    });
    expect(onGone).toHaveBeenCalled();
    // Nothing after Sent (N518 item 1): no card, no ask, no rating.
    const text = document.body.textContent ?? "";
    for (const line of ["Help Will hear what you heard?", "Teach Will", "Will would have said", "Does the speaker sound confident here?"]) {
      expect(text).not.toContain(line);
    }
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  } finally {
    forgetAnswers();
    vi.useRealTimers();
  }
});
