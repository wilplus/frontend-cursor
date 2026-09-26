/* -------------------------------------------------------------------------- */
/*  Every word of the one-project delete, signed by the founder 2026-09-25    */
/*  (backend decisions log N8: "Copy approved as written"). Change a word     */
/*  only with sign-off.                                                       */
/*                                                                            */
/*  Delete lives in Data & consent's project list (N14, 2026-09-26), never    */
/*  on the project picker. PROJECT_DELETE_ENABLED keeps it off until a       */
/*  deletion can actually finish: the confirm promises "We'll finish within  */
/*  7 days", and today a real one stops for review (N14.3; the founder kept  */
/*  the four append-only feedback records as they are).                      */
/* -------------------------------------------------------------------------- */

export const PROJECT_DELETE_ENABLED = false;

export const PROJECT_DELETION_COPY = {
  title: (name: string) => `Delete "${name}"?`,
  body:
    "Every take in this project and its ideal text will be permanently deleted. This can't be undone. We'll finish within 7 days, and until then the project is locked.",
  confirm: "Request deletion",
  pending: "Deletion pending",
  cancel: "Cancel deletion",
} as const;
