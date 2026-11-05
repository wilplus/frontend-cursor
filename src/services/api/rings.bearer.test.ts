/*
STORY    As a speaker opening the app, I want each read it makes as it opens
         to say who I am, so that our server does not first ask the sign-in
         service who is calling, once per read.
OUTCOME
  O1  Signed in, the ring read and the Life panel's reads send the session's
      Bearer token; signed out, they go without one, as before (the cookie
      answers), and their answers are what they were.
PROVES   O1 -> "the ring read and the Life panel's reads carry the session's token, and go as before signed out"
WHY      Loading time (2026-11-05): without the header, the BFF asked
         Supabase getUser() before every one of these reads
         (src/app/api/_lib/backend.ts getAccessToken).
*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => session.token }));

import { fetchRingState } from "./rings";
import { fetchLifeState } from "./life";

const fetchMock = vi.fn();
const sent = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    auth: new Headers((init as RequestInit | undefined)?.headers).get("Authorization"),
  }));

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    String(url).startsWith("/api/v2/user/rings")
      ? new Response(JSON.stringify({ ring: 2, features_on: ["practise"], pending_announcements: [] }))
      : new Response("{}", { status: 404 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the reads as /chat opens", () => {
  it("the ring read and the Life panel's reads carry the session's token, and go as before signed out", async () => {
    session.token = "token-maria";
    expect([...(await fetchRingState()).featuresOn]).toEqual(["practise"]);
    expect(await fetchLifeState()).toBeNull(); // 404: no panel for this person
    expect(sent()).toEqual([
      { url: "/api/v2/user/rings", auth: "Bearer token-maria" },
      { url: "/api/v2/life/state", auth: "Bearer token-maria" },
    ]);

    fetchMock.mockClear();
    session.token = null;
    expect([...(await fetchRingState()).featuresOn]).toEqual(["practise"]);
    expect(await fetchLifeState()).toBeNull();
    expect(sent()).toEqual([
      { url: "/api/v2/user/rings", auth: null },
      { url: "/api/v2/life/state", auth: null },
    ]);
  });
});
