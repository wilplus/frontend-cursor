/* -------------------------------------------------------------------------- */
/*  loungePrompts — the Lounge bot's quick-action button vocabulary (B-1/B-2)  */
/*                                                                            */
/*  Wave-3 B-1 replaced the proactive three-chip row (#119) with contextual    */
/*  actions: ordinary turns carry one `suggested_action`; an explicit          */
/*  project-boundary decision may carry the exact two `suggested_actions`.     */
/*  under the reply. B-2 reuses the same vocabulary for the one proactive       */
/*  "review strong sides" button after a training is sent. No more chip rows,   */
/*  no FE intent logic — the classification is BE-owned.                        */
/* -------------------------------------------------------------------------- */

export type ChipAction =
  | "trainings"
  | "audit"
  | "create_new_project"
  | "replace_pdf"
  | "create_project_from_updated_deck"
  | "keep_current_project"
  | "edit_current_slide";

export const CHIP_LABEL: Record<ChipAction, string> = {
  trainings: "Your presentations",
  audit: "Open audit",
  create_new_project: "Create new project",
  replace_pdf: "Replace PDF",
  create_project_from_updated_deck: "Create project from updated deck",
  keep_current_project: "Keep current project",
  edit_current_slide: "Edit the text",
};

// `record_again` is intentionally NOT a chip: the bot points at the permanent
// "Start official recording" button in words instead of rendering an in-app
// record CTA (#119 / reversal of #4). `strong_sides` was removed in R4-13
// (the strong-sides surface is gone; the trainings tab is the destination).
// `arc_checkout` was removed with the $25/arc paywall (only $5 moments is paid).
const VALID_ACTIONS: readonly ChipAction[] = [
  "trainings",
  "audit",
  "create_new_project",
  "replace_pdf",
  "create_project_from_updated_deck",
  "keep_current_project",
  "edit_current_slide",
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

/** Additive multi-action wire contract. Old bot rows still carry the singular
 * field; new project-boundary replies can carry the exact two-button choices
 * without encoding UI labels into prose. */
export function coerceSuggestedActions(raw: unknown): ChipAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(coerceSuggestedAction)
    .filter((value): value is ChipAction => value !== null)
    .filter((value, index, all) => all.indexOf(value) === index);
}
