import { bffFetch } from "@/lib/api/bffFetch";

export type FeedbackFamily =
  | "confident_voice"
  | "rewrite_clarity"
  | "great_formulation";

export type FeedbackResponse =
  | "yes" | "in_between" | "no" | "not_sure" | "audio_unclear"
  | "apply_suggestion" | "edit_myself" | "keep_wording"
  // `acknowledged` is the praise screen's Continue (BE migration 0333). The
  // rating is what marks an item decided — drop the write with the rating and
  // praise is re-offered every time the paragraph opens — so Continue still
  // writes, it just writes "read" instead of a verdict. `useful` /
  // `not_useful` stay for historical rows and any surface that still rates.
  | "acknowledged"
  | "useful" | "not_useful";

/** THE BACKEND'S REFUSAL FOR A SUPERSEDED TAKE (backend #597, 2026-09-21).
 *
 *  A Take frozen before the V3 cutover holds V2's three keys. The items the
 *  user is shown are V3's, share no identity with that set, and
 *  `record_take_feedback_response_v1` answers `not_member` — surfaced by
 *  routes/v2/user_sessions.py as HTTP 400 with exactly this string. The claim
 *  is insert-once, so the set cannot be repaired: those Takes are unanswerable
 *  permanently, and the refusal is L2 doing its job, not a fault to retry.
 *
 *  There is no distinct code for it (it shares INVALID_INPUT with every other
 *  bad body), so the string is the discriminator. Pinned by the test beside
 *  this file; if the backend line changes, that test is what breaks. */
export const FROZEN_SET_MISMATCH =
  "feedback item is not in this Take's frozen set";

export type SaveTakeFeedbackResult =
  | {
      ok: true;
      /** An accepted V3 rewrite only: what the server did to the Paragraph
       *  (F1 Repair Plan Phase 4, P1-1) -- see `acceptOutcome`. */
      textUpdate?: string;
      /** A CHANGED JUDGEMENT (founder QA1 A, D-FW-9; backend migration
       *  0440): the server kept the first Confident Voice answer and stored
       *  this one beside it. Present only when it says so; the latest answer
       *  is what every reader now uses. Never a count: no revision number
       *  reaches the client (AC-9). */
      revised?: true;
      /** What the judgement opens next, as the server chose it
       *  (`judgement_follow_up`), when it sent one. */
      followUp?: string;
    }
  | {
      ok: false;
      error: string | null;
      /** `superseded`: the Take's frozen set predates the items on screen.
       *  Not retryable — the sheet treats it as read-only, not as a failure. */
      reason?: "superseded";
    };

export async function saveTakeFeedbackResponse(input: {
  takeSessionId: string;
  feedbackId: string;
  feedbackFamily: FeedbackFamily;
  response: FeedbackResponse;
  candidateId?: string | null;
  feedbackMembershipId?: string | null;
  feedbackExposureId?: string | null;
}): Promise<SaveTakeFeedbackResult> {
  // Signed out still sends: the session cookie may authenticate.
  const result = await bffFetch(
    `/api/v2/user/takes/${encodeURIComponent(input.takeSessionId)}/feedback-response`,
    {
      method: "POST",
      auth: "optional",
      credentials: "include",
      cache: "no-store",
      json: {
        feedback_id: input.feedbackId,
        feedback_family: input.feedbackFamily,
        response: input.response,
        ...(input.candidateId && input.feedbackMembershipId && input.feedbackExposureId
          ? {
              candidate_id: input.candidateId,
              feedback_membership_id: input.feedbackMembershipId,
              feedback_exposure_id: input.feedbackExposureId,
            }
          : {}),
      },
    }
  );
  if (result.kind !== "response") return { ok: false, error: null };
  if (result.ok) return savedResult(result.body as Record<string, unknown> | null);
  const body = result.body as Record<string, unknown> | null;
  const error = typeof body?.error === "string" ? body.error : null;
  if (result.status === 400 && error === FROZEN_SET_MISMATCH) {
    return { ok: false, error, reason: "superseded" };
  }
  return { ok: false, error };
}

/** The 200 body as the caller reads it: only what the server sent. A
 *  changed Confident Voice judgement answers 200 with `revised: true`
 *  (QA1 A, D-FW-9) where it used to answer 409; it is a save like any
 *  other. */
function savedResult(
  body: Record<string, unknown> | null,
): Extract<SaveTakeFeedbackResult, { ok: true }> {
  return {
    ok: true,
    ...(typeof body?.text_update === "string" ? { textUpdate: body.text_update } : {}),
    ...(body?.revised === true ? { revised: true as const } : {}),
    ...(typeof body?.follow_up === "string" ? { followUp: body.follow_up } : {}),
  };
}

/** What an accepted rewrite's answer means for the page (F1 Repair Plan
 *  Phase 4, P1-1; contract 29b). The server writes the accepted words as a
 *  new Paragraph version from the V3 freeze that served the item:
 *
 *  - "server": it did (or already had) -- the page refetches and sends no
 *    ledger decision of its own;
 *  - "refused": it could not (helper words or a lock on the Paragraph, the
 *    words moved, a writer failure) and no word changed -- the sheet says
 *    the accept was not saved;
 *  - "legacy": the item is not a V3 rewrite the server knows, or an older
 *    backend answered -- the page decides as before. */
export function acceptOutcome(
  textUpdate: string | undefined,
): "server" | "refused" | "legacy" {
  if (textUpdate === "applied" || textUpdate === "already_applied") return "server";
  if (textUpdate === undefined || textUpdate === "not_found") return "legacy";
  return "refused";
}
