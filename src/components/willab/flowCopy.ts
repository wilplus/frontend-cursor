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
/*   3. TWO SENTENCES, HARD CAP. The active processing chip is the deliberate */
/*      one-line exception: it becomes the way back into the processing view. */
/*                                                                            */
/*   4. EVERY STATE HAS AN EXIT. "Left alone" is exactly the feeling of a      */
/*      screen with nothing to tap.                                           */
/* -------------------------------------------------------------------------- */

export const FLOW_COPY = {
  /** S2 · the upload landed. Sub-second in the good case; it exists so the
   *  step from "I was speaking" to "the app has it" is never ambiguous. */
  uploaded: "Got that.",

  /** S3 · analysing. One line, founder-approved 2026-08-26. The processing
   *  status itself becomes the way back into the full processing view, so a
   *  second explanatory line is no longer needed. */
  analysing: "Working on your take.",



  /* `workingOnText` lived here — "Working on your text", the blocking
   * screen's own line (SPEC-lockin-loop §1, founder 2026-08-10). DELETED
   * 2026-08-11 by the founder: "unify the loading state but use the more
   * elaborate one and delete the working on your text fully". The BLOCK is
   * unchanged — the old text stays inaccessible while the document
   * assembles — but both phases of the wait now render ProcessingWait, so
   * the wait stops changing its subject halfway through and stops reading
   * as the machine starting over. Removed rather than left unused: a second
   * waiting line that still exists is one that comes back. */

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
