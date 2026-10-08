/* C3 (founder 2026-10-08): every coach read carries the session's Bearer
   token beside the cookie, so the BFF never pays supabase.auth.getUser for
   it; with no token the read is exactly what it was. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getAuthToken = vi.fn<() => Promise<string | null>>();
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: () => getAuthToken() }));

import { coachReadInit } from "./coachAuth";
import { fetchMomentRead, fetchMomentsQueue, fetchTakeWord, listCatalogue } from "./coachWalk";
import { fetchCoachReviewSession } from "./coachReview";
import { fetchBlockPicks, fetchErrorAudit, fetchExercisePreference, fetchV4MomentPicks, fetchV4SurerPairs } from "./coachPanel";
import { fetchCoachSpeakers } from "./coachSpeakers";
import { fetchTakeBubbles } from "./coachBubbles";
import { fetchCoachStudents } from "./coachStudents";
import { fetchCoachExerciseRequest } from "./coachExerciseRequest";

const READS: Array<[string, () => Promise<unknown>]> = [
  ["the moments queue", () => fetchMomentsQueue()],
  ["the moment read", () => fetchMomentRead("t1", "s1")],
  ["the Take's word", () => fetchTakeWord("t1")],
  ["the catalogue", () => listCatalogue()],
  ["the review session", () => fetchCoachReviewSession("t1")],
  ["the error audit", () => fetchErrorAudit()],
  ["the block picks", () => fetchBlockPicks()],
  ["the V4 picks", () => fetchV4MomentPicks()],
  ["the V4 pairs", () => fetchV4SurerPairs()],
  ["the exercise preference", () => fetchExercisePreference("t1", "s1")],
  ["the speakers", () => fetchCoachSpeakers()],
  ["the take bubbles", () => fetchTakeBubbles()],
  ["the students", () => fetchCoachStudents()],
  ["the exercise request", () => fetchCoachExerciseRequest("t1", "s1")],
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  getAuthToken.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("coachReadInit", () => {
  it("the cookie and the Bearer token when signed in", async () => {
    getAuthToken.mockResolvedValue("tok-123");
    expect(await coachReadInit()).toEqual({
      credentials: "include", cache: "no-store", headers: { Authorization: "Bearer tok-123" },
    });
  });

  it("no token: exactly today's init, no Authorization header", async () => {
    getAuthToken.mockResolvedValue(null);
    expect(await coachReadInit()).toEqual({ credentials: "include", cache: "no-store" });
  });
});

describe("every coach GET sends the Authorization header", () => {
  it.each(READS)("%s", async (_name, read) => {
    getAuthToken.mockResolvedValue("tok-123");
    await read();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^\/api\/v2\/coach\//);
    expect(init.method ?? "GET").toBe("GET");
    expect(init.credentials).toBe("include");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it.each(READS)("%s, signed out: cookie only, as before", async (_name, read) => {
    getAuthToken.mockResolvedValue(null);
    await read();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
    expect(init.headers).toBeUndefined();
  });
});
