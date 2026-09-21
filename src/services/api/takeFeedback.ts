import { getAuthToken } from "@/lib/api/auth-client";

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
  | { ok: true }
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
  const token = await getAuthToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(
      `/api/v2/user/takes/${encodeURIComponent(input.takeSessionId)}/feedback-response`,
      {
        method: "POST",
        headers,
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
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
        }),
      }
    );
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const error = typeof body?.error === "string" ? body.error : null;
    if (res.status === 400 && error === FROZEN_SET_MISMATCH) {
      return { ok: false, error, reason: "superseded" };
    }
    return { ok: false, error };
  } catch {
    return { ok: false, error: null };
  }
}
