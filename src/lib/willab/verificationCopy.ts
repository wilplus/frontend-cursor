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

/** Awaiting the coach. The short form, on every surface. */
export const PENDING_VERIFICATION = "Pending verification";

/** The ideal-text overlay's HEADER badge only (founder 2026-07-27).
 *
 *  A deliberate exception to the one-wording rule above, and the only one. In
 *  the header the badge sits directly beside the project's title, where the
 *  surrounding context already says what is being verified — "verification"
 *  there is a word doing no work in a bar that has none to spare. Everywhere
 *  else the state stands alone and needs the full phrase.
 *
 *  It lives here rather than as a literal in the component for the same reason
 *  the constant above exists: a second wording invented at the call site is
 *  exactly how this drifted the first time. One exception, named, in the one
 *  module that owns this state's copy. */
export const PENDING_SHORT = "Pending";

/** The coach has verified this text. */
export const VERIFIED = "Verified";

/** The badge wording for a served `status`. */
export function verificationLabel(status: "verified" | "unverified"): string {
  return status === "verified" ? VERIFIED : PENDING_VERIFICATION;
}
