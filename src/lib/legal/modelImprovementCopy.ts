/** /account/model-improvement (Q7, founder 2026-09-29).
 *
 *  The consent text itself comes from the backend's approved policy row and
 *  is never written here. The form's strings are the founder gate's, signed
 *  when that gate shipped. Every string this page adds is a placeholder
 *  marked "[founder copy]" until the founder signs it. */
export const MODEL_IMPROVEMENT_COPY = {
  // New on this page: placeholders, founder sign-off pending.
  title: "[founder copy] Help willab learn from your practice",
  notApplicable:
    "[founder copy] This choice is not available for your account yet.",
  granted: "[founder copy] You have agreed. Thank you.",
  withdraw: "[founder copy] Withdraw",
  withdrawing: "[founder copy] Withdrawing…",
  declined: "[founder copy] No consent has been stored.",
  back: "[founder copy] Back to your data choices",
  // Reused from the founder gate, signed earlier. Do not edit here.
  agree: "Agree and continue",
  saving: "Saving…",
  doNotAgree: "Do not agree",
  reviewAgain: "Review again",
  errorTitle: "We couldn't prepare the consent screen safely.",
  tryAgain: "Try again",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
} as const;

export const DATA_CHOICES_PATH = "/account/data-consent";
export const MODEL_IMPROVEMENT_PATH = "/account/model-improvement";
