import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchArcGame,
  submitGameAnswer,
  splitTintedSegments,
} from "./arcGame";

vi.mock("@/lib/api/auth-client", () => ({ getAuthToken: async () => "tok" }));

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }))
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchArcGame", () => {
  it("402 → null (payment gate removed; the game is free)", async () => {
    mockFetch(402, { code: "PAID_ARC_REQUIRED" });
    expect(await fetchArcGame("a")).toBeNull();
  });

  it("404 → null: not-owned is an error, not 'coming soon' (the engine is live; a coach opening a student's game gets 404 by design)", async () => {
    mockFetch(404, { code: "NOT_FOUND" });
    expect(await fetchArcGame("a")).toBeNull();
    mockFetch(501, null);
    expect(await fetchArcGame("a")).toBeNull();
  });

  it("200 → rounds mapped defensively (drops transcript-less rounds)", async () => {
    mockFetch(200, {
      game_session_id: "g1",
      rounds: [
        {
          round_id: "r1",
          transcript: "The line.",
          audio_ref: "https://a/x.mp3",
          start_offset_ms: 1000,
          duration_ms: 4000,
        },
        { round_id: "r2" }, // no transcript → dropped
      ],
    });
    const r = await fetchArcGame("a");
    expect(r?.rounds).toHaveLength(1);
    expect(r?.rounds[0]).toEqual({
      roundId: "r1",
      transcript: "The line.",
      audioRef: "https://a/x.mp3",
      startOffsetMs: 1000,
      durationMs: 4000,
    });
  });

  it("accepts snippet_id as the round-id alias (round_id IS the snippet id)", async () => {
    mockFetch(200, {
      rounds: [{ snippet_id: "snip-9", transcript: "Words." }],
    });
    expect((await fetchArcGame("a"))?.rounds[0]?.roundId).toBe("snip-9");
  });

  it("drops a round without a real id — a fabricated id would POST a junk peer label (N3)", async () => {
    mockFetch(200, {
      rounds: [
        { transcript: "No id at all." },
        { round_id: "r1", transcript: "Keeps." },
      ],
    });
    expect((await fetchArcGame("a"))?.rounds.map((r) => r.roundId)).toEqual([
      "r1",
    ]);
  });

  it("200 with an empty rounds list is a VALID state — the coach hasn't labeled yet, not an error", async () => {
    mockFetch(200, { arc_id: "a", rounds: [], reason: "NO_KEY_MOMENTS_YET" });
    expect(await fetchArcGame("a")).toEqual({
      gameSessionId: null,
      rounds: [],
    });
  });

  it("200 whose served rounds ALL fail mapping → null (malformed payload, never a fake empty state)", async () => {
    mockFetch(200, { rounds: [{ round_id: "r1" }, { transcript: "" }] });
    expect(await fetchArcGame("a")).toBeNull();
  });
});

describe("submitGameAnswer", () => {
  it("maps verdict + truth + why + video (accepts alternate field names)", async () => {
    mockFetch(200, {
      correct: true,
      truth_is_key: true,
      why: ["You paused **right before** the line.", "", 42],
      breakthrough_video_ref: "https://v/x.mp4",
    });
    const v = await submitGameAnswer("a", "r1", true);
    expect(v).toEqual({
      correct: true,
      truthIsKey: true,
      why: ["You paused **right before** the line."],
      videoRef: "https://v/x.mp4",
    });
  });

  it("truth_is_key maps strictly: false stays false, absent/junk degrades to null (the reveal line hides)", async () => {
    mockFetch(200, { correct: false, truth_is_key: false, why: [] });
    expect((await submitGameAnswer("a", "r1", true))?.truthIsKey).toBe(false);
    mockFetch(200, { correct: true, truth_is_key: "yes", why: [] });
    expect((await submitGameAnswer("a", "r1", true))?.truthIsKey).toBeNull();
    mockFetch(200, { correct: true, why: [] });
    expect((await submitGameAnswer("a", "r1", true))?.truthIsKey).toBeNull();
  });

  it("soft-fails to null on error", async () => {
    mockFetch(500, null);
    expect(await submitGameAnswer("a", "r1", false)).toBeNull();
  });
});

describe("splitTintedSegments", () => {
  it("tints **kw** and ==kw== segments", () => {
    expect(splitTintedSegments("a **big** and ==bold== move")).toEqual([
      { text: "a ", tinted: false },
      { text: "big", tinted: true },
      { text: " and ", tinted: false },
      { text: "bold", tinted: true },
      { text: " move", tinted: false },
    ]);
  });

  it("returns the whole string untinted when unmarked", () => {
    expect(splitTintedSegments("plain text")).toEqual([
      { text: "plain text", tinted: false },
    ]);
  });
});
