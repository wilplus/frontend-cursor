import { clampSlides, deckFileError } from "@/components/willab/presentation";
import { extractPresentation } from "@/services/api/presentationExtract";
import { updateProjectDeck } from "@/services/api/projectDeck";
import { readExploreArc, writeExploreArc } from "@/lib/willab/exploreArc";
import { primeLabSetup, primedLabSetup } from "@/lib/willab/labEntryHandover";

/* -------------------------------------------------------------------------- */
/*  Update a project's slides, inside the project (founder 2026-10-29,        */
/*  backend N257).                                                            */
/*                                                                            */
/*  The PDF is read by the same deck parsing a new project uses (PDF only,    */
/*  the same caps), then the project's deck is replaced on the server. The    */
/*  device's cached deck for this project, and a setup the Ideal Text page    */
/*  handed to the Lab, take the new slides too, so the next Take starts on    */
/*  them; the Lab still reads the project's setup again behind them.          */
/* -------------------------------------------------------------------------- */

/** Already on the Ideal Text page's ⋯ menu (`IdealTextMenu`): the one
 *  failure line, so no new words are needed for a failed upload. */
export const DECK_UPDATE_FAILED = "Couldn't save that just now. Give it another go.";

export type DeckUpdateResult =
  | { status: "ok"; nextTake: number | null }
  | { status: "error"; message: string };

export async function uploadNewSlides(
  file: File,
  { projectId, ownerId }: { projectId: string; ownerId: string | null },
): Promise<DeckUpdateResult> {
  const guard = deckFileError(file);
  if (guard) return { status: "error", message: guard };
  const read = await extractPresentation(file);
  if (read.status !== "ok" || read.deck.slides.length === 0) {
    return { status: "error", message: DECK_UPDATE_FAILED };
  }
  const deck = { slides: clampSlides(read.deck.slides), presentationRef: read.deck.presentationRef };
  const saved = await updateProjectDeck(projectId, deck);
  if (!saved.ok) return { status: "error", message: DECK_UPDATE_FAILED };
  adoptNewDeck(ownerId, projectId, deck);
  return { status: "ok", nextTake: saved.nextTake };
}

/** The device's copies of this project's deck take the new slides. A cache
 *  for another project, or one with no deck, is left alone: the Lab reads
 *  the project's setup for it. */
function adoptNewDeck(
  ownerId: string | null,
  projectId: string,
  deck: { slides: { title: string; body: string }[]; presentationRef: string | null },
): void {
  const cached = readExploreArc(ownerId);
  if (cached?.arcId === projectId && cached.deck) {
    writeExploreArc(
      ownerId,
      cached.arcId,
      cached.nextTakeIndex,
      { ...cached.deck, slides: deck.slides, presentationRef: deck.presentationRef },
      cached.sessionId,
    );
  }
  const handed = primedLabSetup(projectId);
  if (handed) {
    primeLabSetup(projectId, {
      ...handed,
      slides: deck.slides,
      presentationRef: deck.presentationRef,
      deckChanged: true,
    });
  }
}
