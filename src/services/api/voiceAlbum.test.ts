import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/auth-client", () => ({
  getAuthToken: async () => "token",
}));

import {
  fetchMomentHistory,
  fetchVoiceAlbum,
  saveMomentNote,
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

  it("carries an admitted practice attempt's key through unchanged", async () => {
    // `practice:<id>` IS the identity the history and note endpoints take —
    // rewriting it here would break both.
    fetchMock.mockResolvedValue(
      ok({
        projects: [
          { arc_id: "arc-1", title: "T", entries: [{ snippet_id: "practice:att-2" }] },
        ],
      })
    );
    const out = await fetchVoiceAlbum();
    expect(out?.[0].entries[0].momentKey).toBe("practice:att-2");
  });

  it("regroups an older flat payload so the screen has one code path", async () => {
    fetchMock.mockResolvedValue(
      ok({
        entries: [
          { snippet_id: "s1", arc_id: "arc-1" },
          { snippet_id: "s2", arc_id: "arc-1" },
          { snippet_id: "s3", arc_id: "arc-2" },
        ],
      })
    );
    const out = await fetchVoiceAlbum();
    expect(out?.length).toBe(2);
    expect(out?.[0].entries.length).toBe(2);
  });

  it("drops a project group that carries no usable entry", async () => {
    fetchMock.mockResolvedValue(
      ok({ projects: [{ arc_id: "arc-1", title: "T", entries: [{}] }] })
    );
    expect(await fetchVoiceAlbum()).toEqual([]);
  });

  it("returns null on a failed read, never an empty album", async () => {
    // [] means "you have no moments yet" and shows the empty copy; a failed
    // read must not be able to say that.
    fetchMock.mockResolvedValue({ ok: false, json: async () => null } as Response);
    expect(await fetchVoiceAlbum()).toBeNull();
  });
});

describe("fetchMomentHistory", () => {
  it("maps every lane the surface draws", async () => {
    fetchMock.mockResolvedValue(
      ok({
        moment_key: "s1",
        origin: { take_index: 2, slide_index: 8, at: "2026-08-15T10:00:00Z", source: "snippet" },
        events: [
          { kind: "owner_answer", who: "You", at: "1", response: "yes" },
          { kind: "coach_agreed", who: "Your coach", at: "2" },
          {
            kind: "exercise",
            at: "3",
            title: "Pause anchor",
            instruction: "Hold the pause.",
            video_url: "https://v/1",
            attempts: [
              { attempt_id: "a1", index: 1, audio_url: "u1", duration_ms: 5400, kept: false },
              { attempt_id: "a2", index: 2, audio_url: "u2", duration_ms: 6000, kept: true },
            ],
          },
          { kind: "note", who: "You", at: "4", body: "Play before Thursday.", note_id: "n1" },
        ],
      })
    );
    const out = await fetchMomentHistory("arc-1", "s1");
    expect(out?.origin).toEqual({
      takeIndex: 2,
      slideIndex: 8,
      at: "2026-08-15T10:00:00Z",
      source: "snippet",
    });
    expect(out?.events.map((e) => e.kind)).toEqual([
      "owner_answer",
      "coach_agreed",
      "exercise",
      "note",
    ]);
    const exercise = out?.events[2];
    expect(exercise?.kind === "exercise" && exercise.attempts[1].kept).toBe(true);
  });

  it("skips an event kind it does not know rather than drawing a blank row", async () => {
    fetchMock.mockResolvedValue(
      ok({ moment_key: "s1", origin: {}, events: [{ kind: "something_new", at: "1" }] })
    );
    expect((await fetchMomentHistory("arc-1", "s1"))?.events).toEqual([]);
  });

  it("asks for the moment by its exact key", async () => {
    fetchMock.mockResolvedValue(ok({ moment_key: "practice:a1", origin: {}, events: [] }));
    await fetchMomentHistory("arc-1", "practice:a1");
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "moment=practice%3Aa1"
    );
  });
});

describe("saveMomentNote", () => {
  it("returns the stored note so the thread updates without a refetch", async () => {
    fetchMock.mockResolvedValue(
      ok({ note: { kind: "note", who: "You", at: "5", body: "mine", note_id: "n2" } })
    );
    const note = await saveMomentNote("arc-1", "s1", "mine");
    expect(note).toEqual({
      kind: "note",
      who: "You",
      at: "5",
      body: "mine",
      noteId: "n2",
    });
  });

  it("returns null when the write is refused, so the UI can say so", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => null } as Response);
    expect(await saveMomentNote("arc-1", "s1", "mine")).toBeNull();
  });
});
