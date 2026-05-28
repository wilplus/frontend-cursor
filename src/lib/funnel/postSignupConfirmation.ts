/**
 * Post-signup confirmation copy stash.
 *
 * Mirrors `postOnboardingWelcome.ts` — task 7's "A human reviews this
 * personally — full analysis within one business day" message lands on
 * /chat's welcome_back phase, but the value travels through the OAuth
 * round-trip which destroys React state. The BE returns the copy on the
 * claim response (`post_signup_confirmation: { headline?, body }`,
 * see task 7 BE handoff); PendingSessionClaim stashes it here and
 * useChatPhase reads it back on the post-claim mount.
 *
 * Two separate fields so callers can render a headline + body without
 * smushing them into a single string. Headline is optional; body is the
 * load-bearing piece (the SLA statement).
 *
 * Falls back to a sensible default ("A human reviews this personally.
 * Full analysis within one business day.") at the consumer site when
 * the stash is empty — BE rollouts that don't carry the new field, or
 * private-mode Safari that can't write localStorage, both degrade to
 * the default copy without breaking the welcome_back flow.
 */

const HEADLINE_KEY = "willab.post_signup_confirmation.headline";
const BODY_KEY = "willab.post_signup_confirmation.body";

export const DEFAULT_POST_SIGNUP_CONFIRMATION_BODY =
  "A human reviews this personally — your full analysis lands within one business day.";

export function setPostSignupConfirmation(payload: {
  headline?: string | null;
  body?: string | null;
}): void {
  if (typeof window === "undefined") return;
  try {
    const headline = payload.headline?.trim();
    const body = payload.body?.trim();
    // Always clear stale values first so a partial new payload doesn't
    // mix with an older headline that no longer applies.
    window.localStorage.removeItem(HEADLINE_KEY);
    window.localStorage.removeItem(BODY_KEY);
    if (headline) window.localStorage.setItem(HEADLINE_KEY, headline);
    if (body) window.localStorage.setItem(BODY_KEY, body);
  } catch {
    /* swallow */
  }
}

export function consumePostSignupConfirmation(): {
  headline: string | null;
  body: string;
} {
  const fallback = {
    headline: null,
    body: DEFAULT_POST_SIGNUP_CONFIRMATION_BODY,
  };
  if (typeof window === "undefined") return fallback;
  try {
    const headline = window.localStorage.getItem(HEADLINE_KEY);
    const body = window.localStorage.getItem(BODY_KEY);
    window.localStorage.removeItem(HEADLINE_KEY);
    window.localStorage.removeItem(BODY_KEY);
    return {
      headline: headline && headline.trim() ? headline.trim() : null,
      body: body && body.trim() ? body.trim() : DEFAULT_POST_SIGNUP_CONFIRMATION_BODY,
    };
  } catch {
    return fallback;
  }
}
