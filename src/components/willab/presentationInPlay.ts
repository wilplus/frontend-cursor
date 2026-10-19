import { deckForRecording, type DeckSlide } from "@/lib/willab/defaultDeck";

/* -------------------------------------------------------------------------- */
/*  presentationInPlay — which presentation a later Take is said against      */
/*                                                                            */
/*  Founder 2026-10-16 ("Second take falls back to the first take's           */
/*  presentation"): the second Take mirrors the first, and the speaker sees   */
/*  which presentation is in play before recording. The line sits under       */
/*  "Getting your mic ready" before every Take after the first. The words     */
/*  were signed by the founder in chat on 2026-10-18 (lock amendment of the   */
/*  same day) and are typed here exactly as signed.                           */
/* -------------------------------------------------------------------------- */

export const PRESENTATION_IN_PLAY = {
  /** The file the speaker uploaded for Take 1. */
  own: "Same presentation as Take 1",
  /** The stand-in deck Take 1 used. */
  standIn: "Same stand-in presentation as Take 1",
} as const;

type DeckSetup = { slides: readonly DeckSlide[]; presentationRef: string | null };

/** The line for a Take said against `setup`, or null until it is known. Pure. */
export function presentationInPlay(setup: DeckSetup | null): string | null {
  if (!setup) return null;
  return deckForRecording(setup.slides, setup.presentationRef).isDefault
    ? PRESENTATION_IN_PLAY.standIn
    : PRESENTATION_IN_PLAY.own;
}

/** The line under "Getting your mic ready": only before a later Take, for the
 *  setup the Take records with, else the project's restored setup while the
 *  mic is still being asked for. Take 1 has no earlier Take to mirror. */
export function laterTakePresentation(
  takeNumber: number,
  recording: DeckSetup | null,
  restored: DeckSetup | null,
): string | null {
  if (takeNumber <= 1) return null;
  return presentationInPlay(recording ?? restored);
}
