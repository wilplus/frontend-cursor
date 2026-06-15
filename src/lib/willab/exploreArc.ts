/**
 * Explore-session arc state — persists the arc_id + next take_index in
 * localStorage so the linkage survives between LabOverlay sessions (the user
 * goes back to the Lounge between takes, reads the cadence bubble, then opens
 * the Lab again for the next vibe).
 *
 * The arc is LOAD-BEARING (Prompt B §F2): without it the BE can't cross-
 * compare takes. Clear only after the arc is exhausted (nextTakeIndex > 4)
 * or the user explicitly abandons it.
 */

const KEY = "willab_explore_arc";

export interface ExploreArc {
  arcId: string;
  /** The take_index to use on the NEXT POST (1-indexed; starts at 2 after
   *  take 1 is confirmed). The arc is exhausted when this exceeds 4. */
  nextTakeIndex: number;
}

export function readExploreArc(): ExploreArc | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as ExploreArc;
    if (typeof v.arcId !== "string" || typeof v.nextTakeIndex !== "number")
      return null;
    return v;
  } catch {
    return null;
  }
}

export function writeExploreArc(arcId: string, nextTakeIndex: number): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ arcId, nextTakeIndex }));
  } catch {
    // storage quota — not fatal; the arc just won't carry to the next session
  }
}

export function clearExploreArc(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
