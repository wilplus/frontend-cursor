// @vitest-environment jsdom
/*
STORY    As a speaker answering someone in a chat, I want my recorded answer to go to them by itself after 5 seconds, with Undo until then, and my own project left as it was, so that the person waiting gets just my answer and nothing of mine moves.
OUTCOME
  O1  "Record an answer" makes the question a project of its own, one slide holding the asker's words, opens the recording screens on it, and the project I had is mine again when they close.
  O2  Finish take: "Sending to {name}…" with Undo for 5 seconds; the answer is sent once the 5 seconds have passed and its Take is uploaded, whichever comes last, and only once.
  O3  Undo within the 5 seconds, a Take that never uploads, or screens closed before the Take arrived: nothing is sent.
PROVES   O1 -> the question becomes its own one-slide project and mine comes back
         O2 -> the answer goes after 5 seconds once its Take is up, once
         O3 -> undo, a failed upload or closing early sends nothing
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  created: [] as unknown[],
  sent: [] as unknown[][],
}));
vi.mock("@/services/api/projects", () => ({
  createProject: vi.fn(async (input: unknown) => {
    api.created.push(input);
    return { kind: "ok", projectId: "p-answer", guestOwnerToken: null };
  }),
}));
vi.mock("@/services/api/chats", () => ({
  sendChatAnswer: vi.fn(async (...args: unknown[]) => {
    api.sent.push(args);
    return { id: "m-answer", mine: true, author: "", kind: "voice", body: "", meta: { answer: true }, created_at: "t" };
  }),
}));

import {
  UNDO_MS,
  answerRecorded,
  answerTake,
  endAnswer,
  forgetAnswers,
  onAnswerSent,
  startAnswer,
  undoAnswer,
} from "./chatAnswer";
import { readExploreArc, writeExploreArc } from "./exploreArc";

const SARAH = { chatId: "c-sarah", name: "Sarah", question: "Would the Deep Scalp Treatment help?", customer: true };

describe("an answer recorded in a chat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    api.created.length = 0;
    api.sent.length = 0;
    forgetAnswers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("the question becomes its own one-slide project and mine comes back", async () => {
    writeExploreArc("me", "p-mine", 3);
    const open = vi.fn();
    expect(await startAnswer(SARAH, "me", open)).toBe(true);
    expect(open).toHaveBeenCalledOnce();
    expect(api.created).toEqual([
      expect.objectContaining({
        displayName: SARAH.question,
        setup: expect.objectContaining({ topic: SARAH.question, slides: [{ title: SARAH.question, body: "" }] }),
      }),
    ]);
    expect(readExploreArc("me")).toMatchObject({ arcId: "p-answer", nextTakeIndex: 1 });
    endAnswer();
    expect(readExploreArc("me")).toMatchObject({ arcId: "p-mine", nextTakeIndex: 3 });
  });

  it("the answer goes after 5 seconds once its Take is up, once", async () => {
    const shown: string[] = [];
    onAnswerSent((chatId) => shown.push(chatId));
    // The Take lands first, then the 5 seconds pass.
    await startAnswer(SARAH, "me", () => {});
    answerRecorded(52_000);
    answerTake("take-1");
    await vi.advanceTimersByTimeAsync(UNDO_MS - 1);
    expect(api.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.sent).toEqual([["c-sarah", "take-1", 52_000]]);
    expect(shown).toEqual(["c-sarah"]);
    endAnswer();

    // The 5 seconds pass first, then the Take lands; still once.
    await startAnswer(SARAH, "me", () => {});
    answerRecorded(40_000);
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(api.sent).toHaveLength(1);
    answerTake("take-2");
    answerTake("take-2");
    await vi.advanceTimersByTimeAsync(0);
    expect(api.sent).toEqual([["c-sarah", "take-1", 52_000], ["c-sarah", "take-2", 40_000]]);
  });

  it("undo, a failed upload or closing early sends nothing", async () => {
    await startAnswer(SARAH, "me", () => {});
    answerRecorded(30_000);
    undoAnswer();
    answerTake("take-1");
    await vi.advanceTimersByTimeAsync(UNDO_MS);

    answerRecorded(30_000);
    answerTake(null);
    await vi.advanceTimersByTimeAsync(UNDO_MS);

    answerRecorded(30_000);
    endAnswer();
    answerTake("take-3");
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(api.sent).toEqual([]);
  });
});
