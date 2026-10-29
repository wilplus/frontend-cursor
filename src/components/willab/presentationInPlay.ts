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
/*                                                                            */
/*  Founder 2026-10-29 (backend N257): a project's deck can change inside    */
/*  the project. On the first Take with the new slides the line says "New    */
/*  slides"; from the next Take it names the Take the deck was first used    */
/*  on ("Same presentation as Take 5"), as the project's setup read says.    */
/* -------------------------------------------------------------------------- */

export const PRESENTATION_IN_PLAY = {
  /** The file the speaker uploaded for Take 1. */
  own: "Same presentation as Take 1",
  /** The stand-in deck Take 1 used. */
  standIn: "Same stand-in presentation as Take 1",
  /** The first Take on a deck that changed since the last Take (N257). */
  newSlides: "New slides",
  /** The speaker's file, first used on Take `take` (N257). */
  ownSince: (take: number) => `Same presentation as Take ${take}`,
} as const;

type DeckSetup = { slides: readonly DeckSlide[]; presentationRef: string | null };

/** What the project's setup read says about its deck (N257); null = not
 *  read yet, which reads as today's lines. */
export type DeckNews = { deckChanged: boolean; deckSinceTake: number | null } | null;

/** The deck news a setup read carries. */
export function deckNewsOf(setup: {
  deckChanged?: boolean;
  deckSinceTake?: number | null;
}): DeckNews {
  return { deckChanged: setup.deckChanged === true, deckSinceTake: setup.deckSinceTake ?? null };
}

/** The line for a Take said against `setup`, or null until it is known. Pure. */
export function presentationInPlay(setup: DeckSetup | null, news: DeckNews = null): string | null {
  if (!setup) return null;
  if (news?.deckChanged) return PRESENTATION_IN_PLAY.newSlides;
  if (deckForRecording(setup.slides, setup.presentationRef).isDefault) return PRESENTATION_IN_PLAY.standIn;
  return PRESENTATION_IN_PLAY.ownSince(news?.deckSinceTake ?? 1);
}

/** The line under "Getting your mic ready": only before a later Take, for the
 *  setup the Take records with, else the project's restored setup while the
 *  mic is still being asked for. Take 1 has no earlier Take to mirror. */
export function laterTakePresentation(
  takeNumber: number,
  recording: DeckSetup | null,
  restored: DeckSetup | null,
  news: DeckNews = null,
): string | null {
  if (takeNumber <= 1) return null;
  return presentationInPlay(recording ?? restored, news);
}
