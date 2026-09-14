import { describe, expect, it, vi } from "vitest";

import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  postStyleApply,
  postTrackedDecision,
  postTrackedUndo,
  withStyleApproved,
  withSuggestionStatus,
  type DecisionApi,
} from "./idealTextDecisions";

/* -------------------------------------------------------------------------- */
/*  Audit Q-C6 (b): the three handlers the two Ideal Text surfaces cloned,     */
/*  as one function each. The routing is the contract: each lane reaches its  */
/*  own endpoint, a coach revision travels as a NEW ledger decision, and a    */
/*  suggestion without the ids its lane needs sends nothing.                  */
/* -------------------------------------------------------------------------- */

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
  it("routes a new_take block upgrade to the block endpoint with the ledger texts", async () => {
    const a = api();
    const s = suggestion({ source: "new_take", blockKey: 3 });
    expect(await postTrackedDecision(ARC, s, "accept", a)).toBe("ok");
    expect(a.decideBlock).toHaveBeenCalledWith(ARC, 3, "accept", "t1", {
      quote: "hello",
      proposedText: "hi",
      whyKey: "clearer",
    });
    expect(a.sendSuggestionFeedback).not.toHaveBeenCalled();
  });

  it("routes a prior_take change to its own endpoint", async () => {
    const a = api();
    const s = suggestion({ source: "prior_take" });
    expect(await postTrackedDecision(ARC, s, "keep", a)).toBe("ok");
    expect(a.decidePriorTake).toHaveBeenCalledWith(ARC, s, "keep");
    expect(a.sendSuggestionFeedback).not.toHaveBeenCalled();
  });

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

  it("dismisses as 'dismissed' and a bold as document_bold", async () => {
    const a = api();
    await postTrackedDecision(ARC, suggestion({ kind: "bold" }), "keep", a);
    expect(a.sendSuggestionFeedback.mock.calls[0][0]).toMatchObject({
      target: "document_bold",
      action: "dismissed",
    });
  });

  it("stores a coach revision as a NEW ledger decision (the drift the editor had)", async () => {
    const a = api();
    await postTrackedDecision(ARC, suggestion({ source: "coach_revision" }), "accept", a);
    expect(a.sendSuggestionFeedback.mock.calls[0][0]).toMatchObject({
      source: "coach_revision",
    });
  });

  it("passes the endpoint's stale and error outcomes through", async () => {
    const stale = api({ decideBlock: vi.fn(async () => ({ kind: "stale" as const })) });
    expect(
      await postTrackedDecision(ARC, suggestion({ source: "new_take", blockKey: 0 }), "accept", stale),
    ).toBe("stale");
    const failed = api({ sendSuggestionFeedback: vi.fn(async () => ({ saved: false })) });
    expect(await postTrackedDecision(ARC, suggestion(), "accept", failed)).toBe("error");
  });

  it("sends nothing when the lane's ids are missing", async () => {
    const a = api();
    expect(await postTrackedDecision(null, suggestion({ source: "new_take", blockKey: 1 }), "accept", a)).toBe("undecidable");
    expect(await postTrackedDecision(ARC, suggestion({ source: "new_take", blockKey: null }), "accept", a)).toBe("undecidable");
    expect(await postTrackedDecision(ARC, suggestion({ source: "new_take", blockKey: 1, takeSessionId: null }), "accept", a)).toBe("undecidable");
    expect(await postTrackedDecision(null, suggestion({ source: "prior_take" }), "accept", a)).toBe("undecidable");
    expect(await postTrackedDecision(ARC, suggestion({ snippetId: null }), "accept", a)).toBe("undecidable");
    expect(await postTrackedDecision(ARC, suggestion({ takeSessionId: null }), "accept", a)).toBe("undecidable");
    expect(a.decideBlock).not.toHaveBeenCalled();
    expect(a.decidePriorTake).not.toHaveBeenCalled();
    expect(a.sendSuggestionFeedback).not.toHaveBeenCalled();
  });
});

describe("postTrackedUndo", () => {
  it("reverts through the feedback POST, carrying the coach-revision source", async () => {
    const a = api();
    expect(await postTrackedUndo(suggestion({ source: "coach_revision", kind: "bold" }), a)).toBe("ok");
    expect(a.sendSuggestionFeedback).toHaveBeenCalledWith({
      snippetId: "sn1",
      sessionId: "t1",
      target: "document_bold",
      action: "reverted",
      suggestionId: "s1",
      quote: "hello",
      proposedText: "hi",
      whyKey: "clearer",
      source: "coach_revision",
    });
  });

  it("has no undo lane for block and prior-take decisions, and needs the ids", async () => {
    const a = api();
    expect(await postTrackedUndo(suggestion({ source: "new_take", blockKey: 1 }), a)).toBe("undecidable");
    expect(await postTrackedUndo(suggestion({ source: "prior_take" }), a)).toBe("undecidable");
    expect(await postTrackedUndo(suggestion({ snippetId: null }), a)).toBe("undecidable");
    expect(a.sendSuggestionFeedback).not.toHaveBeenCalled();
    const failed = api({ sendSuggestionFeedback: vi.fn(async () => ({ saved: false })) });
    expect(await postTrackedUndo(suggestion(), failed)).toBe("error");
  });
});

describe("postStyleApply", () => {
  it("applies a post-lock bold on the style lane", async () => {
    const a = api();
    expect(await postStyleApply(suggestion({ kind: "bold" }), a)).toBe("ok");
    expect(a.sendSuggestionFeedback).toHaveBeenCalledWith({
      snippetId: "sn1",
      sessionId: "t1",
      target: "document_bold",
      action: "applied",
      suggestionId: "s1",
      quote: "hello",
      whyKey: "clearer",
      styleLane: true,
    });
  });

  it("needs the ids and reports a failed save", async () => {
    const a = api();
    expect(await postStyleApply(suggestion({ takeSessionId: null }), a)).toBe("undecidable");
    expect(a.sendSuggestionFeedback).not.toHaveBeenCalled();
    const failed = api({ sendSuggestionFeedback: vi.fn(async () => ({ saved: false })) });
    expect(await postStyleApply(suggestion(), failed)).toBe("error");
  });
});

describe("the served-list bookkeeping", () => {
  it("marks exactly the decided suggestion and keeps null served state", () => {
    const prev = { suggestions: [suggestion({ id: "a" }), suggestion({ id: "b" })], other: 1 };
    const next = withSuggestionStatus(prev, "b", "dismissed");
    expect(next?.suggestions?.map((s) => [s.id, s.status])).toEqual([
      ["a", "pending"],
      ["b", "dismissed"],
    ]);
    expect(next?.other).toBe(1);
    expect(prev.suggestions[1].status).toBe("pending");
    expect(withSuggestionStatus(null, "b", "approved")).toBeNull();
    expect(withSuggestionStatus({ suggestions: null }, "b", "approved")).toEqual({ suggestions: [] });
  });

  it("marks exactly the applied style row approved", () => {
    const prev = { styleChanges: [suggestion({ id: "a" }), suggestion({ id: "b" })] };
    const next = withStyleApproved(prev, "a");
    expect(next?.styleChanges?.map((s) => [s.id, s.status])).toEqual([
      ["a", "approved"],
      ["b", "pending"],
    ]);
    expect(withStyleApproved(null, "a")).toBeNull();
  });
});
