import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  confidenceReview — the peer-review validation loop (founder pivot,         */
/*  2026-08-03). A user/peer flags whether the AI's confidence choice on a     */
/*  piece was correct or not; the flag is ground truth for the recogniser's    */
/*  retraining corpus, provenance-separated from the blind coach labels.       */
/*                                                                            */
/*  POST /api/v2/user/snippets/<snippet_id>/confidence-review                  */
/*    { ai_correct: boolean, model_version?: string } → { saved: bool }        */
/*                                                                            */
/*  STRICT-BOOL: `ai_correct` is training data. A non-boolean at runtime      */
/*  (junk from a caller bug) is REFUSED locally — never coerced, never sent —  */
/*  because a fabricated label is worse than a missing one. Auth required:     */
/*  a peer flag must be attributable, so re-flagging replaces this             */
/*  reviewer's row instead of appending a duplicate.                           */
/* -------------------------------------------------------------------------- */

export interface ConfidenceReviewInput {
  snippetId: string;
  /** true → the AI's confidence choice was right; false → it was wrong. */
  aiCorrect: boolean;
  /** The model version whose choice the reviewer saw, when the surface has
   *  it — a validation is of ONE prediction, and the corpus wants to know
   *  which. Omitted → the BE attributes the currently-shadowed version. */
  modelVersion?: string | null;
}

export async function submitConfidenceReview(
  input: ConfidenceReviewInput
): Promise<{ saved: boolean }> {
  // Runtime guard on top of the compile-time type: a truthy string here
  // would fabricate a ground-truth label. Refuse, don't coerce.
  if (typeof input.aiCorrect !== "boolean" || !input.snippetId) {
    return { saved: false };
  }

  const payload: Record<string, unknown> = { ai_correct: input.aiCorrect };
  if (typeof input.modelVersion === "string" && input.modelVersion) {
    payload.model_version = input.modelVersion;
  }

  // Signed out (a peer flag must be attributable), unreachable or refused:
  // nothing was saved.
  const result = await bffFetch(
    `/api/v2/user/snippets/${encodeURIComponent(input.snippetId)}/confidence-review`,
    { method: "POST", json: payload, credentials: "include" }
  );
  if (result.kind !== "response" || !result.ok) return { saved: false };
  const body = result.body as { saved?: boolean } | null;
  return { saved: body?.saved === true };
}
