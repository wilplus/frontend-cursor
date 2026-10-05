/* -------------------------------------------------------------------------- */
/*  Leaving: the ended state, cancelling an account deletion, and the 7-day   */
/*  window on a project deletion (founder 2026-10-05, backend decisions log   */
/*  N48.4: Q14 A, Q17 A, Q19 A).                                              */
/*                                                                            */
/*  SIGNED by the founder 2026-10-05 on the Wave 3 sign-off page (W1 to W5    */
/*  A, S1 A; backend decisions log N50), with the placements: the ended       */
/*  state's signed fallback line and its "Data & consent" link (W1), "Cancel  */
/*  deletion" for the account (W2), and the training line on both delete      */
/*  confirms (W5). Change a word only with sign-off. Each surface keeps its   */
/*  constant below; S1 A switched on the ended state and cancelling, and the  */
/*  project window goes on with project Delete itself.                        */
/*                                                                            */
/*  Elsewhere and signed earlier: a project's "Deletion pending" and "Cancel  */
/*  deletion" (N8, projectDeletionCopy.ts), the account card's words          */
/*  (deleteAccountCopy.ts) and "Data & consent" (dataConsentCopy.ts). N10's   */
/*  project sentence for a training yes was retired by W5 A (N50).            */
/* -------------------------------------------------------------------------- */

/** Q19 A. A person whose processing is blocked (an account deletion, or any
 *  other service block) sees one line instead of the acceptance flow, which
 *  they could never get past. On since the founder signed its words (S1 A). */
export const ENDED_STATE_ENABLED = true;

/** Q14 A. While an account deletion is inside its 7-day window, the person
 *  can cancel it: on the ended state and on the Data & consent card. On since
 *  the founder signed its words (S1 A). */
export const ACCOUNT_DELETION_CANCEL_ENABLED = true;

/** Q17 A. The project delete's confirm states the 7-day window and a pending
 *  project shows its date. Its words are signed (W4 A); it goes on together
 *  with project Delete (PROJECT_DELETE_ENABLED in projectDeletionCopy.ts),
 *  which stays off until a project deletion can finish (S1 A). */
export const PROJECT_DELETION_WINDOW_ENABLED = false;

export const LEAVING_COPY = {
  /** The ended state, while an account deletion with a future date is
   *  pending. Without a date it shows the signed "Your account is being
   *  deleted. We'll finish within one month." instead. */
  accountDeletedOn: (date: string) => `Your account will be deleted on ${date}.`,
  /** The ended state for any other block (a restriction, a termination). */
  endedOther: "Nothing new is processed for this account.",
  /** The button, on the ended state and the Data & consent card: the words
   *  N8 signed for a project, placed for the account by W2 A. */
  cancel: "Cancel deletion",
  /** The Data & consent card, after a cancel landed. */
  cancelled: "Your account will not be deleted.",
  cancelFailed: "Couldn't cancel. Try again.",
  /** The backend refused: the window has passed or the deletion started. */
  cancelTooLate: "It can no longer be cancelled.",
  /** The account confirm's body while cancelling is on, in place of the
   *  signed "...This can't be undone. We'll finish within one month, and
   *  from now on nothing new is processed." */
  accountConfirmBody:
    "Everything you recorded and wrote here will be permanently deleted after 7 days. Until then you can cancel. From now on nothing new is processed.",
  /** Q17 A. After the first sentence of the project confirm, N8's "Every
   *  take in this project and its ideal text will be permanently deleted." */
  projectWindow:
    "The deletion happens 7 days from now and can't be undone after that. Until then the project is locked, and you can cancel.",
  /** A pending project in Data & consent, in place of "Deletion pending",
   *  while its date is ahead. */
  projectDeletedOn: (date: string) => `Will be deleted on ${date}`,
  /** W5 A. The last sentence of the project and the account delete confirms
   *  for a person with an active training yes: the training wording's own
   *  "A model already trained stays." (signed 2026-10-01), because a delete
   *  takes their training copies with it but not a model already trained on
   *  them. It replaces N10's retired project sentence. */
  trainingModelStays: "A model already trained stays.",
} as const;

/** A delete confirm's body with W5's line added for an active training yes. */
export function withTrainingLine(body: string, trainingYes: boolean): string {
  return trainingYes ? `${body} ${LEAVING_COPY.trainingModelStays}` : body;
}

/** "12 October": the day a deletion completes, in the reader's time zone.
 *  English month names, because every sentence around it is English. null
 *  for a missing or unreadable date, or one already past (the sentence would
 *  then be untrue, and the caller falls back to words without a date). */
export function deletionDate(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) return null;
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}
