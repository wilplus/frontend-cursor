/* -------------------------------------------------------------------------- */
/*  Every word on the Data & consent page, in one place.                      */
/*                                                                            */
/*  All signed off by the founder 2026-09-25: the first set with the locked   */
/*  choices E2 = C, E3 = A, E5 = A ("Wording: approved as shown on the        */
/*  page"), the last seven ("You got yes on all of them. All seven.") the     */
/*  same day. A new sentence goes to the founder before it ships.             */
/* -------------------------------------------------------------------------- */

export const DATA_CONSENT_COPY = {
  title: "Data & consent",
  intro:
    "Your recordings are used to run your own coaching. They are not used to train models.",
  // Approved by the founder 2026-09-28 (decision 21): the card shown only
  // when a newer policy replaced the one this person accepted.
  updateTitle: "What’s changed since you agreed",
  updateAccept: "Accept the update",
  practiceTitle: "Personalised practice",
  // The acceptance tick's own sentence, without its last clause.
  practiceDescription:
    "Use my recordings to choose short exercises that fit them, to keep the fragments I re-record, and to remember what I am working on so the exercises get more personal.",
  turnOff: "Turn off",
  turnOn: "Turn on",
  turnOffConfirm:
    "Turn off personalised practice? You keep using everything else. Your practice recordings will be deleted.",
  practiceOff: "Personalised practice is off.",
  practiceOn: "Personalised practice is on.",
  failed: "Couldn’t save that. Try again.",
  sensitiveTitle: "Sensitive information in recordings",
  sensitiveText:
    "You agreed that a recording of you speaking may reveal sensitive information about you. Withdrawing this ends your use of recording. Everything you already made stays readable.",
  withdraw: "Withdraw",
  withdrawConfirm: "Withdraw and stop recording?",
  coachSpeakerOff: "This speaker has turned off personalised practice.",
  cancel: "Cancel",
  loadFailed: "Couldn’t load your choices. Try again.",
  recordingOff: "Recording is off.",
  agreeAgain: "Agree again",
  erasureFinishing: "Your practice recordings are still being deleted.",
  recordScreenOff:
    "Recording is off because you withdrew your consent. You can turn it back on in Data & consent.",
  privacyUnavailable:
    "The privacy policy couldn’t be loaded. Refresh the page to try again.",
  // Approved by the founder 2026-09-25 ("yes"), decision 2.
  termsUnavailable:
    "The terms of service couldn’t be loaded. Refresh the page to try again.",
  // Signed by the founder 2026-09-26 (backend SPEC-DECISIONS-LOG N10). The
  // switch's own sentence is not here: the backend serves it, exactly as the
  // database holds and fingerprints it.
  trainingTitle: "Help improve WillpowerLab",
  trainingOffTitle: "Turn off training?",
  trainingOffBody:
    "Your training copies will be deleted. Anything already used to train stays in that training, but it won’t be used again.",
  // Signed by the founder 2026-10-08, "with its eight lines" (training switch
  // wording v2, backend legal/phase1-2026.1/23-training-consent-wording-v2-*.md
  // and SIGN-3.5-2026-10-08.md; supersedes v1's four lines of 2026-10-01).
  // The eight lines above the switch, shown before it can be turned on; the
  // switch's own sentence still comes from the backend, fingerprinted.
  trainingBeforeLines: [
    "Text and numbers only. No recording of your voice, and no clip of one, is ever copied or sent for training.",
    "Off unless you turn it on. Saying no costs you nothing.",
    "Your coach's words include their line on a moment and their word for a take.",
    "The numbers are measurements such as your pace and pauses, and whether an exercise helped you. They stay with us.",
    "A coach may hear a moment of yours, without your name, to answer a question that teaches our software.",
    "The trained models write feedback for every speaker. We test that they do not repeat your text.",
    "OpenAI trains the text models for us, in the United States, under the European Commission's standard contractual clauses.",
    "Turning it off deletes your training copies and keeps you out of any new training. A model already trained stays.",
  ],
  // Approved by the founder 2026-09-26 (backend N12, answer 3); wording v2
  // signed 2026-10-08 (SIGN-3.5-2026-10-08.md). Shown in
  // place of `intro` only while the training switch is offered: until then
  // `intro` stays, because it is still true.
  introWithTraining:
    "Your recordings are used to run your own coaching. Their words, and numbers measured from them, train models only if you turn on Help improve WillpowerLab.",
} as const;
