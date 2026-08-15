/* -------------------------------------------------------------------------- */
/*  IDEAL-TEXT TITLE CACHE — the bubble's name, known before first paint       */
/*  (founder 2026-08-15).                                                     */
/*                                                                            */
/*  THE DEFECT. An ideal-text bubble carries `arc_id` and nothing else — the   */
/*  BE stamps no name on the row — so the card fetched the document on mount   */
/*  and rendered the placeholder "Your ideal text" until it landed. Every      */
/*  bubble in the thread did that on every app open, so the chat opened with   */
/*  a row of placeholders that all swapped a moment later: "first they         */
/*  display the placeholder and only later load the database's name".         */
/*                                                                            */
/*  A title is not volatile. It is the project's name, it changes when the     */
/*  student renames the project, and showing last-known instantly beats        */
/*  showing the wrong words for 200ms — so it is REMEMBERED ACROSS SESSIONS    */
/*  and revalidated behind the paint. Stale-while-revalidate, on a value       */
/*  whose staleness is invisible.                                             */
/*                                                                            */
/*  Two layers on purpose:                                                    */
/*    • a module Map — SYNCHRONOUS, so the second and tenth bubble of the same */
/*      arc (a long version history is many bubbles, one project) paint the    */
/*      name the first one already resolved, with no render at null;          */
/*    • localStorage — so the NEXT app open starts with the Map already warm,  */
/*      which is the case the founder actually reported.                      */
/*                                                                            */
/*  The in-flight promise cache stays in ReportCard: this module holds VALUES  */
/*  a render can read, not requests.                                          */
/*                                                                            */
/*  Best-effort throughout. Private browsing, a full quota and a disabled      */
/*  storage all throw on access, and a title is decoration — every path here   */
/*  degrades to "no cached title", which is exactly the old behaviour.        */
/* -------------------------------------------------------------------------- */

const KEY = "willab.idealTitles";
/** Bounded so a heavy user's history cannot grow the entry without limit.
 *  Oldest-written are dropped first; a dropped arc simply fetches again. */
const MAX_ENTRIES = 60;

/** arcId → title. Read synchronously during render. */
const mem = new Map<string, string>();
let hydrated = false;

function readStore(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Pull localStorage into the Map. Idempotent; safe to call from render. */
function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;               // set FIRST — a throwing read must not retry
  for (const [k, v] of Object.entries(readStore())) mem.set(k, v);
}

/** The last known title for this arc, or null. SYNCHRONOUS — this is the whole
 *  point: it is read during render so the first paint carries the real name. */
export function cachedIdealTitle(arcId: string | null | undefined): string | null {
  if (!arcId) return null;
  hydrate();
  return mem.get(arcId) ?? null;
}

/** Remember a resolved title. A blank clears the entry rather than storing an
 *  empty string — "the server told us there is no name" must not be replayed
 *  next session as if it were one. */
export function rememberIdealTitle(
  arcId: string | null | undefined,
  title: string | null | undefined
): void {
  if (!arcId) return;
  hydrate();
  const clean = (title ?? "").trim();
  if (clean) {
    if (mem.get(arcId) === clean) return;   // no write, no storage churn
    mem.set(arcId, clean);
  } else {
    if (!mem.has(arcId)) return;
    mem.delete(arcId);
  }
  if (typeof window === "undefined") return;
  try {
    const store = readStore();
    if (clean) store[arcId] = clean;
    else delete store[arcId];
    const keys = Object.keys(store);
    if (keys.length > MAX_ENTRIES) {
      for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete store[k];
    }
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode / storage disabled — the Map still serves this
       session, and next session falls back to the fetch. */
  }
}
