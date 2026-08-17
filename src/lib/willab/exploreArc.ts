/**
 * Explore-session arc state — persists the arc_id + next take_index (+ the deck)
 * in localStorage so the linkage survives between LabOverlay sessions (the user
 * goes back to the Lounge between takes, reads the cadence bubble, then opens
 * the Lab again for the next take).
 *
 * Project identity is explicit: a new project gets a fresh arc UUID and only
 * "record another take" carries one forward. The BE is authoritative on that
 * identity and on take_index; this localStorage entry is only a within-sitting
 * / cross-overlay convenience (and carries the deck for setup pre-fill).
 * The "3 takes" is only the unlock threshold — the arc keeps growing, so we no
 * longer clear it at a take cap.
 */

const LEGACY_KEY = "willab_explore_arc";
const KEY_PREFIX = "willab_explore_arc:v2";

/** Project carry-over is browser convenience, but it still contains identity.
 * Scope it to the authenticated account (or this browser's guest lane) so an
 * account switch can never seed another person's project into a recording. */
export function exploreArcStorageKey(ownerId: string | null): string {
  return `${KEY_PREFIX}:${ownerId ?? "guest"}`;
}

/** The deck an arc belongs to — carried so a next/another take can pre-fill the
 *  Lab (topic + slides + the already-served PDF + the set length) without
 *  re-entry. */
export interface ExploreArcDeck {
  topic: string;
  /** The project's audience, inherited into a continued take's setup form.
   *  null/absent = not carried (older seeds). */
  audience?: string | null;
  presentationRef: string | null;
  slides: { title: string; body: string }[];
  /** R5 fix — the training's set length, so takes 2/3 restore the countdown
   *  timer instead of resetting to a stopwatch. null/absent = no set length. */
  targetLengthSeconds?: number | null;
}

export interface ExploreArc {
  arcId: string;
  /** The take_index to use on the NEXT POST (1-indexed; starts at 2 after take
   *  1 is confirmed). The BE reconciles this from the deck's real take count. */
  nextTakeIndex: number;
  /** Optional (back-compat with arcs written before this field existed). */
  deck?: ExploreArcDeck;
  /** FE-1 — a prior take's session id, so the Lab can restore this arc's setup
   *  (deck included) from the server when localStorage lost the deck. Seeded
   *  from the thread's recording-summary at the "record next take" sites. */
  sessionId?: string;
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
    audience: typeof d.audience === "string" ? d.audience : null,
    presentationRef:
      typeof d.presentationRef === "string" && d.presentationRef.length > 0
        ? d.presentationRef
        : null,
    slides,
    targetLengthSeconds:
      typeof d.targetLengthSeconds === "number" && d.targetLengthSeconds > 0
        ? d.targetLengthSeconds
        : null,
  };
}

export function readExploreArc(ownerId: string | null): ExploreArc | null {
  try {
    const raw = localStorage.getItem(exploreArcStorageKey(ownerId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.arcId !== "string" || typeof v.nextTakeIndex !== "number")
      return null;
    return {
      arcId: v.arcId,
      nextTakeIndex: v.nextTakeIndex,
      deck: pickDeck(v.deck),
      sessionId: typeof v.sessionId === "string" ? v.sessionId : undefined,
    };
  } catch {
    return null;
  }
}

export function writeExploreArc(
  ownerId: string | null,
  arcId: string,
  nextTakeIndex: number,
  deck?: ExploreArcDeck,
  sessionId?: string
): void {
  try {
    localStorage.setItem(
      exploreArcStorageKey(ownerId),
      JSON.stringify({ arcId, nextTakeIndex, deck, sessionId })
    );
    // Never preserve the old cross-account slot once this build has written a
    // properly scoped value. Existing database projects are unaffected.
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // storage quota — not fatal; the arc just won't carry to the next session
  }
}

export function clearExploreArc(ownerId: string | null): void {
  try {
    localStorage.removeItem(exploreArcStorageKey(ownerId));
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}
