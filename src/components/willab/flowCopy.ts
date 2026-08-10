/* -------------------------------------------------------------------------- */
/*  flowCopy — every line the app says between one take and the next.          */
/*                                                                            */
/*  Founder 2026-08-05: "the sequencing system, I need that to be as smooth    */
/*  as possible… they need to be special but accompanied with the text         */
/*  description and follow-ups so that user can safely navigate and should     */
/*  not be feeling left alone in the process; but the communicates should not  */
/*  be too long."                                                             */
/*                                                                            */
/*  The sequence, in the founder's own words:                                  */
/*    recording → ideal text is done → new version ready → communicate →       */
/*    recording 2 → …                                                         */
/*                                                                            */
/*  ⚠️  HELD FOR FOUNDER SIGN-OFF (LIVE LOOP fence: user-facing copy).         */
/*  They live in ONE file so signing off means reading one screen, and         */
/*  changing a line means editing one place rather than hunting components.    */
/*                                                                            */
/*  The rules these follow, and why — full reasoning + the research they       */
/*  rest on in docs/ideal-text-flow-communication.md:                          */
/*                                                                            */
/*   1. NEVER A BARE SPINNER PAST ~10s. A spinner says "alive"; it does not    */
/*      say what, or what next. NN/g's attention-span limit is 10s.           */
/*                                                                            */
/*   2. SAY WHAT IS COMING, NOT HOW FAR ALONG. An accurate progress readout    */
/*      makes things WORSE when the early news is discouraging — people leave. */
/*      It is also what AC-9 requires anyway (no numbers, no counters). The    */
/*      research and the fence happen to agree.                               */
/*                                                                            */
/*   3. TWO SENTENCES, HARD CAP: one line of state, one of what's next. If a   */
/*      third seems needed, the state machine is wrong, not the copy.         */
/*                                                                            */
/*   4. EVERY STATE HAS AN EXIT. "Left alone" is exactly the feeling of a      */
/*      screen with nothing to tap.                                           */
/* -------------------------------------------------------------------------- */

export const FLOW_COPY = {
  /** S2 · the upload landed. Sub-second in the good case; it exists so the
   *  step from "I was speaking" to "the app has it" is never ambiguous. */
  uploaded: "Got that.",

  /** S3 · analysing. Two lines. The second is doing the real work — it grants
   *  PERMISSION TO LEAVE, which is what stops someone sitting and staring at
   *  a spinner. Progress indicators only free you to do something else if you
   *  are told you may. */
  analysing: "Working on your take.",
  analysingNext: "Your ideal text updates when this finishes — you can leave this screen.",

  /** S3-long · past ~90s the line SOFTENS rather than escalating. Never an
   *  estimate: we would be guessing, and a missed estimate is worse than
   *  none at all. Split into state + next like every other pair, so the
   *  "one line of state, one of what's next" shape holds everywhere. */
  analysingLong: "Still working.",
  analysingLongNext: "Longer takes take longer to go through.",

  /** S4 · the version landed. The whole message. What used to sit here —
   *  "your ideal text gets sharper with more takes, three is where it really
   *  lands" — is deleted: a nudge stamped into permanent history reads as
   *  pressure on the tenth scroll-back. */
  versionReady: "Your ideal text is ready.",

  /** SPEC-lockin-loop §1, FOUNDER COPY VERBATIM (2026-08-10): "Users must be
   *  locked out of the old text with a 'Working on your text' screen until
   *  the new text is ready." The blocking screen's line — signed off by
   *  being quoted; this exact string, nothing longer. */
  workingOnText: "Working on your text",

  /** S6 · the invitation back. An invitation, never an instruction. The next
   *  take exists because it improves the text, not because the app asked. */
  recordAgain: "Record it again whenever you're ready.",

  /** Failure. Names what broke, BOUNDS THE DAMAGE (the real fear is "did I
   *  lose everything"), and gives the exit. Never "Error", never a code. */
  failed: "That take didn't go through.",
  failedNext: "Your earlier takes are safe — try recording again.",

  /** Why the record control is withheld mid-analysis (founder: "there is no
   *  new button to record unless the text is displayed and waiting is
   *  finished"). Not only a UX rule — the ideal-text version IS the spoken
   *  take count now, so a take started mid-assembly races the version being
   *  written. */
  recordHeld: "One moment — finishing your last take.",
} as const;
