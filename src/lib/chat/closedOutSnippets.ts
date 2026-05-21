/**
 * Per-user persisted Set of snippet IDs whose closer-out sequence
 * (steps 7-10 of the snippet-label flow: thanks → intro → recording-
 * ready) has already fired. Used for idempotency contract C5:
 *
 *   "Navigating away to /dashboard and back to /chat does NOT re-
 *    render the bubble sequence for an already-closed-out snippet."
 *
 * Storage: `localStorage` keyed by user id. Per-user so two accounts
 * on the same browser don't bleed each other's closed-out lists.
 * `null` userId is allowed but reads/writes are no-ops — anonymous
 * sessions don't have snippet review.
 *
 * The Set is the canonical shape returned to callers; we
 * stringify / parse JSON for the localStorage round-trip.
 */

const LS_PREFIX = "willonski.closedOutSnippets.";

function lsKey(userId: string): string {
  return `${LS_PREFIX}${userId}`;
}

/** Read the closed-out Set for `userId`. SSR-safe (returns empty). */
export function loadClosedOutSnippets(userId: string | null): Set<string> {
  if (!userId) return new Set();
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(lsKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    // Corrupted JSON / private-browsing throw — best-effort reset.
    return new Set();
  }
}

/** Persist the Set. SSR-safe (no-op). */
export function saveClosedOutSnippets(
  userId: string | null,
  set: Set<string>
): void {
  if (!userId) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      lsKey(userId),
      JSON.stringify(Array.from(set))
    );
  } catch {
    // private-browsing Safari can throw on .setItem — swallow.
  }
}

/**
 * Immutable "add snippet id" — returns a new Set so callers using
 * the result as a React-state value get a fresh reference and
 * trigger a re-render. Persists side-effectfully.
 */
export function markClosedOut(
  userId: string | null,
  current: Set<string>,
  snippetId: string
): Set<string> {
  const next = new Set(current);
  next.add(snippetId);
  saveClosedOutSnippets(userId, next);
  return next;
}

/** Test utility — clear for the active user. */
export function clearClosedOutSnippets(userId: string | null): void {
  if (!userId) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(lsKey(userId));
  } catch {
    /* swallow */
  }
}
