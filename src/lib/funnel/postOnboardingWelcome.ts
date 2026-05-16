/**
 * Post-onboarding welcome flag.
 *
 * The new onboarding flow keeps users inside the /chat thread through
 * recording → metrics → signup → "thanks, check email" → Q&A. The
 * signup hop (Supabase / OAuth) destroys React state, so we stash a
 * one-shot flag in localStorage at the moment the user taps "Sign Up"
 * on the metrics-ask bubble. When /chat re-mounts post-auth, it reads
 * the flag, transitions straight into the welcome-back phase, and
 * clears the flag.
 *
 * Separate from `willab_pending_session_id` (which carries the guest
 * session id for the backend claim) — the flags can coexist: one says
 * "claim this session", the other says "after the claim, render the
 * welcome bubbles + Q&A composer instead of the WaitingScreen".
 *
 * All accesses are try/catch'd so Safari private mode + embedded
 * WebViews degrade silently — the worst case is the user sees the
 * default post-auth screen.
 */

export const POST_ONBOARDING_WELCOME_KEY =
  "willab.post_onboarding_welcome";

export function setPostOnboardingWelcome(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POST_ONBOARDING_WELCOME_KEY, "1");
  } catch {
    /* swallow */
  }
}

export function consumePostOnboardingWelcome(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(POST_ONBOARDING_WELCOME_KEY);
    if (v === "1") {
      window.localStorage.removeItem(POST_ONBOARDING_WELCOME_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
