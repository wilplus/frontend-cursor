/* -------------------------------------------------------------------------- */
/*  Every word of the one-project delete, signed by the founder 2026-09-25    */
/*  (backend decisions log N8: "Copy approved as written"). Change a word     */
/*  only with sign-off.                                                       */
/*                                                                            */
/*  PROJECT_DELETE_ENABLED keeps the ⋯ menu off the project rows until the    */
/*  real delete ships (founder 2026-09-26: "Show it when the delete works").  */
/*  The confirm promises "We'll finish within 7 days", so it turns on in the  */
/*  same change as the operator's confirm and the one-project purge.          */
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
