import { describe, expect, it } from "vitest";
import { mapDocumentSuggestions } from "./idealText";

/* Pins the FE mapper to the HARDENED BE tracked-changes contract
 * (services/tracked_changes.py on feat/living-transcript):
 *   top-level field `changes`; per item {id, snippet_id, kind, source,
 *   span:{start,end}, quote, proposed_text?, why?/why_key?, device?}.
 *   NO take_session_id yet (BE contract ask #2, acknowledged). */

const replace = {
  id: "s1",
  snippet_id: "s1",
  take_session_id: "t1",
  kind: "replace",
  source: "polish",
  span: { start: 2, end: 7 },
  quote: "think",
  proposed_text: "believe",
  why: "some free-text the FE must not surface",
};

describe("mapDocumentSuggestions — hardened BE `changes` shape", () => {
  it("maps a replace from span + proposed_text, nulling free-text why", () => {
    const out = mapDocumentSuggestions([replace]);
    expect(out).toHaveLength(1);
    expect(out![0]).toMatchObject({
      id: "s1",
      start: 2,
      end: 7,
      quote: "think",
      kind: "replace",
      proposedText: "believe",
      source: "polish",
      snippetId: "s1",
      takeSessionId: "t1",
      why: null, // free-text why is not one of the four keys → dropped
    });
  });

  it("reads the four-key reason from `why_key` (prior_take)", () => {
    const out = mapDocumentSuggestions([
      {
        ...replace,
        source: "prior_take",
        why: null,
        why_key: "coverage",
      },
    ]);
    expect(out![0].why).toBe("coverage");
    expect(out![0].source).toBe("prior_take");
  });

  it("keeps advice with a usable device and no proposal/pair", () => {
    const out = mapDocumentSuggestions([
      {
        id: "a1",
        snippet_id: "a1",
        kind: "advice",
        source: "delivery",
        span: { start: 0, end: 5 },
        quote: "alpha",
        device: "pause",
      },
    ]);
    expect(out![0]).toMatchObject({ kind: "advice", device: "pause" });
  });

  it("DROPS a replace/bold with no snippet+session pair (unreportable)", () => {
    // A text change the FE cannot report a decision on must not render a
    // dead Accept button — dropped, matching the mapper's other drops.
    const noPair = { ...replace, take_session_id: undefined };
    expect(mapDocumentSuggestions([noPair])).toEqual([]);
  });

  it("DROPS an advice with an unknown device (no copy → no empty modal)", () => {
    expect(
      mapDocumentSuggestions([
        {
          id: "a2",
          snippet_id: "a2",
          kind: "advice",
          source: "delivery",
          span: { start: 0, end: 5 },
          quote: "alpha",
          device: "mystery",
        },
      ])
    ).toEqual([]);
  });

  it("returns null for a missing/non-array block (absent → today's view)", () => {
    expect(mapDocumentSuggestions(undefined)).toBeNull();
    expect(mapDocumentSuggestions({})).toBeNull();
  });
});

describe("MASTER DOCUMENT — new_take upgrade offers", () => {
  it("maps source new_take with its origin take badge", () => {
    const out = mapDocumentSuggestions([
      {
        ...replace,
        source: "new_take",
        take_index: 2,
        why_key: "energy",
      },
    ]);
    expect(out![0]).toMatchObject({
      source: "new_take",
      takeIndex: 2,
      why: "energy",
      kind: "replace",
      proposedText: "believe",
    });
  });

  it("nulls a non-numeric take_index rather than guessing a badge", () => {
    const out = mapDocumentSuggestions([
      { ...replace, source: "new_take", take_index: "two" },
    ]);
    expect(out![0].takeIndex).toBeNull();
  });

  it("an upgrade offer is still approve-gated (it maps as a change, never applied)", () => {
    // The master text must never move without a tap: the mapper produces an
    // OFFER; nothing here mutates text.
    const out = mapDocumentSuggestions([{ ...replace, source: "new_take" }]);
    expect(out![0].status).toBeNull(); // pending — awaiting the user
  });
});

describe("MASTER DOCUMENT — the save state as the BE actually serves it", () => {
  // _ideal_save_state serves {saved_version, saved_at, is_saved}; `is_saved`
  // is saved_version == version AND no pending offers, so a document
  // UN-saves when a new take brings offers.
  const parse = (body: Record<string, unknown>): boolean | null =>
    typeof body.is_saved === "boolean"
      ? body.is_saved
      : typeof body.saved === "boolean"
        ? body.saved
        : null;

  it("reads is_saved, the BE's field", () => {
    expect(parse({ is_saved: true, saved_version: 3 })).toBe(true);
    expect(parse({ is_saved: false, saved_version: 2 })).toBe(false);
  });

  it("tolerates a `saved` alias so a rename cannot strand the lane", () => {
    expect(parse({ saved: true })).toBe(true);
  });

  it("absent (master flag off / never saved) → null, today's CTA unchanged", () => {
    // The whole block is omitted by _ideal_save_state in that case — the
    // re-read mic must NOT vanish behind a field that is not there.
    expect(parse({})).toBeNull();
    expect(parse({ saved_version: 3 })).toBeNull();
  });
});
