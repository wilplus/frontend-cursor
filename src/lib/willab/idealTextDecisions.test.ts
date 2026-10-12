import { describe, expect, it, vi } from "vitest";

import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  postTrackedDecision,
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
});
