/* -------------------------------------------------------------------------- */
/*  stateRatings — the state-generic confidence instrument (SPEC v3 §3.2).    */
/*                                                                            */
/*  ONE instrument for every measured cognitive state: a single clip, a single */
/*  question and five explicit responses. yes / in_between / no are the       */
/*  perceptual positions; not_sure and audio_unclear preserve why a rater     */
/*  did not make one of those three judgments.                                */
/*                                                                            */
/*  VERSION 2 removes the old overloaded `neutral`: `in_between` is a real    */
/*  perceptual middle, `not_sure` is rater uncertainty, and `audio_unclear`   */
/*  is a technical failure. Historical neutral/unrateable rows remain readable */
/*  but new writes always carry one of the five explicit values.              */
/*                                                                            */
/*  BLIND (I1). The backend stamps `saw_model_output: false` on every row it   */
/*  writes here, so a surface that shows the machine's read while collecting a */
/*  rating would put a LIE in the corpus that is unrecoverable afterwards.     */
/*  That is why CoachSnippetReviewCard carries no acoustic needle: the         */
/*  invariant is asserted server-side, so it has to be true client-side.       */
/*                                                                            */
/*  STRICT TYPES, no coercion — the backend refuses a coerced value and so do  */
/*  we. This is training data; a coerced label records a human verdict no      */
/*  human gave and is indistinguishable from a real one afterwards.            */
/* -------------------------------------------------------------------------- */

import { getAuthToken } from "@/lib/api/auth-client";

/** The fixed answer space. Never varies by state — the QUESTION carries the
 *  state. Per-state answer labels would make raters' behaviour incomparable
 *  across states, a wording effect masquerading as a reliability difference. */
export const CONFIDENCE_RATING_VALUES = [
  "yes",
  "in_between",
  "no",
  "not_sure",
  "audio_unclear",
] as const;
export type ConfidenceRatingValue =
  (typeof CONFIDENCE_RATING_VALUES)[number];

/** The only state with a written operational definition today (§1.4). A state
 *  with no definition cannot ship — the backend refuses it by name. */
export const CONFIDENCE_STATE_ID = "confidence";

/** The question text for `confidence`, mirroring services/state_ratings.py's
 *  `conf-q-v2`. Rendered above the controls so "Yes" means something: without the
 *  question on screen the answer space is unanchored. */
export const CONFIDENCE_QUESTION = "Does the speaker sound confident here?";

export interface StateRatingBody {
  state_id: string;
  value: ConfidenceRatingValue;
  note?: string;
  /** True only when the row came from the server's mandatory second-listen
   * queue. It is workflow provenance, never a rating value. */
  re_review?: boolean;
}

/** Build a rating body, or null when the input cannot express a real answer.
 *
 *  The null return is the point: a body that would fabricate a label the coach
 *  never gave must be impossible to CONSTRUCT, not merely rejected later. */
export function buildRatingBody(
  value: ConfidenceRatingValue | null,
  legacyUnrateable = false,
  stateId: string = CONFIDENCE_STATE_ID,
  note?: string | null
): StateRatingBody | null {
  const resolved = legacyUnrateable ? "audio_unclear" : value;
  if (
    resolved === null ||
    !CONFIDENCE_RATING_VALUES.includes(resolved)
  )
    return null;
  const body: StateRatingBody = { state_id: stateId, value: resolved };
  const trimmed = note?.trim() ?? "";
  if (trimmed) body.note = trimmed;
  return body;
}

export type SaveRatingResult =
  | { ok: true; transcript?: string }
  | { ok: false; error: string | null };

/** THE CONFIDENT VOICE CARD'S "do you agree?" (founder 2026-08-15).
 *
 *  This is an ANCHORED owner response on a card that has already told the
 *  speaker what the machine thinks. The endpoint carries one narrow purpose:
 *  answer routes the displayed moment into (or out of) the Voice Album. The
 *  backend stores it in a dedicated routing table. It is never a training,
 *  calibration, quorum, evaluation, SFT or DPO signal. */
export async function saveConfidenceAgreement(
  snippetId: string,
  body: StateRatingBody
): Promise<SaveRatingResult> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: null };
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/confidence-agree`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
  } catch {
    return { ok: false, error: null };
  }
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const err = data?.error;
  return { ok: false, error: typeof err === "string" && err ? err : null };
}

/** Persist one rating. Re-rating REPLACES this rater's row (the corpus wants
 *  their current view); other raters' rows are untouched, so multi-rater
 *  agreement stays possible.
 *
 *  Never throws — the caller renders `error` inline. A null error means "no
 *  session / transport died", which is not the same as the backend's verbatim
 *  400 and must not be shown as one. */
export async function saveStateRating(
  snippetId: string,
  body: StateRatingBody
): Promise<SaveRatingResult> {
  const token = await getAuthToken();
  if (!token) return { ok: false, error: null };
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/snippets/${encodeURIComponent(snippetId)}/confidence-label`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
  } catch {
    return { ok: false, error: null };
  }
  const data = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (res.ok) {
    return {
      ok: true,
      ...(typeof data?.transcript === "string"
        ? { transcript: data.transcript }
        : {}),
    };
  }
  const err = data?.error;
  return { ok: false, error: typeof err === "string" && err ? err : null };
}
