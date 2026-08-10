/* -------------------------------------------------------------------------- */
/*  idealEditCopy — every user-visible string in the add/rearrange feature      */
/*  (T1 · 1.2), in ONE place.                                                  */
/*                                                                            */
/*  ALL OF IT IS PLACEHOLDER, PENDING FOUNDER SIGN-OFF (LIVE LOOP fence, R13). */
/*  It lives here rather than inline so the sign-off is one file to read and   */
/*  one file to change, and so no string can quietly ship from a JSX edit.     */
/*                                                                            */
/*  The persistence lines are written FROM the honest semantics table and must */
/*  stay that way: a reword is baked into the next version, an addition or a   */
/*  move is NOT, it is offered back for one-click re-apply. Nothing here may   */
/*  promise that additions become part of the next version (parked founder     */
/*  decision, 2026-07-28).                                                    */
/* -------------------------------------------------------------------------- */

export const IDEAL_EDIT_COPY = {
  /* --- the arrange mode toggle ------------------------------------------- */
  arrangeOpen: "Add or move parts",
  arrangeDone: "Done",

  /* --- adding ------------------------------------------------------------ */
  addHere: "Add text here",
  addPlaceholder: "Type what you want to say here",
  addConfirm: "Add",
  addCancel: "Cancel",

  /* --- moving ------------------------------------------------------------ */
  dragHandle: "Move this part",
  moveUp: "Move up",
  moveDown: "Move down",
  removePart: "Remove this part",

  /* --- the honest note under the parts ----------------------------------- */
  persistenceNote:
    "Rewording sticks. Anything you add or move here is yours to keep, and when a new take lands you get one tap to put it back.",

  /* --- a new take landed mid-edit (409 VERSION_SUPERSEDED) ---------------- */
  supersededTitle: "A new take just landed",
  supersededBody:
    "This is the fresh text from your latest take. Your version is safe, put it back whenever you want.",
  supersededReapply: "Put my version back",
  supersededDismiss: "Keep the new text",

  /* --- the BE's recording gate (can_record_take === false) --------------- */
  /* Reason-free ON PURPOSE: the BE does not tell us WHY it closed the gate,
     so any specific line here would be a guess presented as fact. */
  recordUnavailable: "Recording another take is not available right now.",

  /* --- failures ---------------------------------------------------------- */
  tooLong:
    "That is longer than this text can hold. Nothing was lost, trim it a little and it saves.",

  /* --- MATERIAL RECOVERY (founder-approved 2026-08-07) -------------------- */
  /* Words the speaker SAID, on a slide their script has no block for. Not a
     suggestion and not feedback: it is their own material, currently missing.
     "Not now" is honest about what happens — the offer is dropped, and if they
     say it again in a later take it is offered again. */
  additionsHeading: "New material detected",
  additionAccept: "Add to script",
  additionDecline: "Not now",

  /* --- LOCKING (founder-approved 2026-08-07) ------------------------------ */
  /* A lock is not a setting: it changes WHICH KIND of suggestion may fire on
     that section. Open takes rewrites; locked takes emphasis only. */
  lockPart: "Lock section",
  unlockPart: "Unlock section",
  /* R3 — a section with undecided suggestions cannot be locked, because
     locking would make those suggestions unreachable. Auto-deciding them would
     write a decision the student never made. */
  lockBlocked:
    "Please approve or disregard pending suggestions before locking.",
  /* 409 STALE_DOCUMENT has NO string, deliberately. The document moved under
     the student (a take assembled, or the coach verified), and the existing
     lane already answers that by silently refetching — the text visibly
     refreshing IS the message. A seventh line here would be un-signed-off copy
     saying what the screen already says. */
} as const;
