/* -------------------------------------------------------------------------- */
/*  The coach's walk — every word on screens 1 to 3 (founder 2026-09-30,        */
/*  A1 to A8, from the "Unified Coach Walk" design accepted that day).          */
/*                                                                            */
/*  Coach-facing copy, held for founder sign-off like every other string       */
/*  (LIVE LOOP). One place, so a wording change is one edit and one review.    */
/*  Nothing here is a number about a speaker: the state of a moment is a word, */
/*  the kind is a word, what fired is its library name (AC-9).                 */
/* -------------------------------------------------------------------------- */

export const COACH_WALK_COPY = {
  /* screen 1 · the queue */
  queueTitle: "Your queue",
  queueEmpty: "Nobody is waiting for you.",
  queueTake: (takeIndex: number | null, moments: number) =>
    `${takeIndex ? `Take ${takeIndex}` : "Take"} · ${moments} ${moments === 1 ? "moment" : "moments"}`,
  queueMoment: (index: number) => `Moment ${index}`,
  queueNextSpeaker: "Next speaker",
  /* a Take whose bookmarks are not frozen yet (founder 2026-10-01, A1) */
  queueWaitingForText: "Waiting for the text",
  queueNameError: "Name a speaking error",
  /* the one bubble in the Lounge, and the button under the thread */
  bubbleWaiting: (n: number) =>
    n === 0 ? "Nobody waiting" : `${n} ${n === 1 ? "speaker" : "speakers"} waiting`,
  bubbleOpen: "Open your queue",
  buttonQueue: "Your queue",

  /* Students (founder 2026-10-01, Phase 0b) · proposed, held for sign-off */
  buttonStudents: "Students",
  studentsTitle: "Your students",
  studentsEmpty: "No students yet.",
  studentsNotACoach: "This account isn’t set up as a coach yet.",
  studentsProfileFail: "Couldn’t load this student just now.",
  studentsGoal: "Goal",
  studentsTakes: "Takes",
  studentsTake: (takeIndex: number | null) => (takeIndex ? `Take ${takeIndex}` : "Take"),
  studentsNoTakes: "No Takes yet.",
  studentsOpenWalk: "Open the walk",
  studentsOpening: "Opening…",
  studentsOpenFail: "Couldn’t open this Take just now.",

  /* the state words (P2-6): where the coach is with a moment */
  state: {
    judge_it: "Judge it",
    answer_it: "Answer it",
    answered: "Answered",
    nothing_to_add: "Nothing to add",
    judged: "Judged",
  } as const,

  /* the kind words (the follow-up matrix) */
  kind: {
    error: "Error",
    praise: "Praise",
    rewrite: "Rewrite",
    ambiguity: "Ambiguity",
  } as const,

  /* the five answers, as words after the fact */
  answer: {
    yes: "Confident",
    in_between: "In-between",
    no: "Not confident",
    not_sure: "Not sure",
    audio_unclear: "Audio unclear",
  } as const,

  /* screen 2 · judge */
  judgeTitle: "Judge this moment",
  judgeQuestion: "Does the speaker sound confident here?",
  judgeEyebrow: "Private · training · saved on tap",
  judgeFail: "Couldn’t save your answer.",

  /* screen 3 · read */
  readTitle: "What you judged",
  readYou: "You",
  readHeard: "The machine heard",
  readHeardNothing: "Nothing fired.",
  readLibrary: "In the library",
  readLibraryNothing: "Nothing treats this yet.",
  readLibraryHas: "The library has something for this.",
  readLibraryOffered: "The library matched it since; the speaker has that exercise.",
  readLibraryAnswered: "You answered this moment.",
  readLibraryAnsweredShared: "You answered this moment and shared it.",
  readLibraryNothingToAdd: "You had nothing to add.",
  readGoal: (pseudonym: string) => `${pseudonym}’s goal`,
  /** Q6 (founder 2026-10-05, words signed the same day): the speaker's chosen practice recording. */
  readPractice: (pseudonym: string) => `${pseudonym}’s practice`,
  readNoRequest: "Nothing reached you from this moment.",
  readLoading: "Reading the moment…",
  readFail: "Couldn’t read the moment.",
  pillAnswer: "Answer",
  pillNext: "Next",
  pillDone: "Done",
  linkNothingToAdd: "Nothing to add",
  toastNothingToAdd: "Saved · nothing to add",
  toastJudged: "Answer saved",

  /* screens 4 to 6 · the one answer, by kind (A3 to A6) */
  wordsTitle: {
    error: "Your instruction",
    praise: "Your praise",
    rewrite: "Your clearer version",
    ambiguity: "Your note",
  } as const,
  wordsEyebrowDrafted: "Drafted from this moment · edit every word",
  wordsEyebrowBlank: "In your own words",
  wordsEyebrowDrafting: "Drafting from this moment…",
  wordsPassage: (pseudonym: string) => `The passage ${pseudonym} will say`,
  wordsDraftUnavailable: "No draft this time; write it in your own words.",
  wordsPlaceholder: "Write it here.",
  linkStartBlank: "Start from blank",
  linkUseDraft: "Use the draft",

  videoTitle: "Your video",
  videoEyebrowError: "A video is the default for an error · under a minute",
  videoEyebrowOptional: "Optional · under a minute",
  videoHint: "Say the instruction in your own words. It is transcribed when you stop.",
  videoTranscript: "Transcript · just now",
  videoUnsupported: "This browser cannot record; upload a clip filmed elsewhere.",
  pillRecord: "Record",
  pillKeep: "Keep",
  pillNextNoVideo: "Next",
  linkSkipVideo: "Skip the video",
  linkAddVideo: "Add a video",
  linkRecordAgain: "Record again",
  linkUploadInstead: "Upload instead",
  videoUploading: "Uploading…",

  homeTitle: "Where it lives",
  homeEyebrowShare: (pseudonym: string) =>
    `It answers ${pseudonym} and joins the library for the next speaker`,
  homeEyebrowLibrary: "It joins the library for the next speaker",
  homeName: "Name",
  homeNamePlaceholder: "Land the last word",
  homeMainTarget: "Main target · one",
  homeAlsoTreats: "Also treats",
  homePattern: "Pattern",
  homePatternPraise: "A read or a cue",
  homePatternRewrite: "The move",
  homeConfidentRead: "confident read",
  homeMoves: {
    drop_the_filler: "drop the filler",
    split_the_clause: "split the clause",
    repair_the_structure: "repair the structure",
  } as const,
  homeKeepToSpeaker: "Keep it to this speaker",
  homeNeedsName: "Give it a name.",
  homeNeedsTarget: "Name the one pattern this exercise is written for.",
  homeNeedsVideo: "An exercise needs its video. Go back and record one, or skip the library.",
  pillShare: (pseudonym: string) => `Share with ${pseudonym}`,
  pillSaveLibrary: "Save",
  linkLibraryOnly: "Save to the library only",
  linkShareOnly: "Share without the library",
  toastShared: (pseudonym: string) => `Shared with ${pseudonym} · in the library`,
  toastSharedOnly: (pseudonym: string) => `Shared with ${pseudonym}`,
  toastLibraryOnly: "Saved · in the library",
  answerFail: "Couldn’t save your answer.",

  /* screen 7 · a word for this Take */
  takeWordTitle: "A word for this Take",
  takeWordEyebrow: (pseudonym: string, takeIndex: number | null) =>
    `${pseudonym}${takeIndex ? ` · Take ${takeIndex}` : ""} · optional`,
  takeWordHint: "One message for the whole Take. It opens as “Your coach” before the moments.",
  takeWordPlaceholder: "Write it here.",
  takeWordVideo: "Add a video",
  pillSendWord: (pseudonym: string) => `Send to ${pseudonym}`,
  linkSkipWord: "Skip",
  toastWordSent: (pseudonym: string) => `Sent to ${pseudonym}`,

  /* the library (L1 to L5) */
  libraryTitle: "Your library",
  libraryEyebrowVideos: "Exercises · by main target",
  libraryEyebrowLines: "Praise lines · rewrite moves",
  libraryEmpty: "Nothing in the library yet.",
  libraryTranscribed: "transcribed",
  libraryTranscribing: "transcribing…",
  libraryRetired: "retired",
  libraryLine: (n: number) => `${n} ${n === 1 ? "line" : "lines"}`,
  libraryMove: (n: number) => `${n} ${n === 1 ? "move" : "moves"}`,
  pillNew: "New",
  patternTitle: "What is it for",
  patternEyebrow: "One pattern · detected ones only can route",
  patternErrors: "Errors · detected",
  patternPraise: "Praise · a read or a cue",
  patternRewrite: "Rewrite · a move",
  patternNamedOnly: "Named only · cannot route yet",
  patternNeeded: "Pick one pattern.",
  lanePassage: "From the library’s own exercises for this pattern",
  laneEyebrowDrafted: "Drafted from the library · edit every word",

  /* Phase 1b · the coach's exercise preference (founder 2026-10-01, B1 approved exactly) */
  prefServed: "Served to the speaker",
  prefTreats: (treats: string[]) => `Treats: ${treats.join(", ")}`,
  prefKeep: "Keep it",
  prefSwap: "Swap it",
  prefNew: "Make a new one",
  prefSwapHint: "Swap it · these all fit this moment · shown in random order",
  prefChoose: "Choose",
  prefChosen: "Chosen",
  prefServedTag: "served",
  prefUseThisOne: "Use this one",
  prefNotHere: "Not here? Make a new one from the library.",

  /* The blind lines in the queue (6a, 8): the titles and "Also waiting · blind"
     come from the backend's wording; this count is PROPOSED, for sign-off. */
  queueBlindWaiting: (n: number) => `${n} waiting`,

  /* Phase 0c · a student's new Take as a bubble (A2). PROPOSED, for sign-off. */
  bubbleTake: (who: string, takeIndex: number | null) =>
    takeIndex ? `${who} · Take ${takeIndex}` : who,
  bubbleTakeOpen: "Open the walk",
  bubbleTakeWaiting: "Waiting for the text",
} as const;
