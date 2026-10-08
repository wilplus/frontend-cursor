/* -------------------------------------------------------------------------- */
/*  THE WORDS A LOCKED CONSENT OR SETTINGS SCREEN MAY SHOW (build plan         */
/*  D-CS-9; consent lock 2026-10-07 "The rules": "add no element or string    */
/*  the prototype doesn't show"; the policy text always comes from the        */
/*  policy).                                                                  */
/*                                                                            */
/*  Three sources, each kept apart so a word can be traced to its signature:  */
/*                                                                            */
/*    CONSENT_PROTOTYPE_WORDS   every string the consent screens prototype    */
/*                              draws (backend docs/design/consent-screens-   */
/*                              2026-10-07.html, locked N60, version 2);      */
/*    SETTINGS_PROTOTYPE_WORDS  every string the settings page prototype      */
/*                              draws (docs/design/settings-page-2026-10-07   */
/*                              .html, ST1 A; "Support" and the address       */
/*                              signed by Q-B14 A (5));                       */
/*    SIGNED_STATE_LINES        the state lines of the live screens that no   */
/*                              prototype draws but the founder signed:       */
/*                              each entry names its decision.                */
/*                                                                            */
/*  The policy's own text (its documents, its agreement sentence, the         */
/*  countries it allows) is never listed here: the probe takes it from the    */
/*  policy fixture it renders with. lockProbe.test.tsx is the probe.          */
/* -------------------------------------------------------------------------- */

/** docs/design/consent-screens-2026-10-07.html: the welcome, the notice and
 *  its documents, the country and confirm steps, "Nothing was recorded", the
 *  learning question and the Data & consent page it carries. */
export const CONSENT_PROTOTYPE_WORDS: readonly string[] = [
  // the welcome
  "WillpowerLab",
  "Public speaking excellence tool.",
  "Enter the lab",
  // the notice (the agreement sentence itself is the policy's)
  "Terms of Service",
  "Privacy Policy",
  "How AI is used here",
  "read ✓",
  "Continue",
  // a document (its title, version and copy are the policy's)
  "Done reading",
  "Back",
  // the country step (the countries are the policy's)
  "Where do you live?",
  "This decides which law applies to your recording, so it has to be your real country of residence.",
  // "Three things to confirm" (the minimum age is the policy's)
  "Three things to confirm",
  "I am 18 or older.",
  "I agree that a recording of me speaking may reveal sensitive information about me, and I consent to WillpowerLab processing my recordings where it does. I can withdraw this at any time, which ends my use of recording.",
  "Optional",
  "Personalised practice. Use my recordings to choose short exercises that fit them, to keep the fragments I re-record, and to remember what I am working on so the exercises get more personal. I can turn this off at any time and keep using everything else.",
  "Saving…",
  "Agree and continue",
  "Do not agree",
  // "Nothing was recorded"
  "Nothing was recorded",
  "You can read the documents again, and you can come back and agree at any time. Until then recording stays closed.",
  "Go back",
  "Read the documents again",
  // "Turn on the learning?" before a Take (the switch's sentence is the backend's)
  "Turn on the learning?",
  "Yes",
  "Skip",
  // the Data & consent page, as the consent prototype carries it
  "Data & consent",
  "Your recordings are used to run your own coaching. They are used to train models only if you turn on Help improve WillpowerLab.",
  "Personalised practice",
  "Use my recordings to choose short exercises that fit them, to keep the fragments I re-record, and to remember what I am working on so the exercises get more personal.",
  "Turn off",
  "Turn on",
  "Turn off personalised practice? You keep using everything else. Your practice recordings will be deleted.",
  "Personalised practice is off.",
  "Personalised practice is on.",
  "Sensitive information in recordings",
  "You agreed that a recording of you speaking may reveal sensitive information about you. Withdrawing this ends your use of recording. Everything you already made stays readable.",
  "Withdraw",
  "Withdraw and stop recording?",
  "Cancel",
  "Recording is off.",
  "Agree again",
  "Help improve WillpowerLab",
  "Turn off training?",
  "Your training copies will be deleted. Anything already used to train stays in that training, but it won’t be used again.",
  "Text only. Never your voice.",
  "Off unless you turn it on. Saying no costs you nothing.",
  "OpenAI trains the models for us, in the United States, under the European Commission’s standard contractual clauses.",
  "Turning it off deletes your training copies and keeps you out of any new training. A model already trained stays.",
  "Recording is off because you withdrew your consent. You can turn it back on in Data & consent.",
  "Delete my account",
  "This permanently deletes your recordings, your texts and your feedback. Records of what you bought are kept for 5 years, as the law requires.",
  "Delete your account?",
  "Everything you recorded and wrote here will be permanently deleted after 7 days. Until then you can cancel. From now on nothing new is processed.",
  "A model already trained stays.",
  "Cancel deletion",
  "Your account will not be deleted.",
  "Your projects",
  "Archived",
  "Unarchive",
];

/** docs/design/settings-page-2026-10-07.html: the ☰ menu, the Data & consent
 *  page with its Support card, and "Back" on a document opened from it. */
export const SETTINGS_PROTOTYPE_WORDS: readonly string[] = [
  // the ☰ menu (the email and the balance are the person's own)
  "Lab",
  "Data & consent",
  "Tokens",
  "Log out",
  "Logging out…",
  "Open menu",
  "Close menu",
  // the page
  "Privacy Policy",
  "Terms of Service",
  "Back",
  // the Support card (Q-B14 A (5)); "Copy" is the copy button's spoken name
  "Support",
  "contact@willpowerlab.com",
  "Copy",
  // the delete dialog
  "Cancel",
  "Delete my account",
  "Delete your account?",
];

/** State lines the live screens show that no prototype draws, each signed
 *  on its own. Kept per Q-B15 A (9): "'What's changed since you agreed'
 *  stays as signed". */
export const SIGNED_STATE_LINES: readonly { text: string; signed: string }[] = [
  // PolicyUpdateCard (founder 2026-09-28, decision 21; kept, Q-B15 A (9))
  { text: "What’s changed since you agreed", signed: "founder 2026-09-28, decision 21; Q-B15 A (9)" },
  { text: "Accept the update", signed: "founder 2026-09-28, decision 21; Q-B15 A (9)" },
  // Data & consent's own state lines (founder 2026-09-25, "all seven")
  { text: "Couldn’t save that. Try again.", signed: "founder 2026-09-25 (dataConsentCopy.ts)" },
  { text: "Couldn’t load your choices. Try again.", signed: "founder 2026-09-25 (dataConsentCopy.ts)" },
  { text: "Your practice recordings are still being deleted.", signed: "founder 2026-09-25 (dataConsentCopy.ts)" },
  { text: "Your recordings are used to run your own coaching. They are not used to train models.", signed: "founder 2026-09-25 (dataConsentCopy.ts, intro before the training switch is offered)" },
  // The training lines v2 (founder 2026-10-08, "with its eight lines"); lines 2
  // and 8 are v1's, already drawn by the consent prototype above.
  { text: "Text and numbers only. No recording of your voice, and no clip of one, is ever copied or sent for training.", signed: "founder 2026-10-08, training switch wording v2 \"with its eight lines\" (backend 23-…-v2, SIGN-3.5-2026-10-08.md)" },
  { text: "Your coach's words include their line on a moment and their word for a take.", signed: "founder 2026-10-08, training switch wording v2 \"with its eight lines\" (backend 23-…-v2, SIGN-3.5-2026-10-08.md)" },
  { text: "The numbers are measurements such as your pace and pauses, and whether an exercise helped you. They stay with us.", signed: "founder 2026-10-08, training switch wording v2 \"with its eight lines\" (backend 23-…-v2, SIGN-3.5-2026-10-08.md)" },
  { text: "A coach may hear a moment of yours, without your name, to answer a question that teaches our software.", signed: "founder 2026-10-08, training switch wording v2 \"with its eight lines\" (backend 23-…-v2, SIGN-3.5-2026-10-08.md)" },
  { text: "The trained models write feedback for every speaker. We test that they do not repeat your text.", signed: "founder 2026-10-08, training switch wording v2 \"with its eight lines\" (backend 23-…-v2, SIGN-3.5-2026-10-08.md)" },
  { text: "OpenAI trains the text models for us, in the United States, under the European Commission's standard contractual clauses.", signed: "founder 2026-10-08, training switch wording v2 \"with its eight lines\" (backend 23-…-v2, SIGN-3.5-2026-10-08.md)" },
  { text: "Your recordings are used to run your own coaching. Their words, and numbers measured from them, train models only if you turn on Help improve WillpowerLab.", signed: "founder 2026-10-08, training switch wording v2 \"with its eight lines\" (backend 23-…-v2, SIGN-3.5-2026-10-08.md)" },
  // The account deletion (founder 2026-10-05, Q3a "yes", N45; W1-W5 A, N50)
  { text: "Your account is being deleted. We'll finish within one month.", signed: "founder 2026-10-05 (deleteAccountCopy.ts)" },
  { text: "Everything you recorded and wrote here will be permanently deleted. This can't be undone. We'll finish within one month, and from now on nothing new is processed.", signed: "founder 2026-10-05 (deleteAccountCopy.ts)" },
  { text: "Couldn't cancel. Try again.", signed: "founder 2026-10-05, W2 A (leavingCopy.ts)" },
  { text: "It can no longer be cancelled.", signed: "founder 2026-10-05, W2 A (leavingCopy.ts)" },
  // Your projects (founder 2026-09-26, N14; N8; Q-B15 A (10))
  { text: "No projects yet.", signed: "founder 2026-10-07, Q-B15 A (10), N62/N63" },
  { text: "Couldn't load your projects.", signed: "founder 2026-09-26, N14 (ProjectsCard)" },
  { text: "Try again", signed: "founder 2026-09-26, N14 (ProjectsCard)" },
  { text: "Deletion pending", signed: "founder 2026-09-25, N8 (projectDeletionCopy.ts)" },
  // The ☰ menu's signed-out row and the coach's row
  { text: "Log in", signed: "AppMenu, FE-3 (the way in, signed out)" },
  { text: "Training corpus", signed: "coach only, N4; CP3 A (N56.3)" },
];
