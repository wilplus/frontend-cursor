/*
STORY    As a speaker whose assistant request stalls, I get a recoverable
         result instead of an endless ambiguous loading state.
OUTCOME  O1  A chat request that reaches the assistant deadline aborts and
             reports the explicit timeout class used by the chat surfaces.
PROVES   O1 -> "turns a hung assistant request into an explicit recoverable timeout"
WHY      Release-blocking conversational chat audit, 2026-11-17.
*/
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: vi.fn(async () => "token") }));
vi.mock("./projects", () => ({ guestOwnerHeaders: () => ({}) }));

import {
  CHAT_QUERY_TIMEOUT_MS,
  postChatQuery,
} from "./chatQuery";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("chat query request lifecycle", () => {
  it("turns a hung assistant request into an explicit recoverable timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    ));

    const request = postChatQuery({ question: "Are you there?", persist: true });
    const rejected = expect(request).rejects.toEqual(expect.objectContaining({
      status: 408,
      code: "CHAT_TIMEOUT",
    }));
    await vi.advanceTimersByTimeAsync(CHAT_QUERY_TIMEOUT_MS);
    await rejected;
  });
});
