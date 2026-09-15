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

  /* --- a new take landed mid-edit (409 VERSION_SUPERSEDED) ----------------
     The card that lived here is RETIRED (founder 2026-08-10, option A). With
     per-part persistence the typed paragraphs arrive PINNED inside the
     refetched document, so there is nothing to hold and offer back — R7
     satisfied structurally, not by deleting an apology. */

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
  /* FOUNDER COPY VERBATIM (2026-08-10, second decision — supersedes the
     post-accept "Lock it" chip): "if you accept or reject you can lock it
     or not; not yet lock in / lock in". The lock choice rides the decide
     popover; these are his two options, his words. */
  lockIn: "Lock in",
  lockNotYet: "Not yet lock in",
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

/* -------------------------------------------------------------------------- */
/*  THE CHUNK SHEET LADDER (founder-signed-off 2026-09-15, with designs)       */
/*                                                                            */
/*  One decision per screen. Every string the sheet shows is here rather than  */
/*  in JSX, for the reason the file header gives: a sign-off is one file to    */
/*  read, and no string can quietly ship from a component edit.                */
/*                                                                            */
/*  Each PILL is the verb of its own screen — Apply on Suggestion, Emphasise   */
/*  on Emphasis, Lock on Lock. A pill that said "Continue" everywhere would    */
/*  make the screens interchangeable, which is the opposite of what splitting  */
/*  them was for. "Continue" survives in exactly one place, Good job, because  */
/*  there genuinely is nothing to decide there.                                */
/* -------------------------------------------------------------------------- */

export const CHUNK_SHEET_COPY = {
  /* --- screen titles ------------------------------------------------------ */
  titleFeedback: "Feedback",
  titleSuggestion: "Suggestion",
  titlePraise: "Good job",
  titleEmphasis: "Emphasis",
  titleLock: "Lock",
  /* Reopening a clean paragraph is an edit, not the end of a review. */
  titleEditChunk: "Edit this chunk",

  /* --- pills (one per screen, black) -------------------------------------- */
  pillDone: "Done",
  pillContinue: "Continue",
  pillApply: "Apply",
  pillEmphasise: "Emphasise",
  pillChooseWords: "Choose different words",
  pillLock: "Lock",
  pillDiscard: "Discard",

  /* --- links (grey, stacked under the pill, never beside it) -------------- */
  linkKeepWording: "Keep wording",
  linkChooseWords: "Choose different words",
  linkSkip: "Skip",
  linkKeepEvolving: "Keep evolving",

  /* --- card eyebrows ------------------------------------------------------ */
  cardWhatYouSaid: "What you said",
  cardClearerVersion: "Clearer version",
  cardWithEmphasis: "With emphasis",
  /* An INSTRUCTION for the interaction rather than a label for the content,
     which is why it does not read "With emphasis" like its sibling. Founder
     left it deliberately (handoff, "one note"). */
  cardTapWords: "Tap the words",

  /* --- the one qualitative question --------------------------------------- */
  confidenceQuestion: "Does this sound confident to you?",

  /* --- failures (red text, same plain box as every other message) ---------- */
  failApply: "Your choice is safe, but the text update needs another try.",
  failKeep: "Your choice is safe. Refresh to continue.",
  failLockBlocked: "Decide every suggestion on this chunk first.",
  failLock: "Couldn't lock this in. Try again.",
  failEvolve: "Couldn't keep this paragraph evolving. Try again.",
  failEmphasis: "Couldn't apply that. Try again.",
  failUnlock: "Couldn't unlock this. Try again.",
  failRoot: "Couldn't save those words. Try again.",
  failResponse: "Couldn't save that response. Try again.",
} as const;
