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

/** The coach has verified this text. */
export const VERIFIED = "Verified";

/** The badge wording for a served `status`. */
export function verificationLabel(status: "verified" | "unverified"): string {
  return status === "verified" ? VERIFIED : PENDING_VERIFICATION;
}
