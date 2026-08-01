/* -------------------------------------------------------------------------- */
/*  panelCache — why switching views stopped costing a spinner                 */
/*                                                                            */
/*  Every panel view is its own route, so tapping a pill UNMOUNTS the view you */
/*  were on and MOUNTS a new one. `usePanelResource` then fetched from scratch */
/*  and rendered `LoadingLine` while it waited — every time, including on the  */
/*  way back to a view you left two seconds ago. Nine views, two hops each     */
/*  (browser → BFF → backend), and no memory between them.                    */
/*                                                                            */
/*  STALE-WHILE-REVALIDATE. A view that has been read once renders from cache  */
/*  IMMEDIATELY and refreshes behind the screen. First visit is unchanged;     */
/*  every return visit is instant.                                            */
/*                                                                            */
/*  The staleness is real and it is bounded: this is one person's own writing, */
/*  they are the only writer, and the revalidation is already in flight while  */
/*  they read. What is NOT acceptable is stale data surviving a write, so      */
/*  every mutation calls `invalidatePanelData()` and the next read is honest.  */
/*                                                                            */
/*  WHY NOT MOUNT ALL NINE VIEWS AT ONCE (founder's suggestion, 2026-08-01):   */
/*  it would work, and it costs the routes. Nine views behind one URL loses a  */
/*  link per view, the back button and every deep link into the panel, and it  */
/*  fires nine reads on open for views most sessions never open. The half of   */
/*  that idea worth having is "the data is already there when you switch",     */
/*  which is this file plus prefetch-on-intent, with the routing intact.       */
/*                                                                            */
/*  DELIBERATELY NOT A LIBRARY. The panel has one cache shape and one          */
/*  invalidation rule; a dependency would bring five more.                     */
/* -------------------------------------------------------------------------- */

/** Cached payloads by key. `unknown` because one store serves every view; the
 *  hook that reads it owns the type, exactly as `load` already did. */
const store = new Map<string, unknown>();

/** Reads in flight, so two callers for the same key (a prefetch that has not
 *  landed, and the mount that follows it) share ONE request rather than
 *  racing. Without this, hovering a pill and then tapping it fetches twice. */
const inflight = new Map<string, Promise<unknown>>();

/** A monotonic stamp bumped on every invalidation. A read that was already in
 *  flight when the cache was cleared must not repopulate it with what it
 *  fetched BEFORE the write — it would put the deleted row straight back. */
let epoch = 0;

export function readPanelCache<T>(key: string): T | undefined {
  return store.has(key) ? (store.get(key) as T) : undefined;
}

/**
 * Fetch `key`, sharing an in-flight read and populating the cache.
 *
 * A rejection is NOT cached: an error is a moment, not a value, and caching it
 * would leave the view broken until something else invalidated. The caller
 * sees the rejection and renders its own retry, as it always did.
 */
export function fetchPanelResource<T>(
  key: string,
  load: () => Promise<T>
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const startedAt = epoch;
  const promise = load()
    .then((value) => {
      // Only keep it if no write landed while this was in the air.
      if (epoch === startedAt) store.set(key, value);
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });

  inflight.set(key, promise as Promise<unknown>);
  return promise;
}

/** Warm a key without rendering it. Errors are swallowed on purpose: a
 *  prefetch that fails must be invisible, because the user has not asked for
 *  anything yet and the real read will report its own failure. */
export function prefetchPanelResource<T>(
  key: string,
  load: () => Promise<T>
): void {
  if (store.has(key) || inflight.has(key)) return;
  void fetchPanelResource(key, load).catch(() => {});
}

/**
 * Drop everything, so the next read is honest.
 *
 * Called after any write: the dock's Add, an inline edit, a proposal decision,
 * the hard delete. Deliberately WHOLESALE rather than per-key — a drafted row
 * can land in several views at once (a document yields goals AND habits AND
 * distractions), and a per-key invalidation that missed one would leave a view
 * showing a list that is quietly short. Clearing all of it costs one refetch
 * per view actually revisited.
 */
export function invalidatePanelData(): void {
  epoch += 1;
  store.clear();
  inflight.clear();
}
