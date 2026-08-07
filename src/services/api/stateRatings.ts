/* -------------------------------------------------------------------------- */
/*  stateRatings — the state-generic ternary instrument (SPEC v3 §3.2, §6).    */
/*                                                                            */
/*  ONE instrument for every measured cognitive state: a single clip, a single */
/*  question, three answers — yes / no / neutral — plus a SEPARATE             */
/*  `unrateable` control that is not an answer.                               */
/*                                                                            */
/*  WHY `unrateable` IS NOT A FOURTH VALUE (mirrors services/state_ratings.py, */
/*  which is the source of truth for this contract):                          */
/*    `neutral` is a judgment about the MOMENT — it reads as middling.        */
/*    `unrateable` is a judgment about the RATER's ability to make one,        */
/*    usually because the audio is unclear. Folding the second into the first  */
/*    books bad audio as a real middling rating and poisons the one class that */
/*    defines the decision boundary. Kept apart, the ternary stays clean and   */
/*    abstention rate survives as a rater-quality signal.                      */
/*                                                                            */
/*  This is why the UI puts "Ambiguous" among the primary chips and            */
/*  "Unrateable" below them as a secondary control — the shapes differ because */
/*  the quantities differ.                                                     */
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
export const TERNARY_VALUES = ["yes", "no", "neutral"] as const;
export type TernaryValue = (typeof TERNARY_VALUES)[number];

/** The only state with a written operational definition today (§1.4). A state
 *  with no definition cannot ship — the backend refuses it by name. */
export const CONFIDENCE_STATE_ID = "confidence";

/** The question text for `confidence`, mirroring services/state_ratings.py's
 *  `conf-q-v1`. Rendered above the chips so "Yes" means something: without the
 *  question on screen the answer space is unanchored. */
export const CONFIDENCE_QUESTION = "Does the speaker sound confident here?";

export interface StateRatingBody {
  state_id: string;
  /** Omitted entirely when `unrateable` is true — the backend rejects a body
   *  carrying both, and that rejection is the contract, not a formality. */
  value?: TernaryValue;
  unrateable?: boolean;
  note?: string;
}

/** Build a rating body, or null when the input cannot express a real answer.
 *
 *  The null return is the point: a body that would fabricate a label the coach
 *  never gave must be impossible to CONSTRUCT, not merely rejected later. */
export function buildRatingBody(
  value: TernaryValue | null,
  unrateable: boolean,
  stateId: string = CONFIDENCE_STATE_ID,
  note?: string | null
): StateRatingBody | null {
  const body: StateRatingBody = { state_id: stateId };
  if (unrateable) {
    // Abstention. `value` is deliberately NOT sent — see the header.
    body.unrateable = true;
  } else {
    if (value === null || !TERNARY_VALUES.includes(value)) return null;
    body.value = value;
  }
  const trimmed = note?.trim() ?? "";
  if (trimmed) body.note = trimmed;
  return body;
}

export type SaveRatingResult = { ok: true } | { ok: false; error: string | null };

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
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const err = data?.error;
  return { ok: false, error: typeof err === "string" && err ? err : null };
}
