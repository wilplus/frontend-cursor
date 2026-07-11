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
  it("402 → paywall sentinel (same $25 gate)", async () => {
    mockFetch(402, { code: "PAID_ARC_REQUIRED" });
    expect(await fetchArcGame("a")).toEqual({ paymentRequired: true });
  });

  it("501 (stub) and 404 (unshipped) → notAvailable, never an error", async () => {
    mockFetch(501, { code: "NOT_YET_AVAILABLE" });
    expect(await fetchArcGame("a")).toEqual({ notAvailable: true });
    mockFetch(404, null);
    expect(await fetchArcGame("a")).toEqual({ notAvailable: true });
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
    expect(r && "rounds" in r && r.rounds).toHaveLength(1);
    expect(r && "rounds" in r && r.rounds[0]).toEqual({
      roundId: "r1",
      transcript: "The line.",
      audioRef: "https://a/x.mp3",
      startOffsetMs: 1000,
      durationMs: 4000,
    });
  });

  it("200 with zero usable rounds → notAvailable (no empty game)", async () => {
    mockFetch(200, { rounds: [] });
    expect(await fetchArcGame("a")).toEqual({ notAvailable: true });
  });
});

describe("submitGameAnswer", () => {
  it("maps verdict + why + video (accepts alternate field names)", async () => {
    mockFetch(200, {
      correct: true,
      why: ["You paused **right before** the line.", "", 42],
      breakthrough_video_ref: "https://v/x.mp4",
    });
    const v = await submitGameAnswer("a", "r1", true);
    expect(v).toEqual({
      correct: true,
      why: ["You paused **right before** the line."],
      videoRef: "https://v/x.mp4",
    });
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
