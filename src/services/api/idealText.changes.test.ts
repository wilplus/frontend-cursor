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

describe("MASTER DOCUMENT — new_take block upgrade offers", () => {
  // The real BE shape: a new_take carries block_key + take_session_id, and its
  // snippet_id is deliberately NULL (the decision routes to blocks/decide).
  const blockUpgrade = {
    id: "block:10",
    snippet_id: null,
    take_session_id: "t9",
    block_key: 10,
    kind: "replace",
    source: "new_take",
    span: { start: 2, end: 7 },
    quote: "think",
    proposed_text: "believe",
    take_index: 2,
    why_key: "energy",
  };

  it("maps a block upgrade with block_key + origin badge (snippet_id null)", () => {
    const out = mapDocumentSuggestions([blockUpgrade]);
    expect(out).toHaveLength(1);
    expect(out![0]).toMatchObject({
      source: "new_take",
      blockKey: 10,
      takeIndex: 2,
      why: "energy",
      kind: "replace",
      proposedText: "believe",
      snippetId: null,
      takeSessionId: "t9",
    });
  });

  it("DROPS a new_take with no block_key (unroutable — the earlier silent-drop bug)", () => {
    const { block_key: _b, ...noBlock } = blockUpgrade;
    void _b;
    expect(mapDocumentSuggestions([noBlock])).toEqual([]);
  });

  it("DROPS a new_take with no take_session_id (blocks/decide needs the echo)", () => {
    expect(
      mapDocumentSuggestions([{ ...blockUpgrade, take_session_id: null }])
    ).toEqual([]);
  });

  it("nulls a non-numeric take_index rather than guessing a badge", () => {
    expect(
      mapDocumentSuggestions([{ ...blockUpgrade, take_index: "two" }])![0]
        .takeIndex
    ).toBeNull();
  });

  it("is approve-gated — maps as a pending OFFER, never applied", () => {
    expect(mapDocumentSuggestions([blockUpgrade])![0].status).toBeNull();
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
