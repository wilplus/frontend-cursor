"use client";

import { createProject } from "@/services/api/projects";
import { writeExploreArc, type ExploreArcDeck } from "./exploreArc";

/* -------------------------------------------------------------------------- */
/*  The first Take is the onboarding (backend N401; rules:                    */
/*  docs/flows/the-plan.md).                                                  */
/*                                                                            */
/*    start    "Start your first recording" makes the first Take's project,   */
/*             its deck the plan's five questions, and opens the recording    */
/*             screens on it at once: no set-up form, no feelings check, a    */
/*             strip that counts up (N401 item 2), as "Record an answer"      */
/*             opens on its one slide (chatAnswer.ts).                        */
/*    after    the backend reads the Take slide by slide after its walk and  */
/*             writes the plan (services/plan_flow.py); "Record Take 2" from */
/*             this project's goodbye goes to the set-up for the real talk,   */
/*             its topic the plan's, with the feelings check first (N401     */
/*             item 4), never to these five questions again.                  */
/* -------------------------------------------------------------------------- */

/** One of the first Take's slides, as the plan sends it. */
export interface FirstTakeSlide {
  kicker: string;
  title: string;
  body: string;
}

/** The first Take's project name: "Take 1 · Your first Take" (the locked
 *  prototype "The first Take", N401). */
export const FIRST_TAKE_TOPIC = "Your first Take";

/** The small title above each question (N401 item 2, signed), by the
 *  question on the slide. The deck itself stays `{title, body}`, the wire
 *  contract, so the small title is found by the slide's own words, as the
 *  stand-in deck is (defaultDeck.ts). */
const KICKERS: Readonly<Record<string, string>> = {
  "What do you do, and what do you know best?": "About you",
  "What are you practising for, and why does it matter?": "Your talk",
  "When is it, and who will be in the room?": "The room",
  "If they remember one sentence from you, what is it?": "Your one sentence",
  "How will you open? Say your first sentence.": "Your opening",
};

/** The small title for a slide of the first Take, else null. */
export function firstTakeKicker(title: string | null | undefined): string | null {
  return (title && KICKERS[title.trim()]) || null;
}

const ARC_KEY = "willab.first_take_arc";

function arcKey(ownerId: string | null): string {
  return `${ARC_KEY}:${ownerId ?? "guest"}`;
}

/** The first Take's project, once made on this device, else null. */
export function firstTakeArc(ownerId: string | null): string | null {
  try {
    return window.localStorage.getItem(arcKey(ownerId));
  } catch {
    return null;
  }
}

/** Whether a goodbye's "Record Take 2" belongs to the first Take: it then
 *  starts the real talk's set-up, never the five questions again (N401
 *  item 4). */
export function isFirstTakeArc(ownerId: string | null, arcId: string): boolean {
  return !!arcId && firstTakeArc(ownerId) === arcId;
}

function deckOf(slides: readonly FirstTakeSlide[]): ExploreArcDeck {
  return {
    topic: FIRST_TAKE_TOPIC,
    audience: null,
    presentationRef: null,
    slides: slides.map((s) => ({ title: s.title, body: s.body })),
    targetLengthSeconds: null,
  };
}

let starting = false;

/** "Start your first recording" on a first-Take plan: the project of the
 *  five questions, then `open` opens the recording screens on it. False
 *  when the project could not be made (the button stays as it was). */
export async function startFirstTake(
  slides: readonly FirstTakeSlide[],
  ownerId: string | null,
  open: () => void,
): Promise<boolean> {
  if (starting || slides.length === 0) return false;
  starting = true;
  const deck = deckOf(slides);
  const created = await createProject({
    displayName: FIRST_TAKE_TOPIC,
    setup: {
      topic: deck.topic,
      audience: null,
      target_length_seconds: null,
      domain_vocabulary: [],
      slides: deck.slides,
      presentation_ref: null,
      strategic_context: null,
      presentation_mode: "deckless",
    },
  });
  starting = false;
  if (created.kind !== "ok") return false;
  try {
    window.localStorage.setItem(arcKey(ownerId), created.projectId);
  } catch {
    /* the next Take then opens as any project's would */
  }
  writeExploreArc(ownerId, created.projectId, 1, deck);
  open();
  return true;
}
