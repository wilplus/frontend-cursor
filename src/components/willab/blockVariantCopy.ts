/* -------------------------------------------------------------------------- */
/*  blockVariantCopy — every user-visible string in the block variant picker,   */
/*  the revision timeline and restore (BLOCK_VARIANTS_ENABLED), in ONE place.  */
/*                                                                            */
/*  FOUNDER-SIGNED-OFF 2026-08-03 ("Copy is fine, ship it as is") — these      */
/*  exact strings ship. The LIVE LOOP gate (R13) is closed for THIS wording    */
/*  only: any change to any string here re-opens it and needs a fresh          */
/*  founder sign-off before merge. One file to read, one file to change.       */
/*                                                                            */
/*  AC-9 guard on the words themselves: nothing here may compare versions      */
/*  ("better", "best", "improved"), rank them, or surface a count/score. The   */
/*  picker is neutral — the student browses and chooses; the offer lane keeps  */
/*  the recommendation language, and it keeps it OUTSIDE this file.            */
/*                                                                            */
/*  Restore semantics the copy must carry (handoff §4.4): restore brings back  */
/*  that version's CHOICES — it never deletes, and blocks added since stay.    */
/*  No "delete everything since" framing, no confirmation-of-loss language     */
/*  anywhere (there is no loss to confirm; the pool is append-only).           */
/* -------------------------------------------------------------------------- */

export const BLOCK_VARIANT_COPY = {
  /* --- the per-block picker entry ---------------------------------------- */
  entry: "Versions",

  /* --- variant badges (provenance, never judgment) ------------------------ */
  /** Take badge — same provenance convention as the existing 1.0/2.0 pills. */
  takeBadge: (takeIndex: number): string => `Take ${takeIndex}`,
  takeBadgeUnknown: "A take",
  userEditBadge: "My edit",
  currentMarker: "Current",

  /* --- selecting ----------------------------------------------------------- */
  select: "Use this version",
  selectFailed: "Couldn't save that just now. Give it another go.",

  /* --- the timeline -------------------------------------------------------- */
  timelineEntry: "Version history",
  timelineTitle: "Version history",
  /** Reason lines — qualitative history copy for the closed enum, NEVER the
   *  raw token. `unknown` is the FE's degrade for a token outside the enum:
   *  neutral, claims nothing specific. */
  reason: {
    seed: "First assembled",
    accept: "Suggestion accepted",
    select: "You chose a version",
    restore: "Restored an earlier version",
    unknown: "Updated",
  } as const,

  /* --- restore -------------------------------------------------------------- */
  restore: "Bring back these choices",
  restoreReassurance: "Nothing is deleted — you can return to any version.",
  restoreFailed: "Couldn't bring that back just now. Give it another go.",
} as const;
