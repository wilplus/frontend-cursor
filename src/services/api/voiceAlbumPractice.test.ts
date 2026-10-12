import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "token" }));

import { savePracticeAnswer } from "./voiceAlbumPractice";

function ok(body: unknown) {
  return { ok: true, json: async () => body, headers: new Headers() } as unknown as Response;
}

const clip = {
  snippetId: "s1",
  projectId: "arc-1",
  projectTitle: "Series A",
  takeSessionId: "sess-1",
  takeIndex: 2,
  slideIndex: 3,
  audioUrl: "https://cdn/s1",
  startOffsetMs: 0,
  durationMs: 6000,
};

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("savePracticeAnswer", () => {
  it("sends the exact recording and the answer unchanged", async () => {
    fetchMock.mockResolvedValue(ok({ saved: true, response: "in_between" }));
    await savePracticeAnswer(clip, "in_between");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual({
      arc_id: "arc-1",
      take_session_id: "sess-1",
      snippet_id: "s1",
      response: "in_between",
    });
  });
});
