import { readCoachReviewDraft, clearCoachReviewDraft } from "./coachReviewDraft";
import { saveCoachFeedback } from "@/services/api/saveCoachFeedback";

/* -------------------------------------------------------------------------- */
/*  Auto-save (founder 2026-09-18) — the explicit "Save feedback" button is     */
/*  gone, so leaving the Feedbacks review for the wrap-up is what commits the   */
/*  take.                                                                       */
/*                                                                             */
/*  The drafts are already on disk: CoachReviewOverlay mirrors every note / tag */
/*  / surfaced edit into localStorage 400ms after it is typed, as crash         */
/*  insurance (coachReviewDraft). That cache is therefore the honest source for */
/*  a flush — it holds exactly what the coach last saw, whether or not the      */
/*  overlay is still mounted.                                                   */
/*                                                                             */
/*  What this does NOT change: the batching. note / tag / surfaced are          */
/*  USER-FACING, so they stay local until one commit rather than saving per     */
/*  keystroke — a half-written note must not reach the student (see the header  */
/*  of CoachSnippetReviewCard). This moves WHEN that single commit happens, not */
/*  how often. Blind ratings are untouched: they have always saved on their own */
/*  immediately, through their own lane.                                        */
/* -------------------------------------------------------------------------- */

/** Persist every stored draft for these sessions. Best-effort and quiet: a
 *  failure leaves the draft on disk (so nothing is lost and the next flush
 *  retries), and returns the sessions that did not save. */
export async function flushCoachReviewDrafts(
  sessionIds: readonly string[],
): Promise<string[]> {
  const failed: string[] = [];
  for (const sessionId of sessionIds) {
    const draft = readCoachReviewDraft(sessionId);
    if (!draft) continue;
    const snippets = Object.entries(draft.snippets).map(([id, state]) => ({
      id,
      note: state.note,
      tag: state.tag,
      surfaced: state.surfaced,
    }));
    // An empty save is meaningful: "reviewed, nothing to surface" is a valid
    // verdict, and the BE stamps coach_feedback_saved_at on it by design.
    const result = await saveCoachFeedback({
      sessionId,
      overallMessage: draft.overallMessage.trim() || null,
      snippets,
    });
    if (result.ok) clearCoachReviewDraft(sessionId);
    else failed.push(sessionId);
  }
  return failed;
}
