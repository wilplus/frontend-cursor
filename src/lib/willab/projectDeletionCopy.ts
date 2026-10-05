/* -------------------------------------------------------------------------- */
/*  The signed words of the one-project delete: the founder's 2026-09-25 set  */
/*  (backend decisions log N8: "Copy approved as written"). Change a word     */
/*  only with sign-off. N10's sentence for an active training yes was retired */
/*  on 2026-10-05 (W5 A, N50): a training yes now adds the signed "A model    */
/*  already trained stays." (leavingCopy.ts) to whichever body shows.         */
/*                                                                            */
/*  Delete lives in Data & consent's project list (N14, 2026-09-26), never    */
/*  on the project picker. PROJECT_DELETE_ENABLED keeps it off until a        */
/*  deletion can actually finish: the confirm promises "We'll finish within   */
/*  7 days", and today a real one stops for review (N14.3; the founder kept   */
/*  the four append-only feedback records as they are). Since N48.4 Q17 A a   */
/*  project deletion completes by itself after a 7-day window; the window's   */
/*  words are signed (W4 A, leavingCopy.ts) and go on with Delete itself.     */
/* -------------------------------------------------------------------------- */

export const PROJECT_DELETE_ENABLED = false;

export const PROJECT_DELETION_COPY = {
  title: (name: string) => `Delete "${name}"?`,
  body:
    "Every take in this project and its ideal text will be permanently deleted. This can't be undone. We'll finish within 7 days, and until then the project is locked.",
  /** `body`'s first sentence, word for word. With the 7-day window on it is
   *  followed by the window's words (leavingCopy.ts) instead of the rest of
   *  `body`. */
  bodyFirstSentence:
    "Every take in this project and its ideal text will be permanently deleted.",
  confirm: "Request deletion",
  pending: "Deletion pending",
  cancel: "Cancel deletion",
} as const;
