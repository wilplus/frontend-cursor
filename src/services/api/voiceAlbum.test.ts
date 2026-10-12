import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "token",
}));

import {
  fetchVoiceAlbum,
} from "./voiceAlbum";

function ok(body: unknown) {
  return {
    ok: true,
    json: async () => body,
    headers: new Headers(),
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchVoiceAlbum", () => {
  it("keeps the backend's project grouping and per-project order", async () => {
    fetchMock.mockResolvedValue(
      ok({
        projects: [
          {
            arc_id: "arc-1",
            title: "Series A",
            entries: [
              { snippet_id: "s2", slide_index: 2, audio_url: "a2" },
              { snippet_id: "s7", slide_index: 7, audio_url: "a7" },
            ],
          },
          { arc_id: "arc-2", title: null, entries: [{ snippet_id: "s9" }] },
        ],
      })
    );
    const out = await fetchVoiceAlbum();
    expect(out?.map((p) => p.projectId)).toEqual(["arc-1", "arc-2"]);
    expect(out?.[0].entries.map((e) => e.momentKey)).toEqual(["s2", "s7"]);
    expect(out?.[0].title).toBe("Series A");
  });

  it("returns null on a failed read, never an empty album", async () => {
    // [] means "you have no moments yet" and shows the empty copy; a failed
    // read must not be able to say that.
    fetchMock.mockResolvedValue({ ok: false, json: async () => null } as Response);
    expect(await fetchVoiceAlbum()).toBeNull();
  });
});
