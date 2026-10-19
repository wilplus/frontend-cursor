/*
STORY    As a speaker, I want accepting or keeping a suggestion on my Ideal
         Text saved to the right place for its kind, so that my decision
         sticks and a suggestion with missing ids sends nothing broken.
OUTCOME
  O1  A new-take block upgrade goes to blocks/decide, and nowhere else.
  O2  A prior-take change goes to its own route, and nowhere else.
  O3  Every other source rides the per-snippet feedback POST; a coach
      revision travels there as a NEW decision (source coach_revision).
  O4  A suggestion without the ids its lane needs sends nothing.
PROVES   O1 -> "sends a new-take block upgrade to the block decision"
         O2 -> "sends a prior-take change to its own route"
         O3 -> "rides the per-snippet feedback POST for every other source"
         O3 -> "stores a coach revision as a new decision"
         O4 -> "sends nothing when the lane's ids are missing"
WHY      Audit Q-C6 (b): the Overlay's clone dropped source coach_revision.
*/
import { describe, expect, it, vi } from "vitest";

import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  postTrackedDecision,
  type DecisionApi,
} from "./idealTextDecisions";

const ARC = "11111111-1111-4111-8111-111111111111";

function suggestion(over: Partial<DocumentSuggestion> = {}): DocumentSuggestion {
  return {
    id: "s1",
    start: 0,
    end: 5,
    quote: "hello",
    kind: "replace",
    proposedText: "hi",
    device: null,
    cueKeys: null,
    audioUrl: null,
    startMs: null,
    durationMs: null,
    why: "clearer",
    source: "polish",
    status: "pending",
    snippetId: "sn1",
    takeSessionId: "t1",
    takeIndex: 1,
    visual: "star",
    ...over,
  } as DocumentSuggestion;
}

function api(over: Partial<DecisionApi> = {}): DecisionApi & {
  decideBlock: ReturnType<typeof vi.fn>;
  decidePriorTake: ReturnType<typeof vi.fn>;
  sendSuggestionFeedback: ReturnType<typeof vi.fn>;
} {
  return {
    decideBlock: vi.fn(async () => ({ kind: "ok" as const })),
    decidePriorTake: vi.fn(async () => ({ kind: "ok" as const })),
    sendSuggestionFeedback: vi.fn(async () => ({ saved: true })),
    ...over,
  } as never;
}

describe("postTrackedDecision", () => {

  it("rides the per-snippet feedback POST for every other source", async () => {
    const a = api();
    expect(await postTrackedDecision(ARC, suggestion(), "accept", a)).toBe("ok");
    expect(a.sendSuggestionFeedback).toHaveBeenCalledWith({
      snippetId: "sn1",
      sessionId: "t1",
      target: "document_replace",
      action: "applied",
      suggestionId: "s1",
      quote: "hello",
      proposedText: "hi",
      whyKey: "clearer",
      source: undefined,
    });
    expect(a.decideBlock).not.toHaveBeenCalled();
    expect(a.decidePriorTake).not.toHaveBeenCalled();
  });

  it("sends a new-take block upgrade to the block decision", async () => {
    const a = api();
    const s = suggestion({ source: "new_take", blockKey: 4 } as Partial<DocumentSuggestion>);
    expect(await postTrackedDecision(ARC, s, "accept", a)).toBe("ok");
    expect(a.decideBlock).toHaveBeenCalledWith(ARC, 4, "accept", "t1", {
      quote: "hello",
      proposedText: "hi",
      whyKey: "clearer",
    });
    expect(a.decidePriorTake).not.toHaveBeenCalled();
    expect(a.sendSuggestionFeedback).not.toHaveBeenCalled();
  });

  it("sends a prior-take change to its own route", async () => {
    const a = api();
    const s = suggestion({ source: "prior_take" } as Partial<DocumentSuggestion>);
    expect(await postTrackedDecision(ARC, s, "keep", a)).toBe("ok");
    expect(a.decidePriorTake).toHaveBeenCalledWith(ARC, s, "keep");
    expect(a.decideBlock).not.toHaveBeenCalled();
    expect(a.sendSuggestionFeedback).not.toHaveBeenCalled();
  });

  it("stores a coach revision as a new decision", async () => {
    const a = api();
    const s = suggestion({ source: "coach_revision" } as Partial<DocumentSuggestion>);
    expect(await postTrackedDecision(ARC, s, "keep", a)).toBe("ok");
    expect(a.sendSuggestionFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ action: "dismissed", source: "coach_revision" }),
    );
  });

  it("sends nothing when the lane's ids are missing", async () => {
    const a = api();
    const cases: Array<[string | null, Partial<DocumentSuggestion>]> = [
      [ARC, { source: "new_take", blockKey: null } as Partial<DocumentSuggestion>],
      [ARC, { source: "new_take", blockKey: 4, takeSessionId: null } as Partial<DocumentSuggestion>],
      [null, { source: "prior_take" } as Partial<DocumentSuggestion>],
      [ARC, { snippetId: null } as Partial<DocumentSuggestion>],
    ];
    for (const [arc, over] of cases) {
      expect(await postTrackedDecision(arc, suggestion(over), "accept", a)).toBe("undecidable");
    }
    expect(a.decideBlock).not.toHaveBeenCalled();
    expect(a.decidePriorTake).not.toHaveBeenCalled();
    expect(a.sendSuggestionFeedback).not.toHaveBeenCalled();
  });
});
