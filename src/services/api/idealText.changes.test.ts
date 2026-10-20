/*
STORY    As a speaker, I want a new Take's suggested upgrade shown as an offer
         and never applied to my text without my yes, so that my Ideal Text
         is only what I said or chose.
OUTCOME
  O1  An upgrade offered by a new Take arrives as a pending offer, not as an
      applied change.
PROVES   O1 -> "is approve-gated — maps as a pending OFFER, never applied"
WHY      Never-rule 5: the Ideal Text is only what the speaker said.
*/
import { describe, expect, it } from "vitest";
import { mapDocumentSuggestions } from "./idealText";

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
