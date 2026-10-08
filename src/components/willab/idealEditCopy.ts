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
  /* --- V3 could not make the Feedback (Phase 2; signed off 2026-10-04) --- */
  feedbackFailed:
    "We couldn't prepare your feedback this time. Your text is saved.",
  feedbackRetry: "Try again",

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
  /* THE BOOKMARK WENT TO THE COACH (founder 2026-09-29, contract 35g-2).
     SIGNED OFF as written, the same day: "One okay". Shown on the Exercise
     screen in place of the video and instruction when the speaker judged the
     moment No and nothing in the library matched, and on the paragraph sheet
     where Practise sits, until the coach shares an exercise. One sentence,
     no second line. */
  coachWorkingOnExercise: "Your coach is working on your exercise.",
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
  /* Shown on the Feedback sheet's emphasis step AND the paragraph sheet's
     helper-word picker, on Take 1 (founder 2026-10-05, N48.3 Q8 A). */
  emphasisFirstTakeNote:
    "These words show while you record your next take",
  titleLock: "Lock",
  /* Step 0 (founder 2026-09-29, Q1; Final Screens L8). "Your coach" and
     "Take N" are the signed-off coach-card words (L6). */
  titleCoach: "Your coach",
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
  /* Founder 2026-09-26 (Ideal Text redesign, decision 1: "Use these helper
     words" replaces Lock). The same tap saves and locks the words; the word
     "lock" said the paragraph was frozen, and the next take rewrites it
     (clause 8). No icon on the button. */
  pillEmphasise: "Use these helper words",
  /* "Edit", the mock's word (founder 2026-10-05, N48.3 Q8 A; it read
     "Choose different words" until then). */
  pillChooseWords: "Edit",
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
  linkKeepWording: "Keep my wording",
  linkChooseWords: "Edit",
  /* linkSkip is GONE with the button that used it (founder 2026-09-16, §5):
     the emphasis step has no opt-out, because it only appears on a paragraph
     already judged Yes. */
  /* "Not now" declines the exercise and closes the practice server-side, so it
     does not return on the next Take. "Back" leaves the judgement without
     answering it and lands on the offer — the same screen a rejected attempt
     lands on, which is the known silence flagged in §3. */
  /* "Not now" is RETIRED from these screens (founder lock 2026-09-30,
     D10): the plain-text link under Practise reads "Skip", on the paragraph
     overlay and on the exercise offer alike. "Back" leaves the judgement
     without answering it and lands on the offer. */
  linkSkip: "Skip",
  linkBack: "Back",
  /* THE REWRITE AMENDMENT (founder 2026-09-30, C11; contract 29b): the
     rewrite card's one button accepts the clearer words and opens the
     practise on them; the grey link keeps the speaker's own words. Both
     strings are the founder's, from the accepted readiness design. */
  pillAcceptPractise: "Accept and practise",
  linkKeepMyWords: "Keep my words",

  /* --- card eyebrows ------------------------------------------------------ */
  cardWhatYouSaid: "What you said",
  /* "Clearer version", the lock's and the mock's word (founder 2026-10-05,
     N48.3 Q8 A; it read "Small rewrite" until then). */
  cardClearerVersion: "Clearer version",
  cardWithEmphasis: "With emphasis",
  /* The judgement screen shows the corrected take ALONE — the original
     playback is gone from it, so this eyebrow is the only thing naming which
     recording is in the orange card. */
  cardCorrectedVersion: "Corrected version",
  /** The practice judgement's player label (accepted screen L1, 2026-09-26). */
  practiceAttemptLabel: (n: number) => `Your practice · attempt ${n}`,
  /** The live practice recording (accepted coach journey, 2026-09-26). */
  practiceAttemptRecording: (n: number) => `Attempt ${n}`,
  /* An INSTRUCTION for the interaction rather than a label for the content,
     which is why it does not read "With emphasis" like its sibling. Founder
     left it deliberately (handoff, "one note"). */
  cardTapWords: "Tap the words",
  /** Beside "Tap the words" on both pickers (founder lock 2026-09-30, B3;
   *  signed with the lock, B9): how many of the four the run holds. */
  emphasisCount: (picked: number) => `${picked} of 4 words`,

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
  failLock: "Couldn't save your helper words. Try again.",
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
  /* Founder 2026-09-26 (Ideal Text redesign, L6): the one new string. Heads
     the folded rows of earlier Takes under the current one, so history reads
     as history. */
  historyEarlierTakes: "Earlier Takes",
  /* Under the slide editor (founder 2026-09-26, J11). */
  editorNextTakeNote:
    "Your next Take rewrites this from what you say. This version stays in the history.",
  historyTake: "Take",
  historyHelperWords: "Helper words",
  /* --- Back / Next across the bookmarks (founder 2026-09-25, Q31 B / Q32 A) -
     The coach panel's own footer words, copied so the two read as one
     product. The right-hand button says Next on every bookmark, the last
     one too (founder 2026-10-05, N48.3 Q8 A: "Done" becomes "Next"; it read
     Done on the last bookmark until then). */
  pagerBack: "Back",
  pagerNext: "Next",
  /* Founder 2026-09-26 (Ideal Text redesign, accepted screens): the walk's
     position in the sheet header, "Slide 2 · moment 1 of 4". It counts
     positions in the walk, as Back / Next always did — never problems found
     (AC-9). */
  pagerMoment: "moment",
  pagerOf: "of",
  /* Shown for a moment after a sheet finishes, then the next moment opens. */
  toastHelperWordsSaved: "Helper words saved",
  toastAnswerSaved: "Answer saved",
  /* Tap and go (founder 2026-09-28): a save that failed after the sheet had
     already moved on. The answer notice was signed off with its Retry; the
     words notice is the first sentence of the signed `failRoot`. */
  failAnswerBehind: "Couldn't save your answer.",
  failWordsBehind: "Couldn't save those words.",
  retryBehind: "Retry",
  /* After the last moment of the walk. */
  endCardTitle: "That's every moment for this Take",
  endCardBack: "Back to the text",
  historyNow: "Now",

  /* --- THE PARAGRAPH OVERLAY (founder lock 2026-09-30, B5, B9, D1, D7, Q1) -
     Signed with the lock, B9: the overlay's title, "Your judgement:", the
     History row and "Say it again" (D1). The saved state's title is the
     toast's own words; "Next" is `pagerNext` and "Practise" is `pillPractise`
     above. The words after "Your judgement:" are the ones on the speaker's
     own answer chips, never the machine's read (D7, L3). */
  titleParagraph: "This paragraph",
  titleSaved: "Helper words saved",
  judgementLabel: "Your judgement:",
  judgementWord: {
    yes: "Confident",
    in_between: "In-between",
    no: "Not confident",
    not_sure: "Not sure",
    audio_unclear: "Audio unclear",
  },
  historyRow: "History",
  cardSayItAgain: "Say it again",
  /* --- THE PRACTISE SCREEN (founder lock 2026-09-30, B6, B9, Q4, Q5) ------
     Signed with the lock: "Say it this way" heads the rewrite's words, and
     "From your attempt" heads the picker over the attempt's own words.
     "Practise" is `pillPractise`; "Skip" is `linkSkip`; the exercise's
     words are headed by its own instruction; the plain moment by
     `cardSayItAgain`. */
  titlePractise: "Practise",
  cardSayItThisWay: "Say it this way",
  /** The same heading once the words were accepted (29b), from the accepted
   *  readiness design: the speaker is told the words on screen are now the
   *  paragraph's. */
  cardSayItThisWayAccepted: "Say it this way · accepted",
  fromYourAttempt: "From your attempt",
  /* --- THE HELPER WORDS OVERLAY (founder lock 2026-09-30, B4, B9, D4, D5, Q2, Q3)
     Built from the mock as it stands (Q4 A). Its title is the eyebrow
     `historyHelperWords`; "Delete" and "Delete helper words" are the one
     confirmation (Q2); "now" marks the current Take's chip and "new" the
     words about to replace the saved ones; the line under the picker on a
     later Take is signed with the lock (B9). */
  helperWordsDelete: "Delete",
  helperWordsDeleteConfirm: "Delete helper words",
  chipNow: "now",
  chipNew: "new",
  tapWordsFromAnyTake: "Tap words from any Take",
  helperWordsReplaceNote: (take: number) =>
    `These replace your Take ${take} words. Those stay in Earlier Takes.`,
} as const;

/* -------------------------------------------------------------------------- */
/*  THE FEEDBACK WALK'S NEW WORDS (founder lock 2026-10-06; decisions log      */
/*  N52.5)                                                                     */
/*                                                                            */
/*  The eleven lines the founder wrote in chat for the walk (N52.5), and the   */
/*  words signed with the line bank the same evening (N54,                    */
/*  docs/SIGNED-line-bank-2026-10-06.md in the backend repo; copied exactly): */
/*  the answer toast's form, the encouragement when nothing moved (NX3a), the */
/*  sharing choices and messages (WQ5 A, WQ6 A). Every other word on the       */
/*  walk's screens is already in CHUNK_SHEET_COPY above or in the shared      */
/*  answer vocabulary. The lines after the third try that isn't praise       */
/*  (CM3b A, N55) and the clearer version's button when personalised         */
/*  practice is off (WQ3c A) were signed minutes later. The "Journal"        */
/*  eyebrow above the post in the walk was signed with Q-B4 A (N62).          */
/* -------------------------------------------------------------------------- */

export const WALK_COPY = {
  /* A practise the machine did not hear improve: encouragement, then another
     practise, until praise or Skip. */
  encourage: "It was better, and I have yet another practice for you to try!",
  /* "Judgement time!" — after the practising, before the judgements. */
  judgementTitle: "Judgement time!",
  judgementHonesty:
    "If you are honest when judging others, it will help you find your confident voice and calm the inner critic 😌",
  /* The grey link; opens the Journal post inside the flow. */
  judgementJournalLink: "More about self-modeling theory",
  /* Above the Journal post the link opens inside the walk (Q-B4 A, N62: "Journal"
     shows above the post in the walk). The post's title and words are the
     published post's own (JP1 A, N53). */
  journalEyebrow: "Journal",
  judgementPromise: "I am going to judge them honestly",
  skip: "Skip",
  /* The clearer version's message, around the new words. */
  clearerOffer: "Here is a slightly more polished option:",
  clearerAsk: "Do you accept and want to practise it?",
  /* The exercise video's button. */
  exercisePractise: "Practise",
  /* Sharing, after every finished review. */
  shareTitle: "After all, it's about speaking publicly!",
  shareAsk: "Do you agree to share this take with others?",

  /* --- signed with the line bank (N54) ----------------------------------- */
  /* After a try where nothing moved (NX3a), rotating; `encourage` above shows
     only when something moved. */
  encourageNothingMoved: [
    "Let's try it once more. I have another practice for you!",
    "Let's give it another go. I have one more practice for you!",
    "Not quite yet. Here's another practice to try!",
    "Keep going! I have another practice for you to try.",
  ],
  /* After the third try that isn't praise (CM3a A: up to three tries; CM3b A,
     N55), rotating; the walk then moves on to "Judgement time!". */
  afterThirdTry: [
    "Great effort! Let's move on and come back to this one later.",
    "Thanks for giving it your all. On to the next step!",
    "You worked hard on this one. Let's keep going!",
    "Nice persistence! We'll move on for now.",
  ],
  /* The clearer version's button when personalised practice is off (WQ3c A):
     the words can be taken into the text but not practised. "Keep my words"
     stays below it (CHUNK_SHEET_COPY.linkKeepMyWords). */
  clearerAccept: "Accept",
  /** The answer toast (WQ4 A): the chosen answer's own word, with a tick. */
  answerToast: (answer: string) => `${answer} ✓`,
  /* Sharing choices (WQ5 A). Consent words: they never rotate. */
  shareGeneral: "General community",
  shareGeneralHint: "Fastest improvement in speaking publicly",
  shareMine: "Only my community",
  shareMineHint: "Slower but steady growth",
  shareOwn: "Set up my own community",
  shareNone: "None",
  shareNoneHint: "Slowest progress, but safe",
  fieldPassCode: "Pass code",
  fieldCommunityName: "Community name",
  /* Sharing messages (WQ6 A). */
  sharePassCodeTaken: "That pass code is taken. Try another one.",
  sharePassCodeUnknown: "No community has that pass code.",
  shareAcceptTerms: "Please accept the updated Terms and Privacy first.",
  shareFailed: "Couldn't share this take. Try again.",
} as const;

/* -------------------------------------------------------------------------- */
/*  THE SIGNED LINE BANK, B01 to B14 (founder 2026-10-06, N54)                 */
/*                                                                            */
/*  Copied exactly from docs/SIGNED-line-bank-2026-10-06.md in the backend    */
/*  repo; a line not there does not ship. B01 to B09 are praise, each firing  */
/*  only on the cue it names (B09 when no single cue stands out); B10 to B12  */
/*  are the clearer version's reasons; B13 opens the new text and B14 asks    */
/*  under it. Rotation (never the same line twice in a row) and the "later"   */
/*  lines (from Take 2 on, with the real Take number, only when true) are the */
/*  caller's rules. No number but the Take number ever appears (AC-9).        */
/* -------------------------------------------------------------------------- */

export const WALK_LINE_BANK = {
  /* sounded surer (general) */
  B01: {
    lines: [
      "Sounded more confident than usual!",
      "You sounded more sure of yourself than usual!",
      "There it is: more confidence than usual!",
      "That came out bold and sure. More than usual!",
      "You sounded like you really believed it this time!",
    ],
    later: (take: number) => `This sounded more confident than on Take ${take}.`,
  },
  /* voice moved up and down */
  B02: {
    lines: [
      "Your voice danced up and down. That kept it alive!",
      "No flat line here: your voice went up and down and pulled me in!",
      "Your voice had real melody. It sounded alive!",
      "Up and down, like music. That's how a confident voice moves!",
    ],
    later: (take: number) => `Your voice moved more here than on Take ${take}.`,
  },
  /* louder and softer words */
  B03: {
    lines: [
      "You made some words loud and some soft. That gave it shape!",
      "You pushed the big words and let the small ones rest. Great!",
      "Loud where it mattered, soft where it didn't. That landed!",
      "Your volume moved with your meaning. Very strong!",
    ],
    later: (take: number) => `You used loud and soft more than on Take ${take}.`,
  },
  /* fewer stops */
  B04: {
    lines: [
      "You kept going without stopping. It flowed like a river!",
      "Hardly any stops. You just kept talking, sure of yourself!",
      "Smooth and steady, no stumbling. That sounded confident!",
      "You didn't stop to search for words. You just knew!",
    ],
    later: (take: number) => `Fewer stops here than on Take ${take}.`,
  },
  /* lower, calmer voice */
  B05: {
    lines: [
      "This delivery was calm and steady",
      "Calm and grounded. Your voice sat low and steady here!",
      "Your voice was calm and smooth. It sounded like you were in charge!",
      "Nice and steady. Nothing could shake you here!",
      "Grounded and calm, like someone who knows exactly what they mean.",
    ],
    later: (take: number) => `Your voice sat lower than on Take ${take}. It sounded calm.`,
  },
  /* kept the speed */
  B06: {
    lines: [
      "You weren't rushing, but your pace was good and rhythmic. This part sounded confident and right on time.",
      "Good rhythm! You kept your pace and didn't drag.",
      "Right on time: no rushing, no dragging, just the right pace!",
      "Your pace held steady all through this part. Confident!",
      "You moved like a clock here: steady and sure!",
    ],
    later: (take: number) => `You kept your pace better than on Take ${take}.`,
  },
  /* ending went down */
  B07: {
    lines: [
      "That was great. You weren't asking me, you were simply saying what you mean. At the end you were just saying it straight!",
      "You ended it like a statement, not a question. Straight and sure!",
      "No question mark at the end. You just said it!",
      "You landed the ending. It sounded like you meant every word!",
      "You finished strong, like you were sure of it!",
    ],
    later: (take: number) => `Your ending came down more than on Take ${take}.`,
  },
  /* started with energy */
  B08: {
    lines: [
      "The energy at the beginning was great. It was like the North Star of your presentation.",
      "What a start! That energy set the tone for what came after.",
      "You came in with energy from the very first word!",
      "Strong opening! That energy pulls people right in.",
      "You started with fire. Everyone would want to keep listening!",
    ],
    later: (take: number) => `You started with more energy than on Take ${take}.`,
  },
  /* the general line */
  B09: {
    lines: [
      "Wow, it was one of the most confident moments of your presentation",
      "This was one of your more confident moments. There's more in you!",
      "Good moment! You're heading the right way.",
      "This one sounded surer. Keep building on it!",
      "I can hear your confident voice starting to come through here!",
    ],
    /* The general line names no Take; it takes one only to match the rest. */
    later: (_take: number) => "This keeps getting surer. Keep going.",
  },
  /* drop the word in front */
  B10: {
    lines: [
      "Say what you mean. Don't dance around it, just say it straight.",
      "Skip the warm-up. Go straight to your point!",
      "Start with what matters. No run-up needed!",
      "Get right to it. Your point is strong enough on its own.",
      "Drop the extra words and say the thing. It hits harder!",
    ],
  },
  /* split in two */
  B11: {
    lines: [
      "Try saying it as two short sentences, with a small pause between.",
      "Two short sentences land better than one long one.",
      "Break it in two and pause in the middle.",
      "Two short sentences hit harder than one long one. Try it!",
      "Cut it in two and take a breath between. Let each part land!",
      "Say the first part, pause, then the second. Much clearer!",
      "Give each idea its own sentence. People can follow you easily!",
    ],
  },
  /* join into one */
  B12: {
    lines: [
      "Don't cut it into pieces. Say it as one whole thing, so it lands all together and makes an impact.",
      "Keep it in one go, so the idea hits all at once.",
      "One sentence, one breath. Let it land together!",
      "Don't break it up. Say it whole and it lands harder.",
      "Put the pieces together so your idea comes out as one strong thought!",
    ],
  },
  /* the opening line, above the new text */
  B13: {
    lines: [
      "Here is a slightly more polished option:",
      "Here's a clearer way to say it:",
      "Try it this way:",
      "Here's a way to say it even clearer:",
      "Try saying it like this:",
      "This version might land even better:",
      "Here's a stronger way to say it:",
    ],
  },
  /* the question, under the new text */
  B14: {
    lines: [
      "Do you accept and want to practise it?",
      "Want to take it and practise?",
      "Shall we practise this version?",
      "Do you want to try saying it this way?",
      "Shall we practise this one together?",
      "Ready to practise this version?",
      "Want to give this version a go?",
    ],
  },
} as const;
