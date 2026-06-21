/**
 * Explore-session arc state — persists the arc_id + next take_index (+ the deck)
 * in localStorage so the linkage survives between LabOverlay sessions (the user
 * goes back to the Lounge between takes, reads the cadence bubble, then opens
 * the Lab again for the next take).
 *
 * Continue-one-arc (2026-06-20): one ever-growing arc per deck. The BE is the
 * authority on grouping (by deck-hash) and on take_index; this localStorage
 * entry is just a within-sitting / cross-overlay convenience that carries the
 * arc_id (and now the deck, so a "record another take" can pre-fill the Lab).
 * The "3 takes" is only the unlock threshold — the arc keeps growing, so we no
 * longer clear it at a take cap.
 */

const KEY = "willab_explore_arc";

/** The deck an arc belongs to — carried so a next/another take can pre-fill the
 *  Lab (topic + slides + the already-served PDF) without re-entry. */
export interface ExploreArcDeck {
  topic: string;
  presentationRef: string | null;
  slides: { title: string; body: string }[];
}

export interface ExploreArc {
  arcId: string;
  /** The take_index to use on the NEXT POST (1-indexed; starts at 2 after take
   *  1 is confirmed). The BE reconciles this from the deck's real take count. */
  nextTakeIndex: number;
  /** Optional (back-compat with arcs written before this field existed). */
  deck?: ExploreArcDeck;
}

function pickDeck(raw: unknown): ExploreArcDeck | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.slides)) return undefined;
  const slides = d.slides
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      title: typeof s.title === "string" ? s.title : "",
      body: typeof s.body === "string" ? s.body : "",
    }));
  return {
    topic: typeof d.topic === "string" ? d.topic : "",
    presentationRef:
      typeof d.presentationRef === "string" && d.presentationRef.length > 0
        ? d.presentationRef
        : null,
    slides,
  };
}

export function readExploreArc(): ExploreArc | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.arcId !== "string" || typeof v.nextTakeIndex !== "number")
      return null;
    return {
      arcId: v.arcId,
      nextTakeIndex: v.nextTakeIndex,
      deck: pickDeck(v.deck),
    };
  } catch {
    return null;
  }
}

export function writeExploreArc(
  arcId: string,
  nextTakeIndex: number,
  deck?: ExploreArcDeck
): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ arcId, nextTakeIndex, deck }));
  } catch {
    // storage quota — not fatal; the arc just won't carry to the next session
  }
}

export function clearExploreArc(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
