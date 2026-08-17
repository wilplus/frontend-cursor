import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  suggestionFeedback — record a user's Apply / ✓-preferred / Apply-all tap    */
/*  on an instant-view piece (#190).                                            */
/*                                                                            */
/*  POST /api/v2/user/snippets/<snippet_id>/suggestion-feedback                 */
/*    { session_id, target, action, upgrade_index?, suggestion_version } →       */
/*    { saved: bool }. Guest-allowed (unclaimed sessions). Fire-and-forget:      */
/*  the tap's visual effect already happened locally, so `saved:false` (or any   */
/*  failure) is NOT an error — it just means the like/apply wasn't persisted.    */
/* -------------------------------------------------------------------------- */

/** Which part of the piece's card the tap acted on. */
export type SuggestionFeedbackTarget =
  | "upgrade" // a word/phrase swap row
  | "rewrite_your_voice"
  | "rewrite_polished"
  | "comment" // the qualitative comment row (auto_comment / coach note)
  | "comment_video"
  // MOMENT_SUGGESTIONS — a key-moment star's Approve/Revert. `moment_emphasize`
  // = a charisma phrase made bold+orange; `moment_replace` = a threat/swearing/
  // low-stickiness span swapped for an audience-fit rephrase.
  | "moment_emphasize"
  | "moment_replace"
  // LIVING TRANSCRIPT (BE-C) — a span-anchored tracked change on the document.
  // `document_replace` = a word change; `document_bold` = a proposed emphasis.
  | "document_replace"
  | "document_bold";

/** R6-FE2 — "reverted" fires when the user un-approves a row (the toggle's
 *  second click); the BE accepts it alongside the original actions. */
export type SuggestionFeedbackAction =
  | "applied"
  | "preferred"
  | "apply_all"
  | "reverted"
  // LIVING TRANSCRIPT (FE-5) — "Keep mine": the suggestion is refused and must
  // never be offered again (the BE remembers it in the decision ledger).
  | "dismissed";

export interface SuggestionFeedbackInput {
  snippetId: string;
  sessionId: string;
  target: SuggestionFeedbackTarget;
  action: SuggestionFeedbackAction;
  /** Index into `say_it_stronger.upgrades[]` when the target is a swap row. */
  upgradeIndex?: number;
  /** The card version shown (say_it_stronger.version), so the tap targets the
   *  exact version. Omitted when the payload didn't carry one. */
  suggestionVersion?: number | null;
  /** LIVING TRANSCRIPT — the tracked change's own id, so the ledger can
   *  remember THIS span's decision (a document carries many). */
  suggestionId?: string;
  /** PROPOSAL HISTORY (slice 2) — the texts ride the decide so the ledger
   *  can list this proposal later; a dismissed one is otherwise
   *  unrecoverable. Optional: older payloads simply write text-less rows. */
  quote?: string | null;
  proposedText?: string | null;
  whyKey?: string | null;
  /** THE STYLE LANE (slice 2) — marks a post-lock bold decision, which the
   *  BE records with lane:style so it never spends a ≤3 budget slot. */
  styleLane?: boolean;
  /** A coach supersession is stored as a new ledger decision against the
   *  currently accepted words, never as a mutation of the old decision. */
  source?: "coach_revision";
}

export async function sendSuggestionFeedback(
  input: SuggestionFeedbackInput
): Promise<{ saved: boolean }> {
  const token = await getAuthToken(); // optional — guest-allowed
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const payload: Record<string, unknown> = {
    session_id: input.sessionId,
    target: input.target,
    action: input.action,
  };
  if (input.suggestionId) payload.suggestion_id = input.suggestionId;
  if (input.upgradeIndex != null) payload.upgrade_index = input.upgradeIndex;
  if (input.suggestionVersion != null) {
    payload.suggestion_version = input.suggestionVersion;
  }
  if (input.quote) payload.quote = input.quote;
  if (input.proposedText) payload.proposed_text = input.proposedText;
  if (input.whyKey) payload.why_key = input.whyKey;
  if (input.styleLane) payload.style_lane = true;
  if (input.source) payload.source = input.source;

  let res: Response;
  try {
    res = await fetch(
      `/api/v2/user/snippets/${encodeURIComponent(input.snippetId)}/suggestion-feedback`,
      {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify(payload),
      }
    );
  } catch {
    return { saved: false };
  }
  if (!res.ok) return { saved: false };
  const body = (await res.json().catch(() => null)) as
    | { saved?: boolean }
    | null;
  return { saved: body?.saved === true };
}
