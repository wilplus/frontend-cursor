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

export type ChipAction = "strong_sides" | "trainings" | "record_again" | "audit";

export const CHIP_LABEL: Record<ChipAction, string> = {
  strong_sides: "★ Strong sides",
  trainings: "Trainings",
  record_again: "Record again",
  audit: "Open audit",
};

const VALID_ACTIONS: readonly ChipAction[] = [
  "strong_sides",
  "trainings",
  "record_again",
  "audit",
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

/** The per-turn record CTA the Lounge renders from a chat-query reply: the
 *  composer mic invite (show_record_ui === true) + the single suggested-action
 *  button. Per-turn — never cached. Locks the show_record_ui / suggested_action
 *  → render contract so the CTA fires the moment the BE emits the flags (the FE
 *  wiring is already in place). */
export interface RecordCta {
  showRecordUi: boolean;
  action: ChipAction | null;
}

export function deriveRecordCta(resp: {
  show_record_ui?: boolean;
  suggested_action?: unknown;
}): RecordCta {
  return {
    showRecordUi: resp.show_record_ui === true,
    action: coerceSuggestedAction(resp.suggested_action),
  };
}
