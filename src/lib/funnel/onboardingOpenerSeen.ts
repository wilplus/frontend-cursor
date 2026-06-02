/**
 * One-shot localStorage flag for the dad-joke onboarding opener (Task T2).
 *
 * The opener fires exactly once per account lifetime — on first
 * welcome_back entry after signup. After the pivot line lands, the flag
 * is set so subsequent onboarding re-entries (profile resets, re-auths)
 * skip straight to the normal welcome_back flow.
 *
 * Pattern mirrors postOnboardingWelcome.ts / postSignupConfirmation.ts —
 * all accesses are try/catch'd so Safari private mode + embedded WebViews
 * degrade silently (worst case: user sees the opener twice, not a crash).
 */

export const OPENER_SEEN_KEY = "willab.onboarding_opener_seen";

export function markOpenerSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OPENER_SEEN_KEY, "1");
  } catch {
    /* swallow — private mode / storage quota */
  }
}

export function hasSeenOpener(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(OPENER_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  In-memory "attempted this page load" guard                                */
/*                                                                            */
/*  Distinct from the persistent seen-flag above. The seen-flag means "the    */
/*  user completed the whole joke — never show it again." This guard means    */
/*  "the opener already ran (or tried to) during THIS page load — don't       */
/*  re-enter the opening phase again."                                        */
/*                                                                            */
/*  Why both? A 204 (empty dad_jokes table) or a transient error must NOT     */
/*  permanently disable the opener — it should retry on the next full page    */
/*  load (e.g. once the BE seeds the table). So the seen-flag is set ONLY on  */
/*  a completed joke. But within a single load we still must not bounce back  */
/*  into "opening" after the opener resolves (the routing + welcome_back      */
/*  effects both gate on these). This module-level flag resets on a full      */
/*  reload (fresh JS context), giving us "retry next load, but not this one". */
/* -------------------------------------------------------------------------- */

let attemptedThisLoad = false;

export function markOpenerAttempted(): void {
  attemptedThisLoad = true;
}

export function hasAttemptedOpener(): boolean {
  return attemptedThisLoad;
}
