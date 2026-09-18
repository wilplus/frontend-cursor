import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "token" }));

import { fetchPracticeQueue, savePracticeAnswer } from "./voiceAlbumPractice";

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

describe("fetchPracticeQueue", () => {
  it("keeps the backend's order", async () => {
    fetchMock.mockResolvedValue(
      ok({
        mine: [
          { snippet_id: "s2", arc_id: "arc-1", take_session_id: "sess-1" },
          { snippet_id: "s1", arc_id: "arc-1", take_session_id: "sess-1" },
        ],
        general: [],
        general_available: false,
      })
    );
    const out = await fetchPracticeQueue();
    expect(out?.mine.map((c) => c.snippetId)).toEqual(["s2", "s1"]);
    expect(out?.generalAvailable).toBe(false);
  });

  it("drops a clip missing any of the three ids that identify the recording", async () => {
    // Without all three the answer cannot be attached to one exact clip, so
    // showing the card would offer a question nothing could record.
    fetchMock.mockResolvedValue(
      ok({
        mine: [
          { snippet_id: "s1", arc_id: "arc-1" },
          { arc_id: "arc-1", take_session_id: "sess-1" },
          { snippet_id: "s3", arc_id: "arc-1", take_session_id: "sess-1" },
        ],
      })
    );
    expect((await fetchPracticeQueue())?.mine.map((c) => c.snippetId)).toEqual(["s3"]);
  });

  it("returns null on a failed read, never an empty queue", async () => {
    // [] means "nothing left to answer" and shows the finish screen; a failed
    // read must not be able to say that.
    fetchMock.mockResolvedValue({ ok: false, json: async () => null } as Response);
    expect(await fetchPracticeQueue()).toBeNull();
  });
});

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

  it.each(["yes", "in_between", "no", "not_sure", "audio_unclear"] as const)(
    "sends %s whole, never folded into another state",
    async (answer) => {
      fetchMock.mockResolvedValue(ok({ saved: true }));
      await savePracticeAnswer(clip, answer);
      expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).response).toBe(answer);
    }
  );

  it("reports a refused write so the screen can keep the question open", async () => {
    fetchMock.mockResolvedValue({ ok: false } as Response);
    expect(await savePracticeAnswer(clip, "yes")).toBe(false);
  });
});
