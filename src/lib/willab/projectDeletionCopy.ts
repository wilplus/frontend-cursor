/* -------------------------------------------------------------------------- */
/*  The signed words of the one-project delete: the founder's 2026-09-25 set  */
/*  (backend decisions log N8: "Copy approved as written") and the honest    */
/*  delete sentence for an active training yes, signed 2026-09-26 (N10).     */
/*  Change a word only with sign-off.                                         */
/*                                                                            */
/*  Delete lives in Data & consent's project list (N14, 2026-09-26), never    */
/*  on the project picker. PROJECT_DELETE_ENABLED keeps it off until a       */
/*  deletion can actually finish: the confirm promises "We'll finish within  */
/*  7 days", and today a real one stops for review (N14.3; the founder kept  */
/*  the four append-only feedback records as they are). Since N48.4 Q17 A a  */
/*  project deletion completes by itself after a 7-day window; the window's  */
/*  words are PROPOSED (leavingCopy.ts) and off behind their own constant.   */
/* -------------------------------------------------------------------------- */

export const PROJECT_DELETE_ENABLED = false;

export const PROJECT_DELETION_COPY = {
  title: (name: string) => `Delete "${name}"?`,
  body:
    "Every take in this project and its ideal text will be permanently deleted. This can't be undone. We'll finish within 7 days, and until then the project is locked.",
  /** `body`'s first sentence, word for word. Once the 7-day window's words
   *  are signed (leavingCopy.ts, PROPOSED) it is followed by those instead
   *  of the rest of `body`. */
  bodyFirstSentence:
    "Every take in this project and its ideal text will be permanently deleted.",
  /** Signed by the founder 2026-09-26 (backend decisions log N10, "Project
   *  delete, switch on"): the honest delete copy for a person with an active
   *  training yes. It replaces `body` (SPEC-training-corpus §7), because
   *  their training copies outlive a project delete until they withdraw. */
  withTraining:
    "Your project will be deleted. Recordings you shared for training stay until you withdraw that permission.",
  confirm: "Request deletion",
  pending: "Deletion pending",
  cancel: "Cancel deletion",
} as const;
