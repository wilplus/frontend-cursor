/* -------------------------------------------------------------------------- */
/*  life/copy — EVERY user-visible string on the Life Panel, in one file       */
/*                                                                            */
/*  ⚠ FOUNDER SIGN-OFF REQUIRED BEFORE SHIP (LIVE LOOP fence, R13).            */
/*  User-facing copy on a live surface needs sign-off, and "small" is not an   */
/*  exemption. It lives here rather than inline in twelve components so the    */
/*  review is one file, not a diff hunt. Components import from here; a string */
/*  literal in a panel component is a review failure.                          */
/*                                                                            */
/*  The five items the FE prompt names explicitly are marked SIGN-OFF below:   */
/*  the guide page, the consent screen (including retention), the             */
/*  #-before-setup redirect line, the delete confirmation, and the empty       */
/*  states on all eight views.                                                */
/*                                                                            */
/*  House rules applied throughout:                                           */
/*    · No em-dashes (founder rule). Commas or periods.                        */
/*    · No number that reads as a verdict: no percentage, no streak, no        */
/*      completion ring, no "consistency" (N4 / AC-9).                         */
/*    · No nudge language: nothing says you missed a day, fell behind, or      */
/*      should come back. Not typing means living, not failing (N3 / L-4).     */
/* -------------------------------------------------------------------------- */

/** SIGN-OFF — page 1 of first run. One page of text. No feature list, no
 *  signup pressure, no call to action beyond continuing. */
export const GUIDE = {
  title: "Principles",
  paragraphs: [
    "A principle is a short rule you write for yourself after something goes wrong, so the same thing costs you less next time. You write it once, in your own words, and it stays.",
    "The way in is the chat you already use. Start a message with a hashtag and it goes here instead of to Will. Type #mistake and paste what happened, along with what you make of it, and it becomes a case: the situation, what kind of error it was, which of your existing principles bore on it, your own reflection, and the one line you take away.",
    "Other tags do other jobs. #observation checks something you noticed against the strategy you wrote. #win keeps a win. #add puts a line on your phrase wall, so your own words can come back to you later, at the moment they apply.",
    "The point is not to log your days. It is to catch the ideas, concerns and conclusions you pick up in meetings and from watching other people, and to build wisdom in how you communicate and in general.",
    "Nothing here pings you. There is no streak, no score, and nothing that counts the days you did not write. When you open it, it is waiting.",
  ],
  continueLabel: "Continue",
} as const;

/** SIGN-OFF — page 2 of first run. Cannot be skipped, cannot be pre-accepted.
 *  States plainly what is stored, where, for how long, and the two exits. */
export const CONSENT = {
  title: "Before you write anything",
  intro:
    "This is the part worth reading, because what you put in here is more personal than the rest of the product.",
  points: [
    {
      heading: "What is stored",
      body: "The notes you send with a hashtag, the cases and principles they produce, your wins, your phrases, the goals and strategy you write in setup, and your daily cards. Whatever you type is kept as you typed it.",
    },
    {
      heading: "Where it is stored",
      body: "In WillpowerLab's database, on rows that belong to your account and are readable only by it. It is never mixed into anyone else's data, never used to answer another user's question, and never shown to a coach.",
    },
    {
      heading: "How it is used",
      body: "To answer your own hashtag notes, and to make your untagged chat better informed about what you have written. Relevant pieces are sent to the language model that composes the reply. The full set is never sent, and the model provider does not train on it.",
    },
    {
      heading: "How long it is kept",
      body: "Until you delete it. There is no expiry and no archive we keep after you erase it.",
    },
    {
      heading: "Getting it out, and getting rid of it",
      body: "You can download everything you have written at any time, and you can erase all of it at any time. Both live in the panel, two clicks away, not buried in settings.",
    },
    {
      heading: "One thing this is not",
      body: "It is not a place to publish. There is no sharing, no export to a community, no way for anyone else to read what is here. If you name other people in a note, that note stays yours alone.",
    },
  ],
  checkboxLabel: "I have read this and I want to use the principles engine.",
  acceptLabel: "Agree and continue",
  declineLabel: "Not now",
} as const;

/* SETUP_GATE_REDIRECT is deliberately gone (BE, 2026-07-26, superseding §6.2).
 *
 * A `#` typed before onboarding is finished now falls through EXACTLY like an
 * ordinary chat turn: no life row, no redirect line, no card. So there is no
 * copy for this state, and adding some back would be a bug.
 *
 * §6.2's original rule was the opposite: keep the note and replay it, so the
 * tag never teaches the user that reaching for it costs something. The backend
 * is right that a half-working tag teaches that LOUDER, not more quietly. It
 * answers, looks like it understood, and produces nothing. A user who never
 * onboards now leaves no life rows at all, which is also the better privacy
 * answer for a public feature.
 *
 * It was also, on this side, never rendered: the string existed and no
 * component read it. `copy.test.ts` now asserts every export here is actually
 * imported somewhere, so the next one cannot sit around unnoticed. */

/** SIGN-OFF — the delete confirmation. Says plainly what goes and that it
 *  cannot be undone. Typed confirmation, no one-click destroy. */
export const DELETE = {
  title: "Erase everything in the panel",
  body: "This removes every note, case, principle, win, phrase, goal, daily card and strategy document you have written here. It cannot be undone, and we have no copy to restore it from. Your WillpowerLab account and your speaking work are not touched.",
  hint: "Download your data first if you might want it.",
  confirmWord: "ERASE",
  confirmLabel: "Type ERASE to confirm",
  buttonLabel: "Erase everything",
  workingLabel: "Erasing",
} as const;

export const EXPORT = {
  title: "Download your data",
  body: "Everything you have written here, as one file. Yours to keep.",
  buttonLabel: "Download",
  workingLabel: "Preparing",
} as const;

/** SIGN-OFF — the empty state on every view. None of these says you are behind,
 *  none counts what is missing, and none asks you to come back (N3). */
export const EMPTY = {
  principles: "No principles yet. The first one arrives when you send a case with #mistake.",
  wins: "No wins kept yet. #win in the chat puts one here.",
  phrases: "The wall is empty. #add followed by a line puts it here, and it can come back to you later.",
  today: "No card for today yet. It is written at five in the morning and waits here.",
  week: "No review for this week yet.",
  untagged: "Nothing untagged this week.",
  goals: "No goals yet. They come from setup, and you can change them there whenever you want.",
  timeline: "Nothing dated yet. Goals with a date and events show up here once they exist.",
  distractions: "Nothing here yet. A distraction is only worth writing down next to the change that answers it.",
  strategy: "No strategy document yet. It is written from your setup answers.",
  proposals: "Nothing waiting for you.",
  applications: "Not cited anywhere yet.",
} as const;

/** View chrome. Short, factual, no exhortation. */
export const VIEWS = {
  principles: {
    title: "Principles",
    lede: "What you took away, in your own words.",
  },
  wins: { title: "Wins", lede: "Kept, so they are there when you need them." },
  phrases: {
    title: "Phrases",
    lede: "Your own lines, ready to come back at the right moment.",
  },
  today: { title: "Today", lede: "" },
  week: { title: "Week", lede: "Sunday. What held, what did not, and one change." },
  goals: {
    title: "Goals",
    lede: "Three bets, in order. The order is the point.",
  },
  timeline: { title: "Timeline", lede: "" },
  distractions: {
    title: "Distractions",
    lede: "Each one next to the change that answers it.",
  },
  strategy: { title: "Strategy", lede: "" },
  data: { title: "Your data", lede: "" },
  setup: {
    title: "Setup",
    lede: "Eight horizons. You can stop anywhere and pick it up later.",
  },
} as const;

/** Card copy for the three proposal types (N5). "Proposed" is never softened
 *  into something that reads as already done. */
export const CARDS = {
  proposedBadge: "Proposed",
  yoursBadge: "Yours",
  warrantLabel: "Because of your own principle",
  contradictsLabel: "This is what it contradicts",
  approve: "Approve",
  dismiss: "Dismiss",
  dismissed: "Dismissed. It will not be proposed again.",
  reportOnly:
    "This touches a part of the document you edit by hand. It is reported, not proposed.",
  conflictTitle: "These two pull against each other",
  conflictHelp: "Both are yours. Weigh them yourself, this does not pick.",
  retireQuestion: "Does this retire it?",
  retireYes: "Yes, retire it",
  retireNo: "No, keep both",
  retireKept: "Both stay active.",
  expiresPrefix: "Expires",
} as const;

/** Day card chrome. The frame is fixed, the content is editable.
 *
 *  The day is two cards: the plan, written at five, and the summary, written at
 *  eleven. Neither is announced. Both simply wait. */
export const DAY = {
  oneThingLabel: "Today's one thing",
  focusLabel: "Focus blocks",
  distractionLabel: "Before you start",
  morningLabel: "Morning",
  habitsLabel: "Daily habits",
  eveningLabel: "Evening",
  betsLabel: "The three bets",
  editHint: "Change it with #edit in the chat, and say why.",
  frameNote: "There is always one thing. What it is, is yours to change.",

  planTitle: "The plan",
  planPending: "Today's card is written at five in the morning.",

  summaryTitle: "The evening summary",
  /** Shown before the 23:00 pass has run. Factual, not a prompt to do
   *  something: it says when the summary arrives and nothing else (N3). */
  summaryPending: "Written at eleven, and waiting here when you open it.",
  summaryLabel: "What the day held",
  reviewLabel: "Your review",
  habitsRanLabel: "Habits ran",
  oneThingDoneLabel: "The one thing got done",
  eveningDistractionLabel: "What pulled at you",
  /** The fallback when the payload carries no question of its own. */
  questionFallback: "Am I becoming the man I described?",
  answerLabel: "Your answer",
} as const;

/** The Sunday review. Reads what happened; it does not grade it. */
export const WEEK = {
  habitsLabel: "Habits that did not run, and why",
  goalsLabel: "Goals that moved, and what is next",
  distractionLabel: "The main distraction",
  changeLabel: "One change to how things are set up",
  changeHint:
    "One a week. Answer the distraction with a change to the room, the phone or the calendar, not with resolve.",
  becomingLabel: "The becoming sentence",
  batchLabel: "The three from this week",
  batchHint:
    "What did not fit the one a day. Three of them, in order. The rest expire rather than pile up.",
  untaggedLabel: "Notes you left untagged",
  untaggedHint: "Captured, and nothing was done with them. That was the point.",
  whyPlaceholderNote: "",
} as const;

export const SETUP = {
  savedNote: "Saved. You can close this and come back to it.",
  resumeNote: "Picking up where you stopped.",
  completeLabel: "Finish setup",
  workingLabel: "Writing your documents",
  nextLabel: "Next",
  backLabel: "Back",
  doneTitle: "Setup is done",
  doneLabel: "Open the panel",
} as const;

export const STRATEGY = {
  downloadLabel: "Download",
  uploadLabel: "Upload a revised copy",
  uploadNote:
    "An upload never overwrites silently. You get a diff to approve first.",
  blockedNote:
    "These sections are edited by hand only, so changes to them were left out:",
  applyLabel: "Apply the approved changes",
  cancelLabel: "Cancel",
} as const;

/** Generic states. Nothing here reads as an accusation. */
export const STATUS = {
  loading: "Loading",
  error: "That did not load. Try again in a moment.",
  retry: "Try again",
  saving: "Saving",
  saved: "Saved",
} as const;
