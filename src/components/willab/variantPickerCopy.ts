/* -------------------------------------------------------------------------- */
/*  variantPickerCopy — every user-facing string of the variant picker +       */
/*  revisions surfaces, in ONE place.                                          */
/*                                                                            */
/*  ⚠ COPY PENDING FOUNDER SIGN-OFF (BE spec §7, FE-HANDOFF-2026-08-03-        */
/*  variant-picker). The picker ships dark behind BLOCK_VARIANTS_ENABLED;      */
/*  none of these strings reaches a user until the founder signs them off      */
/*  and the flag flips. Edit HERE only — components render these keys.         */
/*                                                                            */
/*  AC-9: qualitative only. No numbers as judgment anywhere — take numbers    */
/*  appear only as provenance badges ("Take 2"), never as ranks or scores.    */
/* -------------------------------------------------------------------------- */

export const VARIANT_PICKER_COPY = {
  /** The notebook header entry point (shown only when something is
   *  pickable). */
  entry: "Versions",
  /** Sheet title. */
  sheetTitle: "Your versions",
  /** One line under the title — the reassurance that kills fear #1. */
  sheetSubtitle: "Every take keeps its words. Pick freely — nothing is lost.",
  /** Block with no label from the BE: a neutral part name (1-based). */
  blockFallbackLabel: (n: number) => `Part ${n}`,
  /** Variant badges (provenance, never rank). */
  takeBadge: (takeIndex: number) => `Take ${takeIndex}`,
  takeBadgeUnknown: "Recorded take",
  editBadge: "My edit",
  currentMarker: "Current",
  /** Row action + busy/failure lines (sheet-local). */
  useVersion: "Use this version",
  saving: "Saving…",
  saveFailed: "Couldn’t save that just now. Give it another go.",

  /** The revisions timeline sheet. */
  historyEntry: "History",
  historyTitle: "Your text over time",
  /** reason → one qualitative line. Closed enum (BE-clamped); an unknown
   *  reason renders the fallback, never the raw token. */
  reason: {
    seed: "First assembled",
    accept: "Suggestion accepted",
    select: "You chose a version",
    restore: "Restored an earlier version",
    fallback: "Updated",
  },
  headMarker: "Now",
  restoreAction: "Bring back these choices",
  /** The reassurance line under the restore action (fear #2). */
  restoreReassurance:
    "Nothing is deleted — you can return to any version.",
  restoreFailed: "Couldn’t restore just now. Give it another go.",
  historyEmpty: "Your text’s history will collect here.",
} as const;
