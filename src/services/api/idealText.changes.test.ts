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

  it("is approve-gated — maps as a pending OFFER, never applied", () => {
    expect(mapDocumentSuggestions([blockUpgrade])![0].status).toBeNull();
  });
});
