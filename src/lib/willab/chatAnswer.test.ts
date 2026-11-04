// @vitest-environment jsdom
/*
STORY    As a speaker answering someone in a chat, I want my recorded answer to go to them by itself after 5 seconds, with Undo until then, even if I leave the app, and to know when it did not go, so that the person waiting gets just my answer and nothing of mine moves.
OUTCOME
  O1  "Record an answer" makes the question a project of its own, one slide holding the asker's words, opens the recording screens on it, and the project I had is mine again when they close.
  O2  Finish take: "Sending to {name}…" with Undo for 5 seconds; as soon as its Take is uploaded the answer goes to the backend, held there for what is left of the 5 seconds (N441 item 3), once; it shows as sent when they have passed.
  O3  Undo within the 5 seconds takes it back on the backend, before or after it got there; a Take that never uploads, or screens closed before the Take arrived, send nothing.
PROVES   O1 -> the question becomes its own one-slide project and mine comes back
         O2 -> the answer goes as soon as its Take is up, held for the rest of the 5 seconds, once
         O3 -> undo takes it back on the backend; a failed upload or closing early sends nothing
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  created: [] as unknown[],
  sent: [] as unknown[][],
  undone: [] as unknown[][],
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
    return { id: `m-${api.sent.length}`, mine: true, author: "", kind: "voice", body: "", meta: { answer: true }, created_at: "t" };
  }),
  undoChatAnswer: vi.fn(async (...args: unknown[]) => {
    api.undone.push(args);
    return "undone";
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
    api.undone.length = 0;
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

  it("the answer goes as soon as its Take is up, held for the rest of the 5 seconds, once", async () => {
    const shown: string[] = [];
    onAnswerSent((_chatId, message) => shown.push(message.id));
    // The Take lands after 2 seconds: it goes at once, held for the other 3.
    await startAnswer(SARAH, "me", () => {});
    answerRecorded(52_000);
    await vi.advanceTimersByTimeAsync(2000);
    answerTake("take-1");
    await vi.advanceTimersByTimeAsync(0);
    expect(api.sent).toEqual([["c-sarah", "take-1", 52_000, 3000, false]]);
    expect(shown).toEqual([]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(shown).toEqual(["m-1"]);

    // The 5 seconds pass first, then the Take lands: no hold left, still once.
    answerRecorded(40_000);
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    answerTake("take-2");
    answerTake("take-2");
    await vi.advanceTimersByTimeAsync(0);
    expect(api.sent).toEqual([["c-sarah", "take-1", 52_000, 3000, false], ["c-sarah", "take-2", 40_000, 0, false]]);
    expect(shown).toEqual(["m-1", "m-2"]);
  });

  it("undo takes it back on the backend; a failed upload or closing early sends nothing", async () => {
    await startAnswer(SARAH, "me", () => {});
    // Before the Take is up: nothing goes, the backend hears of it by its project.
    answerRecorded(30_000);
    undoAnswer();
    answerTake("take-1");
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(api.sent).toEqual([]);
    expect(api.undone).toEqual([["c-sarah", { message: null, project: "p-answer" }]]);

    // Already held on the backend: taken back there by its message.
    answerRecorded(30_000);
    answerTake("take-2");
    await vi.advanceTimersByTimeAsync(0);
    undoAnswer();
    await vi.advanceTimersByTimeAsync(UNDO_MS);
    expect(api.undone[1]).toEqual(["c-sarah", { message: "m-1", project: "p-answer" }]);

    api.sent.length = 0;
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
