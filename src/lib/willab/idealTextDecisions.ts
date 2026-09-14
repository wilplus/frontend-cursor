/**
 * The Ideal Text decision handlers (audit Q-C6, founder decision 2026-09-14,
 * option b).
 *
 * `IdealTextOverlay` (the user-edit surface) and `IdealTextReadout` (the
 * read-aloud surface) are different products and stay separate. What they
 * shared was three cloned handlers — decide a tracked change, undo one, apply
 * a post-lock style — each a server call routed by the suggestion's SOURCE
 * plus the same served-list bookkeeping. The clones had already drifted: the
 * Overlay's decide omitted `source: "coach_revision"` on the suggestion-
 * feedback POST, so accepting a coach revision from the editor was stored
 * against the machine's earlier decision instead of as a new one (the BE
 * comment in user_sessions.py names exactly that failure). One function each
 * now; the surfaces keep only what differs (their refetch mechanics, the
 * editor's text fold).
 *
 * Routing (§2/§3): each lane has its own decision endpoint. A `new_take`
 * block upgrade must flip the block's incumbent, which suggestion-feedback
 * never does, so posting it there would silently no-op the accept; a
 * `prior_take` change decides on its own endpoint; everything else rides the
 * per-snippet feedback POST (the ledger remembers it).
 */
import {
  decideBlock,
  decidePriorTake,
  type BlockDecideResult,
} from "@/services/api/documentDecide";
import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  sendSuggestionFeedback,
  type SuggestionFeedbackInput,
} from "@/services/api/suggestionFeedback";

export type DecisionAction = "accept" | "keep";

/** `ok` — recorded; `stale` — 409, a newer take moved the offer (refetch,
 *  treat as handled); `error` — the request failed; `undecidable` — the
 *  suggestion lacks the ids this lane needs (nothing was sent). */
export type DecisionOutcome = "ok" | "stale" | "error" | "undecidable";

/** The three server calls a decision can route to. Injectable so the routing
 *  is testable without a network. */
export interface DecisionApi {
  decideBlock: (
    arcId: string,
    blockKey: number,
    action: DecisionAction,
    takeSessionId: string,
    texts?: { quote?: string | null; proposedText?: string | null; whyKey?: string | null },
  ) => Promise<BlockDecideResult>;
  decidePriorTake: (
    arcId: string,
    s: DocumentSuggestion,
    action: DecisionAction,
  ) => Promise<BlockDecideResult>;
  sendSuggestionFeedback: (input: SuggestionFeedbackInput) => Promise<{ saved: boolean }>;
}

export const liveDecisionApi: DecisionApi = {
  decideBlock,
  decidePriorTake,
  sendSuggestionFeedback,
};

function feedbackTarget(s: DocumentSuggestion): "document_bold" | "document_replace" {
  return s.kind === "bold" ? "document_bold" : "document_replace";
}

/** A coach supersession is stored as a new ledger decision against the
 *  currently accepted words, never as a mutation of the old decision. */
function feedbackSource(s: DocumentSuggestion): "coach_revision" | undefined {
  return s.source === "coach_revision" ? "coach_revision" : undefined;
}

/** Decide a tracked change (accept / keep), routed by its source. */
export async function postTrackedDecision(
  arcId: string | null,
  s: DocumentSuggestion,
  d: DecisionAction,
  api: DecisionApi = liveDecisionApi,
): Promise<DecisionOutcome> {
  const accept = d === "accept";
  if (s.source === "new_take") {
    if (!arcId || s.blockKey === null || !s.takeSessionId) return "undecidable";
    return (
      await api.decideBlock(arcId, s.blockKey, d, s.takeSessionId, {
        quote: s.quote,
        proposedText: s.proposedText,
        whyKey: s.why,
      })
    ).kind;
  }
  if (s.source === "prior_take") {
    if (!arcId) return "undecidable";
    return (await api.decidePriorTake(arcId, s, d)).kind;
  }
  if (!s.snippetId || !s.takeSessionId) return "undecidable";
  const r = await api.sendSuggestionFeedback({
    snippetId: s.snippetId,
    sessionId: s.takeSessionId,
    target: feedbackTarget(s),
    action: accept ? "applied" : "dismissed",
    suggestionId: s.id,
    // PROPOSAL HISTORY (slice 2) — the ledger keeps the texts.
    quote: s.quote,
    proposedText: s.proposedText,
    whyKey: s.why,
    source: feedbackSource(s),
  });
  return r.saved ? "ok" : "error";
}

/** Undo (revert) a decided tracked change. Block and prior-take decisions
 *  have no undo lane. */
export async function postTrackedUndo(
  s: DocumentSuggestion,
  api: DecisionApi = liveDecisionApi,
): Promise<"ok" | "error" | "undecidable"> {
  if (s.source === "new_take" || s.source === "prior_take") return "undecidable";
  if (!s.snippetId || !s.takeSessionId) return "undecidable";
  const r = await api.sendSuggestionFeedback({
    snippetId: s.snippetId,
    sessionId: s.takeSessionId,
    target: feedbackTarget(s),
    action: "reverted",
    suggestionId: s.id,
    quote: s.quote,
    proposedText: s.proposedText,
    whyKey: s.why,
    source: feedbackSource(s),
  });
  return r.saved ? "ok" : "error";
}

/** Apply a legacy post-lock emphasis row (the style lane; never spends a
 *  budget slot). New root styling uses the explicit exact-span endpoint. */
export async function postStyleApply(
  s: DocumentSuggestion,
  api: DecisionApi = liveDecisionApi,
): Promise<"ok" | "error" | "undecidable"> {
  if (!s.snippetId || !s.takeSessionId) return "undecidable";
  const r = await api.sendSuggestionFeedback({
    snippetId: s.snippetId,
    sessionId: s.takeSessionId,
    target: "document_bold",
    action: "applied",
    suggestionId: s.id,
    quote: s.quote,
    whyKey: s.why,
    styleLane: true,
  });
  return r.saved ? "ok" : "error";
}

/** Remember a decision on the served list so a remount never re-offers it
 *  (the server agrees). Identity-preserving when there is nothing served. */
export function withSuggestionStatus<
  T extends { suggestions: DocumentSuggestion[] | null },
>(prev: T | null, id: string, status: "approved" | "dismissed"): T | null {
  if (!prev) return prev;
  return {
    ...prev,
    suggestions: (prev.suggestions ?? []).map((x) =>
      x.id === id ? { ...x, status } : x,
    ),
  };
}

/** The style-lane counterpart: mark one post-lock style row approved. */
export function withStyleApproved<
  T extends { styleChanges: DocumentSuggestion[] | null },
>(prev: T | null, id: string): T | null {
  if (!prev) return prev;
  return {
    ...prev,
    styleChanges: (prev.styleChanges ?? []).map((x) =>
      x.id === id ? { ...x, status: "approved" as const } : x,
    ),
  };
}
