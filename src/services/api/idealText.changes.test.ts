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
