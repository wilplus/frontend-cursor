/* -------------------------------------------------------------------------- */
/*  "Delete my account" (founder 2026-10-05, Q3a "yes"; backend N45).         */
/*                                                                            */
/*  PROPOSED WORDS, AWAITING THE FOUNDER'S SIGN-OFF. ACCOUNT_DELETE_ENABLED   */
/*  keeps the card off until he signs them; change a word only with sign-off. */
/*  The request is recorded at once and processing stops; an operator         */
/*  finishes the deletion, within the one month Privacy §9 promises. Records */
/*  of purchases stay five years (retention schedule v1.3, N43).              */
/* -------------------------------------------------------------------------- */

export const ACCOUNT_DELETE_ENABLED = false;

export const DELETE_ACCOUNT_COPY = {
  title: "Delete my account",
  body:
    "This permanently deletes your recordings, your texts and your feedback. Records of what you bought are kept for 5 years, as the law requires.",
  button: "Delete my account",
  confirmTitle: "Delete your account?",
  confirmBody:
    "Everything you recorded and wrote here will be permanently deleted. This can't be undone. We'll finish within one month, and from now on nothing new is processed.",
  confirmLabel: "Delete my account",
  done: "Your account is being deleted. We'll finish within one month.",
} as const;
