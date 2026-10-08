import type { RecordingRoot } from "@/components/willab/RecordingRoadmap";
import type { ArcSetup } from "@/services/api/arcSetup";
import type { ExploreArcDeck } from "@/lib/willab/exploreArc";

/* -------------------------------------------------------------------------- */
/*  "Record Take N" starts without reading again (founder 2026-10-08, P2).    */
/*                                                                            */
/*  After the tap, the Lab used to read the project's setup and its locked   */
/*  helper words before the Take could start by itself, though the Ideal     */
/*  Text page had just read both. The page now leaves its latest reads here, */
/*  keyed by project; the Lab takes them at once and still reads again       */
/*  behind, so a newer answer replaces them in place. Nothing here, or too   */
/*  old: the Lab reads and waits exactly as before.                          */
/*                                                                            */
/*  Not a cache of record: only successful reads, only for a short while,    */
/*  and every Lab entry revalidates. Timing only; the flow is the lock's     */
/*  ("Record Take N" -> "Getting your mic ready" -> the Take starts).        */
/* -------------------------------------------------------------------------- */

/** How long a page read stands in for the Lab's own. Long enough for a
 *  speaker who reads the page a while before tapping Record; the Lab's read
 *  behind it replaces anything that changed. */
export const LAB_HANDOVER_TTL_MS = 5 * 60_000;

type Held<T> = { at: number; value: T };

const setups = new Map<string, Held<ArcSetup>>();
const roots = new Map<string, Held<RecordingRoot[]>>();

function fresh<T>(map: Map<string, Held<T>>, arcId: string | null | undefined): T | null {
  if (!arcId) return null;
  const held = map.get(arcId);
  if (!held) return null;
  if (Date.now() - held.at > LAB_HANDOVER_TTL_MS) {
    map.delete(arcId);
    return null;
  }
  return held.value;
}

/** A successful read of the project's setup. */
export function primeLabSetup(arcId: string, setup: ArcSetup): void {
  if (arcId) setups.set(arcId, { at: Date.now(), value: setup });
}

/** Projects whose helper words are being saved right now. Their words are
 *  neither kept nor handed over until the save is confirmed: a Take started
 *  in that moment waits for its own read rather than opening on the words
 *  the speaker just replaced. */
const held = new Set<string>();

/** Hold (or release) the handover of a project's helper words. Holding also
 *  drops whatever was kept. */
export function holdLabRoots(arcId: string | null | undefined, hold: boolean): void {
  if (!arcId) return;
  if (hold) {
    held.add(arcId);
    roots.delete(arcId);
  } else {
    held.delete(arcId);
  }
}

/** A successful read of the project's locked helper words. */
export function primeLabRoots(arcId: string, list: readonly RecordingRoot[]): void {
  if (arcId && !held.has(arcId)) roots.set(arcId, { at: Date.now(), value: [...list] });
}

export function primedLabSetup(arcId: string | null | undefined): ArcSetup | null {
  return fresh(setups, arcId);
}

export function primedLabRoots(arcId: string | null | undefined): RecordingRoot[] | null {
  if (arcId && held.has(arcId)) return null;
  return fresh(roots, arcId);
}

/** The deck a continued Take starts from: the device's own cached deck,
 *  else a setup the page read a moment ago (signed in only, as the Lab's own
 *  setup read is). `primed` says the second, so the Lab still reads behind. */
export function continuedTakeDeck(
  cached: { arcId?: string | null; deck?: ExploreArcDeck } | null,
  signedIn: boolean | null,
): { deck: ExploreArcDeck | null; primed: boolean } {
  if (cached?.deck) return { deck: cached.deck, primed: false };
  const setup = signedIn === true ? primedLabSetup(cached?.arcId) : null;
  return setup ? { deck: deckOf(setup), primed: true } : { deck: null, primed: false };
}

/** The Lab's deck shape for a setup read. */
export function deckOf(setup: ArcSetup): ExploreArcDeck {
  return {
    topic: setup.topic,
    audience: setup.audience,
    presentationRef: setup.presentationRef,
    slides: setup.slides,
    targetLengthSeconds: setup.targetLengthSeconds,
  };
}

/** Tests only. */
export function forgetLabHandover(): void {
  held.clear();
  setups.clear();
  roots.clear();
}
