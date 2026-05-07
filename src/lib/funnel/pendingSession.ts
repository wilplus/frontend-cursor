/**
 * Pending guest-session helpers.
 *
 * The cold-start funnel records audio anonymously, then asks the user to
 * sign up. OAuth round-trips (e.g. LinkedIn) destroy React state, so the
 * anonymous `guest_session_id` MUST live in persistent storage to survive
 * the redirect. The post-auth `<PendingSessionClaim>` hook reads it back,
 * POSTs to the claim endpoint to link it to the new user, and clears it.
 *
 * Wrapped in try/catch because Safari private mode + some embedded WebViews
 * throw on localStorage access. Failing soft is fine — the worst case is
 * the user has to record again, not a crash.
 */
export const PENDING_SESSION_KEY = "willab_pending_session_id";

export function setPendingSessionId(id: string): void {
  if (typeof window === "undefined") return;
  if (!id) return;
  try {
    window.localStorage.setItem(PENDING_SESSION_KEY, id);
  } catch {
    /* private mode or storage disabled — fall through */
  }
}

export function getPendingSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PENDING_SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearPendingSessionId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_SESSION_KEY);
  } catch {
    /* swallow */
  }
}
