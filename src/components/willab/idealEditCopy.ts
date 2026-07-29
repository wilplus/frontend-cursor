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
} as const;
