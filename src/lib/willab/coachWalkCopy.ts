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
  queueNameError: "Name a speaking error",
  /* the one bubble in the Lounge, and the button under the thread */
  bubbleWaiting: (n: number) =>
    n === 0 ? "Nobody waiting" : `${n} ${n === 1 ? "speaker" : "speakers"} waiting`,
  bubbleOpen: "Open your queue",
  buttonQueue: "Your queue",

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
  readNoRequest: "Nothing reached you from this moment.",
  readLoading: "Reading the moment…",
  readFail: "Couldn’t read the moment.",
  pillAnswer: "Answer",
  pillNext: "Next",
  pillDone: "Done",
  linkNothingToAdd: "Nothing to add",
  toastNothingToAdd: "Saved · nothing to add",
  toastJudged: "Answer saved",
} as const;
