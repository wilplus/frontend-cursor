/**
 * R4-7 — once-per-arc guard for the "3/3 done, relax" bot bubble.
 *
 * The bubble is posted to the Lounge thread (persisted) when an arc reaches
 * ready && !coach_finalized. A persisted message would re-post on every reload
 * (the in-memory guard resets), so we also mark the arc here so the announce
 * fires exactly once per arc across reloads/devices-on-this-browser.
 *
 * Best-effort localStorage (Safari private mode fails soft).
 */

const KEY = "willab.relax_announced_arcs";

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

export function hasRelaxAnnounced(arcId: string): boolean {
  return readSet().has(arcId);
}

export function markRelaxAnnounced(arcId: string): void {
  if (typeof window === "undefined") return;
  try {
    const set = readSet();
    set.add(arcId);
    // Cap so the marker can't grow unbounded across many arcs.
    const arr = Array.from(set).slice(-200);
    window.localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    /* swallow */
  }
}
