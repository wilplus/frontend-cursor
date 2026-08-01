/* -------------------------------------------------------------------------- */
/*  viewCache — stale-while-revalidate for the panel views (founder 2026-08-01)*/
/*                                                                            */
/*  Every pill tap used to mount a view that fetched from zero, so switching   */
/*  Principles → Wins → Phrases showed a load state each time: the request     */
/*  rides phone → BFF → backend → database, and nothing remembered the answer  */
/*  from four seconds ago. The ask was "render all at once and then states     */
/*  change", and this is that, without holding the first paint hostage to the  */
/*  slowest view:                                                              */
/*                                                                            */
/*    · the shell WARMS every view's read the moment the panel opens;          */
/*    · a view with a cached answer renders it INSTANTLY and revalidates in    */
/*      the background, swapping fresh data in when it lands;                  */
/*    · a view with no cached answer loads exactly as it always did.           */
/*                                                                            */
/*  MEMORY ONLY, on purpose. The corpus holds addiction, confession-shaped     */
/*  material and named third parties (BE-10); localStorage would be a second,  */
/*  unguarded copy of all of it that survives sign-out. This cache dies with   */
/*  the tab.                                                                   */
/*                                                                            */
/*  STALE BEATS ERROR, never beats empty-handed: a failed background refresh   */
/*  keeps showing the data it had; a failed FIRST load still shows the error   */
/*  state, because there is nothing truthful to show instead.                  */
/* -------------------------------------------------------------------------- */

type Loader<T> = () => Promise<T>;

const cache = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();

/* Bumped by dropViews(). A request that STARTED before a drop must not write
 * its answer into the world after it: the drop exists because that answer is
 * known-stale (rows were just applied) or must not exist at all (hard
 * delete). */
let generation = 0;

/** The cached answer for a view, or undefined when there is none.
 *
 *  `undefined` means ABSENT; `null` is a real cached answer (fetchDay
 *  legitimately resolves to null), which is why callers must test
 *  `!== undefined` and never truthiness. */
export function readView<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

/** Run (or join) the read for a view.
 *
 *  One request per key at a time: a view mounting while the shell's warm-up
 *  is already fetching it JOINS that request rather than issuing a twin. */
export function fetchView<T>(key: string, load: Loader<T>): Promise<T> {
  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<T>;
  const startedIn = generation;
  const request = load().then(
    (value) => {
      if (generation === startedIn) cache.set(key, value);
      if (pending.get(key) === request) pending.delete(key);
      return value;
    },
    (err) => {
      if (pending.get(key) === request) pending.delete(key);
      throw err;
    }
  );
  pending.set(key, request);
  return request;
}

/** Fire the reads for every view that has neither an answer nor one on the
 *  way. Failures are swallowed HERE only: a warm-up is best-effort, and a
 *  view it failed for still owns its own honest error state on mount. */
export function warmViews(loaders: Record<string, Loader<unknown>>): void {
  for (const [key, load] of Object.entries(loaders)) {
    if (cache.has(key) || pending.has(key)) continue;
    void fetchView(key, load).catch(() => {});
  }
}

/** Forget everything, and disown every request in flight.
 *
 *  Two callers, two reasons: the dock's apply (the answers are known-stale —
 *  rows were just created) and the hard delete (the answers must not outlive
 *  the data they were read from). */
export function dropViews(): void {
  generation += 1;
  cache.clear();
  pending.clear();
}
