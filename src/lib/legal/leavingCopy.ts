/* -------------------------------------------------------------------------- */
/*  Leaving: the ended state, cancelling an account deletion, and the 7-day   */
/*  window on a project deletion (founder 2026-10-05, backend decisions log   */
/*  N48.4: Q14 A, Q17 A, Q19 A).                                              */
/*                                                                            */
/*  PROPOSED — NOT SIGNED. Every string in this file waits for the founder's  */
/*  sign-off, and each surface that shows one stays off behind its constant   */
/*  below until then, exactly as ACCOUNT_DELETE_ENABLED did before its words */
/*  were signed. Flip a constant only with the founder's word on the strings  */
/*  it shows; change a word only with sign-off.                               */
/*                                                                            */
/*  What is NOT here, because it is already signed: a project's "Deletion    */
/*  pending" and "Cancel deletion" (N8) and the N10 sentence for a project    */
/*  delete with an active training yes (projectDeletionCopy.ts), the account  */
/*  card's words (deleteAccountCopy.ts) and "Data & consent"                  */
/*  (dataConsentCopy.ts). Using a signed string somewhere new is still a      */
/*  placement for the founder to approve: the ended state's signed fallback   */
/*  line and its "Data & consent" link wait with ENDED_STATE_ENABLED.         */
/* -------------------------------------------------------------------------- */

/** Q19 A. A person whose processing is blocked (an account deletion, or any
 *  other service block) sees one line instead of the acceptance flow, which
 *  they could never get past. Off: the gate behaves as it did before. */
export const ENDED_STATE_ENABLED = false;

/** Q14 A. While an account deletion is inside its 7-day window, the person
 *  can cancel it: on the ended state and on the Data & consent card. Off: no
 *  cancel anywhere, and the card keeps its signed words. */
export const ACCOUNT_DELETION_CANCEL_ENABLED = false;

/** Q17 A. The project delete's confirm states the 7-day window and a pending
 *  project shows its date. Off: the signed N8 words stay. (Delete itself is
 *  still behind PROJECT_DELETE_ENABLED in projectDeletionCopy.ts.) */
export const PROJECT_DELETION_WINDOW_ENABLED = false;

export const LEAVING_COPY = {
  /** The ended state, while an account deletion with a future date is
   *  pending. Without a date it shows the signed "Your account is being
   *  deleted. We'll finish within one month." instead. */
  accountDeletedOn: (date: string) => `Your account will be deleted on ${date}.`,
  /** The ended state for any other block (a restriction, a termination). */
  endedOther: "Nothing new is processed for this account.",
  /** The button, on the ended state and the Data & consent card. The words
   *  N8 signed for a project; for the account they are proposed here. */
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
  /** Q17 A. After the first sentence of the project confirm (N8's "Every take
   *  in this project and its ideal text will be permanently deleted." or,
   *  with an active training yes, N10's signed sentence). */
  projectWindow:
    "The deletion happens 7 days from now and can't be undone after that. Until then the project is locked, and you can cancel.",
  /** A pending project in Data & consent, in place of "Deletion pending",
   *  while its date is ahead. */
  projectDeletedOn: (date: string) => `Will be deleted on ${date}`,
} as const;

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
