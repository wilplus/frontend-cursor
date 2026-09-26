/* -------------------------------------------------------------------------- */
/*  "State has already been used" — one silent restart (2026-09-26).          */
/*                                                                            */
/*  Supabase's /auth/v1/callback refuses a PKCE state it has already turned   */
/*  into a code (supabase/auth internal/api/external.go, error code           */
/*  `flow_state_already_used`). That only happens when the provider's answer  */
/*  reaches Supabase TWICE in one sign-in: the consent page submitting twice, */
/*  or the browser retrying the callback. The first hit succeeds, the second  */
/*  is refused, and the browser keeps whichever response arrives last — the  */
/*  refusal. The code the first hit issued went to a navigation the browser   */
/*  dropped, so nothing on our side can finish that sign-in.                  */
/*                                                                            */
/*  What CAN finish it is starting over. The provider already holds the       */
/*  person's consent, so a fresh sign-in comes straight back without the      */
/*  consent page that double-submitted. We do that once, automatically; a     */
/*  second refusal falls through to the ordinary "Sign-in failed" path, so    */
/*  this can never loop.                                                      */
/*                                                                            */
/*  The service-worker bypass of 2026-05-10 (4e2c2496) was the first answer   */
/*  to this error. It removed our own layer from the path; this covers the    */
/*  duplicate that happens before the request ever reaches our origin.        */
/* -------------------------------------------------------------------------- */

export type OAuthProvider = "linkedin_oidc" | "google";

const STORAGE_KEY = "willab_oauth_attempt";

/** Older than this, the pending record is not the sign-in that just failed. */
const ATTEMPT_TTL_MS = 10 * 60 * 1000;

interface OAuthAttempt {
  provider: OAuthProvider;
  startedAt: number;
  /** True once the automatic restart has been used for this sign-in. */
  retried: boolean;
}

/** True when the error Supabase returned is the replayed-state refusal. */
export function isStateReplayError(
  errorCode: string | null | undefined,
  detail: string | null | undefined
): boolean {
  if (errorCode === "flow_state_already_used") return true;
  return typeof detail === "string" && /state has already been used/i.test(detail);
}

function readAttempt(): OAuthAttempt | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OAuthAttempt>;
    if (parsed.provider !== "linkedin_oidc" && parsed.provider !== "google") return null;
    if (typeof parsed.startedAt !== "number") return null;
    return {
      provider: parsed.provider,
      startedAt: parsed.startedAt,
      retried: parsed.retried === true,
    };
  } catch {
    return null;
  }
}

function writeAttempt(attempt: OAuthAttempt): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attempt));
  } catch {
    /* No storage: the restart just is not available. Never fatal. */
  }
}

/** Record a sign-in the person started by tapping a provider button. */
export function rememberOAuthStart(provider: OAuthProvider): void {
  writeAttempt({ provider, startedAt: Date.now(), retried: false });
}

/** The provider to restart with, or null when no restart is due.
 *  Claims the restart as it answers, so a second refusal returns null. */
export function claimOAuthRetry(now: number = Date.now()): OAuthProvider | null {
  const attempt = readAttempt();
  if (!attempt || attempt.retried) return null;
  if (now - attempt.startedAt > ATTEMPT_TTL_MS) return null;
  writeAttempt({ ...attempt, retried: true });
  return attempt.provider;
}
