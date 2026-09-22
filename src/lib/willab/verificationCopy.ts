/* -------------------------------------------------------------------------- */
/*  verificationCopy — the ONE wording for the coach-verification state         */
/*                                                                            */
/*  FE-8 (founder 2026-07-27). The badge itself was always correct: it is       */
/*  driven by `status` on the ideal-text GET ("verified" | "unverified"),       */
/*  served since 2026-07-17. What was wrong was COPY DRIFT — the ideal-text     */
/*  screen said "Pending verification by the coach" while the chat card said    */
/*  "Not verified by the coach", for the identical state.                       */
/*                                                                            */
/*  The founder standardised on the short form, everywhere. These live in one   */
/*  module rather than being fixed in the two places the screenshots caught,    */
/*  because a third copy somewhere is exactly how this drifted in the first     */
/*  place: with a constant, the next surface to render this state cannot        */
/*  invent its own wording.                                                     */
/*                                                                            */
/*  LIVE LOOP — user-facing copy. Any change here needs founder sign-off.       */
/* -------------------------------------------------------------------------- */

/* ── THE PENDING STATE IS NOT SURFACED (founder 2026-09-22) ────────────────
 * "please remove that pending from here and from the ideal text bubble; make
 * it hidden, only when it gets verified display it in both places."
 *
 * Pending is the state nearly every text is in nearly all of the time, so a
 * badge for it was a permanent label reporting that nothing had happened —
 * next to the reader's own document it read as a warning about it. Reviewed is
 * the event, and the absence of the badge is now what says "not yet".
 *
 * THE CONSTANTS STAY, unused, and that is the point of this module: if a
 * surface ever needs to name this state again — a coach queue, an admin view —
 * it takes the wording from here rather than inventing a third one, which is
 * the drift FE-8 was raised for. Nothing renders them today; `IdealTextHeading`
 * and `ReportCard` were the two that did. */

/** Awaiting the coach. The short form, on every surface. */
export const PENDING_VERIFICATION = "Pending verification";

/** An ideal text's HEADER badge only (founder 2026-07-27).
 *
 *  A deliberate exception to the one-wording rule above, and the only one. In
 *  the header the badge sits directly beside the project's title, where the
 *  surrounding context already says what is being verified — "verification"
 *  there is a word doing no work in a bar that has none to spare. Everywhere
 *  else the state stands alone and needs the full phrase.
 *
 *  The condition is the POSITION, not the screen. It read "the ideal-text
 *  overlay's header only" while the overlay was the one screen with a head;
 *  since 2026-07-30 the post-recording readout is headed the same way, by the
 *  same shared component, so it earns the same short form for the same
 *  reason. Both mount IdealTextHeading, which is the only caller.
 *
 *  It lives here rather than as a literal in the component for the same reason
 *  the constant above exists: a second wording invented at the call site is
 *  exactly how this drifted the first time. One exception, named, in the one
 *  module that owns this state's copy. */
export const PENDING_SHORT = "Pending";

/** The coach has been through the text (founder 2026-07-27).
 *
 *  "Reviewed", not "Verified": the coach reads the whole thing and works it,
 *  which is a review — "verified" sounds like a checksum passed. ONE constant
 *  on every surface, unlike the pending state, which has a short form for the
 *  header. There is nothing to shorten here; "Reviewed" is already one word. */
export const REVIEWED = "Reviewed";

/** The badge wording for a served `status`. */
export function verificationLabel(status: "verified" | "unverified"): string {
  return status === "verified" ? REVIEWED : PENDING_VERIFICATION;
}
