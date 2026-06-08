import { describe, expect, it } from "vitest";
import { mapReviewQueueRow } from "./reviewQueue";
import { mapLibraryEntry } from "./library";

describe("mapReviewQueueRow", () => {
  it("maps snake → camel (§B.1 shape)", () => {
    expect(
      mapReviewQueueRow({
        session_id: "s",
        pseudonym: "Playful Octopus",
        domain: "public_speaking",
        topic: "Q3 pitch",
        n_snippets: 8,
        state: "pending",
        sent_at: "2026-06-01T00:00:00Z",
      })
    ).toEqual({
      sessionId: "s",
      pseudonym: "Playful Octopus",
      domain: "public_speaking",
      topic: "Q3 pitch",
      nSnippets: 8,
      state: "pending",
      sentAt: "2026-06-01T00:00:00Z",
    });
  });

  it("defaults missing optionals + clamps unknown state to pending", () => {
    expect(
      mapReviewQueueRow({
        session_id: "s",
        state: "weird",
      })
    ).toEqual({
      sessionId: "s",
      pseudonym: "",
      domain: "",
      topic: "",
      nSnippets: 0,
      state: "pending",
      sentAt: "",
    });
  });

  it("accepts in_progress and done states", () => {
    expect(
      mapReviewQueueRow({ session_id: "s", state: "in_progress" })?.state
    ).toBe("in_progress");
    expect(mapReviewQueueRow({ session_id: "s", state: "done" })?.state).toBe(
      "done"
    );
  });

  it("returns null without a session_id", () => {
    expect(mapReviewQueueRow({ topic: "t" })).toBeNull();
    expect(mapReviewQueueRow(null)).toBeNull();
  });
});

describe("mapLibraryEntry", () => {
  it("maps snake → camel (snippet null when no snippet_ref)", () => {
    expect(
      mapLibraryEntry({
        id: "x",
        session_id: "s",
        snippet_id: "n1",
        note: "great open",
        tag: "strong",
        created_at: "t",
      })
    ).toEqual({
      id: "x",
      sessionId: "s",
      snippetId: "n1",
      note: "great open",
      tag: "strong",
      createdAt: "t",
      snippet: null,
    });
  });

  it("parses snippet_ref into the playable clip (FE-6 / T7)", () => {
    const e = mapLibraryEntry({
      id: "x",
      session_id: "s",
      snippet_id: "n1",
      note: "strong open",
      tag: "strong",
      created_at: "t",
      snippet_ref: {
        audio_ref: "https://cdn/full.webm",
        start_offset_ms: 1200,
        duration_ms: 6000,
        transcript: "…and that's when I realized…",
      },
    });
    expect(e?.snippet).toEqual({
      audioRef: "https://cdn/full.webm",
      startOffsetMs: 1200,
      durationMs: 6000,
      transcript: "…and that's when I realized…",
    });
  });

  it("drops an invalid tag to null and rejects a row without an id", () => {
    expect(mapLibraryEntry({ id: "x", tag: "weird" })?.tag).toBeNull();
    expect(mapLibraryEntry({ note: "no id" })).toBeNull();
  });
});
