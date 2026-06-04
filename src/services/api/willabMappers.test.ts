import { describe, expect, it } from "vitest";
import { mapReviewQueueRow } from "./reviewQueue";
import { mapLibraryEntry } from "./library";

describe("mapReviewQueueRow", () => {
  it("maps snake → camel", () => {
    expect(
      mapReviewQueueRow({
        session_id: "s",
        topic: "Q3 pitch",
        pseudonymous_user_id: "user-7f3",
        sent_at: "2026-06-01T00:00:00Z",
      })
    ).toEqual({
      sessionId: "s",
      topic: "Q3 pitch",
      pseudonymousUserId: "user-7f3",
      sentAt: "2026-06-01T00:00:00Z",
    });
  });

  it("returns null without a session_id", () => {
    expect(mapReviewQueueRow({ topic: "t" })).toBeNull();
    expect(mapReviewQueueRow(null)).toBeNull();
  });
});

describe("mapLibraryEntry", () => {
  it("maps snake → camel", () => {
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
    });
  });

  it("drops an invalid tag to null and rejects a row without an id", () => {
    expect(mapLibraryEntry({ id: "x", tag: "weird" })?.tag).toBeNull();
    expect(mapLibraryEntry({ note: "no id" })).toBeNull();
  });
});
