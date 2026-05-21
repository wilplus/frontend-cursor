import { describe, expect, it } from "vitest";
import { isPublishTransition } from "./publishLiveTransition";

describe("isPublishTransition", () => {
  it("null → timestamp string = publish event", () => {
    expect(
      isPublishTransition({
        old: { results_published_at: null },
        new: { results_published_at: "2026-05-22T12:00:00Z" },
      })
    ).toBe(true);
  });

  it("undefined → timestamp string = publish event (REPLICA IDENTITY missing case)", () => {
    expect(
      isPublishTransition({
        old: {}, // Postgres replica identity FULL not set → old is empty
        new: { results_published_at: "2026-05-22T12:00:00Z" },
      })
    ).toBe(true);
  });

  it("missing old entirely → publish event", () => {
    // Some Supabase configs omit `old` on UPDATE altogether.
    expect(
      isPublishTransition({
        new: { results_published_at: "2026-05-22T12:00:00Z" },
      })
    ).toBe(true);
  });

  it("timestamp → timestamp = NOT publish event (republish / metadata update)", () => {
    expect(
      isPublishTransition({
        old: { results_published_at: "2026-05-22T11:00:00Z" },
        new: { results_published_at: "2026-05-22T12:00:00Z" },
      })
    ).toBe(false);
  });

  it("null → null = no-op update (other column changed)", () => {
    expect(
      isPublishTransition({
        old: { results_published_at: null, some_other_field: "old" },
        new: { results_published_at: null, some_other_field: "new" },
      })
    ).toBe(false);
  });

  it("timestamp → null = unpublish event, NOT a publish (we ignore)", () => {
    expect(
      isPublishTransition({
        old: { results_published_at: "2026-05-22T12:00:00Z" },
        new: { results_published_at: null },
      })
    ).toBe(false);
  });

  it("empty string treated as unpublished on either side", () => {
    // Defensive — Supabase Realtime has been known to emit empty
    // strings for nullable columns in some edge cases.
    expect(
      isPublishTransition({
        old: { results_published_at: "" },
        new: { results_published_at: "2026-05-22T12:00:00Z" },
      })
    ).toBe(true);
    expect(
      isPublishTransition({
        old: { results_published_at: "2026-05-22T12:00:00Z" },
        new: { results_published_at: "" },
      })
    ).toBe(false);
  });

  it("null/undefined payload → safe no-op (defensive)", () => {
    expect(isPublishTransition({})).toBe(false);
    expect(isPublishTransition({ old: null, new: null })).toBe(false);
  });
});
