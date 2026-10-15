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
  // Shortened with the confirm step's tick (founder, prototype, 2026-10-15).
  sensitiveText:
    "You agreed that we may process your recordings even if they reveal sensitive information about you. Withdrawing this stops recording. Everything you already made stays readable.",
  withdraw: "Withdraw",
  withdrawConfirm: "Withdraw and stop recording?",
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
  // Training wording v4 (founder, on the consent prototype, 2026-10-15:
  // "this looks perfect"; backend legal/phase1-2026.1/27-…-v4, N73). The same
  // three parts on every screen that asks: this question, the backend's
  // fingerprinted sentence with Read more after it, and the yes. Read more
  // opens Privacy section 4a; "your practice" is defined in Terms §8.
  trainingQuestion: "Can we make the product so much better for you?",
  trainingYes: "Yes, make it so much better.",
  readMore: "Read more",
  readMoreVersion: (version: string) => `Privacy Policy ${version}, section 4a`,
  // Approved by the founder 2026-09-26 (backend N12, answer 3); wording v2
  // signed 2026-10-08 (SIGN-3.5-2026-10-08.md). Shown in
  // place of `intro` only while the training switch is offered: until then
  // `intro` stays, because it is still true.
  introWithTraining:
    "Your recordings are used to run your own coaching. Their words, and numbers measured from them, train models only if you turn on Help improve WillpowerLab.",
  // The AI version of your voice card, L6-L11 (founder lock 2026-10-12,
  // backend docs/FOUNDER-LOCK-ai-voice-practice-2026-10-12.md, N71). On for
  // everyone; Delete turns it off, Turn on brings it back.
  aiVoiceTitle: "AI version of your voice",
  aiVoiceOn: "Made from your first Take to create your practice examples. Only you hear it.",
  aiVoiceDelete: "Delete",
  aiVoiceDeleteConfirm:
    "Delete your AI voice? We delete it at ElevenLabs and here, with every example made from it, and we stop making examples. Your own recordings stay.",
  aiVoiceOff: "Off. Turn it on and we'll make it from your next Take.",
  // Fixes 2 and 3 (founder, prototype, 2026-10-15: "I approve the 7 fixes as
  // in the prototype"). Privacy 3.6 §4 and §4d promise both "at any time".
  whatsappTitle: "WhatsApp",
  whatsappOn: (phone: string) => `We message ${phone} when your coach’s feedback is in.`,
  whatsappRemove: "Remove",
  whatsappConfirmTitle: "Remove your number?",
  whatsappConfirmBody: "We stop the WhatsApp messages and delete your number.",
  whatsappOff: "Off. Add your number in the Lounge to get a message when your coach’s feedback is in.",
  shareTake: (take: number | null) => (take ? `Take ${take}` : "A take"),
  sharedWith: (where: string) => `shared with ${where}`,
  generalCommunity: "General community",
  stopSharing: "Stop sharing",
  stoppedSharing: "No longer shared. Its clips left every community.",
} as const;
