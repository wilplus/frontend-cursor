import { type ExploreArcDeck } from "@/lib/willab/exploreArc";
import {
  clampSlides,
  nonEmptySlides,
  type PresentationSlide,
} from "./presentation";

/* -------------------------------------------------------------------------- */
/*  When the recording setup form can be SKIPPED (founder 2026-07-30)          */
/*                                                                            */
/*  "Record another take" from an ideal text is a take of a project whose      */
/*  setup already exists — topic, audience, target length, slides, the served  */
/*  deck PDF — and which the Lab has already restored into `preloadDeck`.      */
/*  Walking the user through five screens to re-confirm what the app just      */
/*  pre-filled for itself is five screens of nothing, so the check-in hands    */
/*  straight to the mic instead.                                              */
/*                                                                            */
/*  THE ANSWER IS "USE THE FORM" UNLESS EVERYTHING IS KNOWN. A take is not a   */
/*  thing a user can quietly redo: recording against a context we invented     */
/*  files it under the wrong project, with the wrong deck and the wrong clock. */
/*  So this returns null — meaning "ask" — for every case short of a restored  */
/*  deck with a real topic, including the plain race where the arc-setup fetch */
/*  simply has not come back yet.                                             */
/*                                                                            */
/*  A plain .ts, and the rule lives here rather than in LabOverlay, for the    */
/*  reason speakerSexAskGate.ts gives: vitest runs with no JSX transform, so a */
/*  test cannot import a .tsx at all. The decision that matters is testable;   */
/*  the wiring around it is not, and does not need to be.                     */
/* -------------------------------------------------------------------------- */

/** The setup a take records under. Structurally the Lab's `LabSessionContext`
 *  — declared here rather than imported so this module (and its test) never
 *  reach into a .tsx. */
export interface RestoredSetup {
  topic: string;
  audience: string;
  target_length_seconds: number | null;
  domain_vocabulary: string[];
  slides: PresentationSlide[];
  presentationRef: string | null;
}

/**
 * The context to record with, or null when the setup form must be shown.
 *
 * @param deck  the restored project setup, or null when nothing was restored
 *              (a brand-new topic, or the arc-setup fetch still in flight)
 * @param stagedUpload  a file was staged for upload — it has no topic yet, and
 *                      supplying one is exactly what the form is for
 */
export function restoredSetupFor(
  deck: ExploreArcDeck | null,
  stagedUpload: boolean
): RestoredSetup | null {
  if (stagedUpload || !deck) return null;
  const topic = deck.topic?.trim() ?? "";
  // No topic is no project. Every downstream surface titles the take with it,
  // and an empty one would file this take as an unnamed sibling of a named
  // project rather than the next take of it.
  if (!topic) return null;
  return {
    topic,
    audience: deck.audience?.trim() ?? "",
    target_length_seconds: deck.targetLengthSeconds ?? null,
    domain_vocabulary: [],
    // The same split the form's own submit uses: a SERVED deck keeps its slide
    // count aligned to the PDF's pages, a manually typed one drops empty rows.
    slides: deck.presentationRef
      ? clampSlides(deck.slides)
      : nonEmptySlides(deck.slides),
    presentationRef: deck.presentationRef,
  };
}
