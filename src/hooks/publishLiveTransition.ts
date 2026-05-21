/**
 * Pure helper for `usePublishLiveSubscription`. Extracted to its own
 * file (no React, no Supabase imports) so the contract can be unit-
 * tested without dragging the whole browser-client surface into the
 * vitest module graph. The hook re-exports / consumes this directly.
 */

/**
 * Does this Realtime payload represent the null → non-null transition
 * of `results_published_at`? That's the admin-publish signal we want
 * to deliver live to the user's chat tab.
 *
 * Tolerates the various ways Supabase emits `payload.old` / `payload.new`:
 *   - normal UPDATE with both sides present
 *   - INSERT (no `old`) — never the publish-transition we want
 *   - REPLICA IDENTITY FULL missing → `old` is `{}` → treat as null
 *   - Edge case: Supabase has historically emitted empty strings for
 *     nullable timestamp columns in some publication configs. Treated
 *     as "unpublished" on either side.
 */
export function isPublishTransition(payload: {
  old?: Record<string, unknown> | null;
  new?: Record<string, unknown> | null;
}): boolean {
  const oldRow = (payload?.old ?? {}) as Record<string, unknown>;
  const newRow = (payload?.new ?? {}) as Record<string, unknown>;
  const before = oldRow.results_published_at;
  const after = newRow.results_published_at;
  const wasUnpublished =
    before === null || before === undefined || before === "";
  const isNowPublished = typeof after === "string" && after.length > 0;
  return wasUnpublished && isNowPublished;
}
