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
/*  Each PILL is the verb of its own screen — Apply on Suggestion, Use this    */
/*  phrase on Emphasis, Lock on Lock. A pill that said "Continue" everywhere   */
/*  would make the screens interchangeable, which is the opposite of what      */
/*  splitting them was for. "Continue" survives in exactly one place, Good     */
/*  job, because there genuinely is nothing to decide there.                   */
/* -------------------------------------------------------------------------- */

export const CHUNK_SHEET_COPY = {
  /* --- screen titles ------------------------------------------------------ */
  titleFeedback: "Feedback",
  titleSuggestion: "Suggestion",
  titlePraise: "Good job",
  /* Step three, the only place the asynchronous side of the product reaches
     this sheet. The title carries the whole label: the offer card deliberately
     has no eyebrow and no corner icon, because the screen has already said
     what it is (founder 2026-09-16, §3). */
  titleExercise: "Exercise",
  /* Founder 2026-09-24: the emphasis step is where the speaker picks the
     helper words that show while recording the next take. */
  titleEmphasis: "Choose your helper words",
  /* Under the title on the emphasis step, after Take 1 only — later takes
     have seen helper words while recording, so they only get the title. */
  /* NAMES THE CONDITION, because it was not true for everyone. Helper words
     are only shown while recording once the paragraph is locked, so a speaker
     who taps words and never locks was promised something that never arrived
     (founder-reported, 2026-09-25). Written as a statement rather than an
     instruction on purpose: on "No", "Not sure" and "Audio unclear" the Lock
     step is not built at all, so "lock it" would be an instruction they cannot
     follow. */
  emphasisFirstTakeNote:
    "Once locked, these words show while you record your next take",
  titleLock: "Lock",
  /* Reopening a clean paragraph is an edit, not the end of a review. */
  titleEditChunk: "Edit this chunk",

  /* --- pills (one per screen, black) -------------------------------------- */
  pillDone: "Done",
  pillContinue: "Continue",
  pillApply: "Apply",
  /* The orange phrase, named by what it DOES rather than by the formatting it
     applies. Founder 2026-09-16, resolving the one string the ladder left
     homeless: "Use this phrase" was signed off while its only mount point was
     the deleted root face's "Make this phrase orange" — and the founder's
     answer was that the two were always the same action. So it lands here, on
     the step that picks the phrase and hands it to the lock to promote. */
  pillEmphasise: "Use this phrase",
  pillChooseWords: "Choose different words",
  pillLock: "Lock",
  /* The exercise step's two pills. They differ by one word on purpose:
     "Practise again" appears only after Back off the judgement screen, and it
     spends one of the capped attempts on a NEW run rather than resuming the
     one already judged. A pill that still read "Practise" there would make a
     fresh recording look like a return to the last one. */
  pillPractise: "Practise",
  /* The green label on an exercise already completed on an earlier Take
     (founder 2026-09-26, Q44: "just add a little green label 'done'"). */
  exerciseDone: "Done",
  pillPractiseAgain: "Practise again",
  /* NOT a new string. §3 says "Practise records in place" and the screen table
     has no stop state, but a recording still has to be endable — so this is
     the label the retired practice view already used for that exact action,
     carried over rather than invented. Flagged in the PR as the one place the
     handoff's table is silent. */
  pillStop: "Stop",

  /* --- links (grey, stacked under the pill, never beside it) -------------- */
  linkKeepWording: "Keep wording",
  linkChooseWords: "Choose different words",
  /* linkSkip is GONE with the button that used it (founder 2026-09-16, §5):
     the emphasis step has no opt-out, because it only appears on a paragraph
     already judged Yes. */
  /* "Not now" declines the exercise and closes the practice server-side, so it
     does not return on the next Take. "Back" leaves the judgement without
     answering it and lands on the offer — the same screen a rejected attempt
     lands on, which is the known silence flagged in §3. */
  linkNotNow: "Not now",
  linkBack: "Back",

  /* --- card eyebrows ------------------------------------------------------ */
  cardWhatYouSaid: "What you said",
  cardClearerVersion: "Clearer version",
  cardWithEmphasis: "With emphasis",
  /* The judgement screen shows the corrected take ALONE — the original
     playback is gone from it, so this eyebrow is the only thing naming which
     recording is in the orange card. */
  cardCorrectedVersion: "Corrected version",
  /* An INSTRUCTION for the interaction rather than a label for the content,
     which is why it does not read "With emphasis" like its sibling. Founder
     left it deliberately (handoff, "one note"). */
  cardTapWords: "Tap the words",

  /* --- praise on weak evidence -------------------------------------------
     FOUNDER WORDING, 2026-09-24, replacing "This may be one of the strongest
     formulations in this Take." That line hedged about "formulations" without
     saying the one true thing: of everything in THIS take, this is the moment
     that landed most confident — and it is still not finished. His words, his
     sign-off (option B of the two he was offered); it was inline in the sheet
     until now, which is exactly the quiet copy this file exists to prevent.

     AC-9 holds: "the most confident on this take" is a comparison inside one
     take, which is what the lane already is. No number, no band, no rank. */
  praiseTentative:
    "On this take, this landed the most confident — and there is still room to improve.",

  /* --- the one qualitative question --------------------------------------- */
  confidenceQuestion: "Does this sound confident to you?",

  /* --- a superseded Take (grey text, the plain box, NOT a failure) ---------
     SIGNED OFF by the founder 2026-09-21 — option A of the three offered
     (B "Older take: this feedback is read-only. Record your next take to
     answer." · C "This feedback was prepared before an update and no longer
     takes answers. Keep going — your next take will."). A Take frozen
     before the V3 cutover (backend #591/#597)
     cannot take answers any more — the question stays on screen, as ruled
     ("the first step should by all means be kept"), and this line explains
     why the chips do nothing and Continue is the way on.                  */
  noticeSuperseded:
    "This take was reviewed under an earlier version, so answers here can't be saved. Your next take will ask again.",

  /* --- failures (red text, same plain box as every other message) ---------- */
  failApply: "Your choice is safe, but the text update needs another try.",
  failKeep: "Your choice is safe. Refresh to continue.",
  failLockBlocked: "Decide every suggestion on this chunk first.",
  failLock: "Couldn't lock this in. Try again.",
  failEmphasis: "Couldn't apply that. Try again.",
  failRoot: "Couldn't save those words. Try again.",
  /* A DIFFERENT FAILURE NEEDS A DIFFERENT SENTENCE. `failRoot` ends in "Try
     again", which is right when the server refused the write and wrong when
     the words no longer exist in the paragraph — retrying cannot find them.
     Both cases used to share one line, so half the people reading it were
     told to do the one thing that could not work. */
  failRootStale: "Those words aren't in the text any more. Tap them again.",
  failResponse: "Couldn't save that response. Try again.",

  /* --- the answered bookmark (founder 2026-09-25, Q19 A / Q21 A) -----------
     SIGNED OFF as written. An answered bookmark opens on one screen: the
     exercise, if the moment has one; "You said" and the answer in one line;
     what happened to the moment in one or two boxes; then how the Slide's
     words and helper words changed. "Before" is gone with the two-list
     layout: the timeline shows each Take with its own helper words (Q26 B). Words only — no score (AC-9). "Exercise"
     and "Practise" reuse titleExercise and pillPractise above. */
  /* --- "You have judged this as your …" (founder 2026-09-26) -------------
     SIGNED OFF as written, replacing "You said: <chip>". The answered sheet
     says the owner's own judgement back as one sentence, one per answer.
     Words only — the answer is the owner's self-report, never a score. */
  historyJudgedYes: "You have judged this as your confident moment",
  historyJudgedInBetween: "You have judged this as your moment in-between",
  historyJudgedNo: "You have judged this as your not-so-much confident moment",
  historyJudgedAudioUnclear: "This audio playback was unclear",
  historyJudgedNotSure: "You were not sure how to judge this one",
  historyCorrectionAccepted: "Correction accepted",
  historyPraised: "Praised",
  historyFromPractice: "From your practice",
  historyHowItChanged: "How this changed",
  historyTake: "Take",
  historyHelperWords: "Helper words",
  /* --- Back / Next across the bookmarks (founder 2026-09-25, Q31 B / Q32 A) -
     The coach panel's own footer words, copied so the two read as one
     product. The right-hand button always says Next, and Done on the last
     bookmark, where it closes the sheet. */
  pagerBack: "Back",
  pagerNext: "Next",
  pagerDone: "Done",
  historyNow: "Now",
} as const;
