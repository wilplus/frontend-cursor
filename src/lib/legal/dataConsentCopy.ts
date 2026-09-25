/* -------------------------------------------------------------------------- */
/*  Every word on the Data & consent page, in one place.                      */
/*                                                                            */
/*  APPROVED: signed off by the founder 2026-09-25 with the locked choices   */
/*  E2 = C, E3 = A, E5 = A ("Wording: approved as shown on the page").        */
/*  PENDING: needed by the build and NOT yet signed off. Each is marked, and  */
/*  none may ship until the founder approves it.                              */
/* -------------------------------------------------------------------------- */

export const DATA_CONSENT_COPY = {
  title: "Data & consent",
  intro:
    "Your recordings are used to run your own coaching. They are not used to train models.",
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
} as const;

/** TODO(copy, founder): none of these may ship before sign-off. */
export const DATA_CONSENT_PENDING_COPY = {
  cancel: "Cancel",
  loadFailed: "Couldn’t load your choices. Try again.",
  recordingOff: "Recording is off.",
  agreeAgain: "Agree again",
  erasureFinishing: "Your practice recordings are still being deleted.",
  recordScreenOff:
    "Recording is off because you withdrew your consent. You can turn it back on in Data & consent.",
  privacyUnavailable:
    "The privacy policy couldn’t be loaded. Refresh the page to try again.",
} as const;
