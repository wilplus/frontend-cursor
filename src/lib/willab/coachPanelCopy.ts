/* -------------------------------------------------------------------------- */
/*  The coach panel, redrawn — every word it puts on screen (founder lock      */
/*  2026-10-06, FOUNDER-LOCK-coach-panel-redesign-2026-10-06; design locked    */
/*  2026-10-07, N57; build plan P0, D-CP-11).                                  */
/*                                                                            */
/*  ONLY SIGNED WORDS. A string here is one of four things, and nothing else:  */
/*    (a) a word the founder signed for this panel (the lock's "Words signed   */
/*        (CP2 A)" list), typed exactly as listed, parameterised for {p},     */
/*        {n}, {m}, {error} and {exercise};                                    */
/*    (b) a word the app already says, IMPORTED from its copy module, never   */
/*        retyped (the walk's words, the Ideal Text's, the corpus stage        */
/*        hints);                                                             */
/*    (c) the two pinned buttons the lock's flow names in step 1 (Speakers,   */
/*        Training corpus);                                                   */
/*    (d) a word the locked prototype shows that no list carries, signed with */
/*        its design (founder 2026-10-07, Q-B4 A: "Every word a locked        */
/*        prototype shows is signed with its design. Where a signed list      */
/*        differs, the list wins"): "Choose a file" is the list's, not the    */
/*        prototype's "Choose files".                                         */
/*  coachPanelCopy.test.ts holds both lists and fails on anything else.       */
/*                                                                            */
/*  Not here, on purpose: the blind lines' words (Do you hear it?, Pick the   */
/*  most confident moment, their answers) are the backend's own wording, as   */
/*  today's queue draws them; and the words the lock took off the screens     */
/*  ("Your diagnosis: {error}", "nothing in the library treats it yet", "You  */
/*  don't hear an error") are not reused.                                     */
/*                                                                            */
/*  No number about a speaker's quality: the only numbers are counts of       */
/*  moments, imports, Takes and lines, and a position (AC-9).                 */
/* -------------------------------------------------------------------------- */

import { CHUNK_SHEET_COPY, WALK_COPY } from "@/components/willab/idealEditCopy";
import { STAGE_COST } from "@/services/api/trainingCorpus";
import { COACH_WALK_COPY as WALK } from "./coachWalkCopy";

/** A count reads in the singular at one, as the prototype draws it. */
const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** (b) Words the app already says, imported. */
const REUSED = {
  /* the queue, the Lounge door */
  queueTitle: WALK.queueTitle,
  queueEmpty: WALK.queueEmpty,
  bubbleWaiting: WALK.bubbleWaiting,
  bubbleOpen: WALK.bubbleOpen,
  waitingForText: WALK.queueWaitingForText,
  /** The blind lines' count (6a, 8); their titles are the backend's own. */
  blindWaiting: WALK.queueBlindWaiting,
  /* Judge this moment, What happened */
  judgeTitle: WALK.judgeTitle,
  judgeQuestion: WALK.judgeQuestion,
  judgeFail: WALK.judgeFail,
  toastJudged: WALK.toastJudged,
  /** The five answers as words after the fact (Confident, In-between, …). */
  answer: WALK.answer,
  you: WALK.readYou,
  readFail: WALK.readFail,
  next: WALK.pillNext,
  done: WALK.pillDone,
  /* the cure */
  pillAnswer: WALK.pillAnswer,
  nothingToAdd: WALK.linkNothingToAdd,
  keepIt: WALK.prefKeep,
  swapIt: WALK.prefSwap,
  makeANewOne: WALK.prefNew,
  useThisOne: WALK.prefUseThisOne,
  /* the coach's words, by kind: Your instruction, Your praise, Your clearer
     version, Your note */
  wordsTitle: WALK.wordsTitle,
  /** The speaker's rewrite card, exactly as the Feedback walk draws it. */
  clearerOffer: WALK_COPY.clearerOffer,
  clearerAsk: WALK_COPY.clearerAsk,
  /* the video */
  videoTitle: WALK.videoTitle,
  record: WALK.pillRecord,
  keep: WALK.pillKeep,
  skipTheVideo: WALK.linkSkipVideo,
  recordAgain: WALK.linkRecordAgain,
  /* sharing */
  shareWith: WALK.pillShare,
  shareWithoutLibrary: WALK.linkShareOnly,
  toastShared: WALK.toastShared,
  toastSharedOnly: WALK.toastSharedOnly,
  answerFail: WALK.answerFail,
  /* a word for this Take */
  takeWordTitle: WALK.takeWordTitle,
  sendTo: WALK.pillSendWord,
  skip: WALK.linkSkipWord,
  toastWordSent: WALK.toastWordSent,
  /* the library */
  libraryTitle: WALK.libraryTitle,
  newPill: WALK.pillNew,
  save: WALK.pillSaveLibrary,
  toastLibraryOnly: WALK.toastLibraryOnly,
  transcribed: WALK.libraryTranscribed,
  transcribing: WALK.libraryTranscribing,
  retired: WALK.libraryRetired,
  /* the training corpus: what to run, the stage hints as the corpus page
     says them */
  runAnalyticsHint: STAGE_COST.analytics,
  runIdealTextHint: STAGE_COST.ideal_text,
  /** "Take N", the signed coach-card words (L6). */
  take: (takeIndex: number | null) =>
    takeIndex ? `${CHUNK_SHEET_COPY.historyTake} ${takeIndex}` : CHUNK_SHEET_COPY.historyTake,
} as const;

/** (a) Signed by the founder (CP2 A), exactly as listed. `{p}` is the
 *  speaker's pseudonym, `{error}` an error's name, `{exercise}` an
 *  exercise's title; a count of one reads in the singular. */
const SIGNED = {
  /* Queue · All speakers */
  yourSpeakers: "Your speakers",
  momentsWaiting: (n: number) => count(n, "moment waiting", "moments waiting"),
  /* A speaker */
  goal: (goal: string) => `Goal: ${goal}`,
  takeWaiting: (n: number, m: number) => `${n} of ${m} moments waiting`,
  allMomentsAnswered: "All moments answered",
  answered: "Answered",
  answeredMoments: (n: number) => `Answered · ${count(n, "moment", "moments")}`,
  /* What happened */
  whatHappened: "What happened",
  machineHeard: "The machine heard",
  /* the diagnosis */
  whatKindOfError: "What kind of error is it?",
  machineHeardThis: "The machine heard this",
  somethingElse: "Something else",
  nameANewError: "Name a new error",
  noError: "I don't hear an error",
  /* Name the error */
  nameTheError: "Name the error",
  nameTheErrorHint: "A few words, as you would say it to another coach",
  nameTheErrorPlaceholder: "e.g. trailing off",
  nameTheErrorNote: (p: string) =>
    `Your exercise goes to ${p} now. The library offers it to other speakers once the machine can hear this error; every coach who names it brings that closer.`,
  /* the cure */
  chooseExercise: "Choose exercise",
  whatWillYouDo: "What will you do?",
  served: (exercise: string) => `Served: ${exercise}`,
  moreInLibrary: (n: number, error: string) => `${n} more for ${error} in the library`,
  yourOwnWordsAndVideo: "Your own words and video",
  writeYourPraise: "Write your praise",
  writeAClearerVersion: "Write a clearer version",
  writeANote: "Write a note",
  /* Swap it */
  allTreat: (error: string) => `All treat ${error}`,
  shownInRandomOrder: "shown in random order",
  servedNow: "Served now",
  treats: (error: string) => `Treats: ${error}`,
  details: "Details",
  /* an exercise's details */
  backToTheList: "Back to the list",
  /* Your words */
  asWillSeeIt: (p: string) => `As ${p} will see it`,
  pencilEditsEveryWord: "the pencil edits every word",
  /* Your video */
  sayTheInstruction: "Say the instruction in your own words",
  underAMinute: "under a minute",
  optional: "Optional",
  /* the kind question */
  whatDidDoWell: (p: string) => `What did ${p} do well?`,
  whatKindOfFix: "What kind of fix is it?",
  /* Ready for {p} */
  readyFor: (p: string) => `Ready for ${p}`,
  withoutAVideo: (p: string) => `Without a video it goes to ${p} only, not to the library.`,
  inTheLibraryUnder: (error: string) => `In the library under “${error}”, waiting until the machine can hear it.`,
  /* Summary */
  yourAnswer: "Your answer",
  changeMyAnswer: "Change my answer",
  /* A word for this Take */
  opensFirstIn: (p: string) => `it opens first in ${p}’s feedback`,
  sendWithoutAVideo: "Send without a video",
  /* Training corpus */
  corpusCaption: "Import audio, label it, then judge its moments blind",
  imports: (n: number) => count(n, "import", "imports"),
  momentsToJudge: (n: number) => count(n, "moment to judge", "moments to judge"),
  momentsToJudgeOf: (n: number, m: number) => `${n} of ${m} moments to judge`,
  oneRecording: "One recording",
  cutIntoMoments: "it is cut into moments you judge blind",
  chooseAFile: "Choose a file",
  audioOrVideo: "Audio or video, up to 30 minutes",
  imported: "Imported",
  moments: (n: number) => count(n, "moment", "moments"),
  /* Training corpus set-up */
  finishTheSetUp: "Finish the set-up",
  beforeItsMomentsCanBeJudged: "Before its moments can be judged",
  setUpNotFinished: "Set-up not finished",
  finishItBeforeJudging: "finish it before judging",
  setUp: "Set up",
  /* Library (now in admin) */
  oneError: "One error",
  libraryOffersIt: "the library offers it when the machine hears it",
  asASpeakerWillSeeIt: "As a speaker will see it",
  anExerciseNeedsItsVideo: "An exercise needs its video",
  bringItBack: "Bring it back",
  retireIt: "Retire it",
  praiseLinesCaption: "Praise lines the library offers when the machine hears this",
  noneYet: "None yet.",
  exercisesThatTreatIt: "Exercises that treat it",
} as const;

/** (c) The pinned buttons, as the lock's flow names them. */
const NAMED = {
  speakers: "Speakers",
  trainingCorpus: "Training corpus",
} as const;

/** (d) Shown by the locked prototype and on no list: signed with its design
 *  (Q-B4 A). The training corpus set-up keeps the corpus page's own words. */
const PROTOTYPE = {
  /* the Lounge's ☰ menu and the library page's way back */
  library: "Library",
  lounge: "Lounge",
  /* an answered moment */
  summary: "Summary",
  /* What happened: an answer not given yet, and the machine heard nothing */
  noAnswer: "—",
  heardNothing: "nothing",
  /** The confident cues, as the kind question lists them ("What did {p} do
   *  well?"), by the backend's cue key (services/delivery_cues). */
  cue: {
    confident_read: "confident read",
    opened_strong: "opened strong",
    landed_ending: "landed the ending",
    kept_moving: "kept moving",
    settled_pitch: "settled pitch",
    no_hesitation: "no hesitation",
    full_volume: "full volume",
    wide_range: "wide range",
  } as Record<string, string>,
  /* all speakers */
  allAnsweredTakes: (n: number) => `All answered · ${count(n, "Take", "Takes")}`,
  /* the training corpus */
  importAudio: "Import audio",
  importPill: "Import",
  noSpeakerLabel: "No speaker label",
  allLabelled: (n: number) => `All ${n} labelled`,
  analysing: "Analysing on the server…",
  whatTheTalkIsAbout: "What the talk is about",
  topicPlaceholder: "The topic",
  whoseVoiceThisIs: "Whose voice this is",
  speakerPlaceholder: "Speaker name",
  speakerHint: "Optional, but it is the only way the corpus can tell whose voice a piece is. Worth filling in per batch.",
  whatLanguageItIsIn: "What language it is in",
  chooseLanguage: "Choose…",
  languageHint:
    "Required — auto-detect is a choice, not a default. Whisper is primed with an English prompt, so a talk left on auto-detect can come back translated into English rather than transcribed: the audio is right, the words are not, and nothing says so.",
  whereItCameFrom: "Where it came from",
  sourcePlaceholder: "2019 conference, YouTube",
  whatToRun: "What to run",
  runConfidence: "Confidence",
  runConfidenceHint: "Always on — this is what produces the pieces and the label queue, i.e. the corpus itself.",
  runAnalytics: "Analytics",
  runIdealText: "Ideal text",
  /* the video step */
  camera: "Camera",
  recording: "Recording",
  stop: "Stop",
  /* the library */
  newNav: "New",
  praiseLines: (n: number) => count(n, "praise line", "praise lines"),
  toastRetired: "Retired",
  toastBackInTheLibrary: "Back in the library",
  /* the pencil */
  edit: "Edit",
  doneEditing: "Done editing",
  yourWords: "Your words",
  /* Speaking errors */
  speakingErrors: "Speaking errors",
  errorsCaption: "The patterns coaches name in moments. A pattern routes exercises only once a detector can hear it.",
  groupDetected: "Detected in audio · routes exercises",
  groupBeingTested: "Being tested · routes nothing yet",
  groupNamedOnly: "Named only · waiting on a detector",
  stateDetected: "Detected",
  stateBeingTested: "Being tested silently",
  stateObserved: "Observed",
  coachesHeardIt: (n: number, m: number) => `Coaches heard it on ${n} of ${m} checked moments.`,
} as const;

export const COACH_PANEL_COPY = { ...REUSED, ...SIGNED, ...NAMED, ...PROTOTYPE } as const;

/** Which keys came from where, for the test. */
export const COACH_PANEL_COPY_SOURCES = {
  reused: Object.keys(REUSED),
  signed: Object.keys(SIGNED),
  named: Object.keys(NAMED),
  prototype: Object.keys(PROTOTYPE),
} as const;
