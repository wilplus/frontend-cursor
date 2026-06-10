/* -------------------------------------------------------------------------- */
/*  loungePrompts — the Lounge bot's quick-action button vocabulary (B-1/B-2)  */
/*                                                                            */
/*  Wave-3 B-1 replaced the proactive three-chip row (#119) with single,       */
/*  intent-driven buttons: the BE classifies the user's ask into one           */
/*  `suggested_action` (S1) and the FE renders that single matching button     */
/*  under the reply. B-2 reuses the same vocabulary for the one proactive       */
/*  "review strong sides" button after a training is sent. No more chip rows,   */
/*  no FE intent logic — the classification is BE-owned.                        */
/* -------------------------------------------------------------------------- */

export type ChipAction = "strong_sides" | "recordings" | "record_again";

export const CHIP_LABEL: Record<ChipAction, string> = {
  strong_sides: "★ Strong sides",
  recordings: "🕓 Recordings",
  record_again: "Record again",
};

const VALID_ACTIONS: readonly ChipAction[] = [
  "strong_sides",
  "recordings",
  "record_again",
];

/**
 * S1 (B-1) — coerce the BE's `suggested_action` wire value into a known
 * ChipAction, or null. Absent / null / unknown → null → the FE renders no
 * button. This is the graceful-degradation seam: on every turn until BE-2
 * ships the field, `suggested_action` is undefined and no button appears.
 */
export function coerceSuggestedAction(raw: unknown): ChipAction | null {
  return typeof raw === "string" &&
    (VALID_ACTIONS as readonly string[]).includes(raw)
    ? (raw as ChipAction)
    : null;
}
