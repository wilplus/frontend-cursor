// @vitest-environment jsdom
/*
STORY    As a speaker opening the app, I want my chat to come first, so that
         the day's asks and the notebook's state never queue in front of it.
OUTCOME
  O1  The day's asks (the quarter due, the day's why, a strength before a
      talk) go out once the thread has painted, and however many of them
      wrote, the thread is read again once.
  O2  The notebook's state is asked once however many parts of the chat ask
      at the same moment; a read asked after a notebook answer is fresh.
PROVES   O1 -> "the day's asks wait for the thread, and the thread is read again once"
         O2 -> "the notebook's state is one request for everyone asking at once"
WHY      Loading time (2026-11-05): these went out beside the thread's own
         read and competed with it.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "token", user: { id: "maria" } } } }) },
  }),
}));

import { __resetChatBootForTests, markChatBootSettled, markChatBootStarted } from "@/lib/chatBoot";
import { askWhenLoungeOpens } from "./loungeOpenAsks";
import { quarterDue } from "@/services/api/lifeGoals";
import { yourWhyToday } from "@/services/api/yourWhy";
import { strengthsToday } from "@/services/api/lifeStrengths";
import { answerNotebook, getNotebookState, readNotebookState } from "@/services/api/voiceNotebook";

const fetchMock = vi.fn();
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const requests = () =>
  fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(url).split("?")[0]}`);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  __resetChatBootForTests();
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    const path = String(url).split("?")[0];
    if (path === "/api/v2/life-goals/quarter/due") return Promise.resolve(json({ messages: [{ id: "q" }] }));
    if (path === "/api/v2/your-why/today") return Promise.resolve(json({ messages: [{ id: "w" }] }));
    if (path === "/api/v2/strengths/today") return Promise.resolve(json({ messages: [] }));
    if (path === "/api/v2/notebook/state") return Promise.resolve(json({ enabled: true, consented: false }));
    return Promise.resolve(json({}));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the chat opens with its thread first", () => {
  it("the day's asks wait for the thread, and the thread is read again once", async () => {
    const reload = vi.fn(async () => undefined);
    markChatBootStarted(); // the thread is being read
    askWhenLoungeOpens(quarterDue, reload);
    askWhenLoungeOpens(yourWhyToday, reload);
    askWhenLoungeOpens(strengthsToday, reload);
    await settle();
    expect(requests()).toEqual([]);

    markChatBootSettled(); // the thread has painted
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    await settle();
    expect(requests().sort()).toEqual([
      "POST /api/v2/life-goals/quarter/due",
      "POST /api/v2/strengths/today",
      "POST /api/v2/your-why/today",
    ]);
    // Two of the three wrote: one read of the thread, not two.
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("the notebook's state is one request for everyone asking at once", async () => {
    const answers = await Promise.all([getNotebookState(), readNotebookState(), getNotebookState()]);
    expect(answers.every((a) => a?.enabled === true)).toBe(true);
    expect(requests()).toEqual(["GET /api/v2/notebook/state"]);

    // The answer is not kept: after a Yes, the next ask reads again.
    await answerNotebook("yes");
    await getNotebookState();
    expect(requests()).toEqual([
      "GET /api/v2/notebook/state",
      "POST /api/v2/notebook/consent",
      "GET /api/v2/notebook/state",
    ]);
  });
});
