"use client";

import { createProject } from "@/services/api/projects";
import { updateProjectDeck } from "@/services/api/projectDeck";
import { writeExploreArc, type ExploreArcDeck } from "./exploreArc";
import { beginSetupDraftWithTopic } from "./setupDraft";

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
/*             this project's goodbye, at once (N449 item 2), goes to the     */
/*             set-up for the real talk, its topic the plan's, with the       */
/*             feelings check first (N401 item 4), never to these five        */
/*             questions again.                                               */
/*    take 2   the real talk is Take 2 of this same project (N449 item 1):   */
/*             its set-up runs in full, and its slides become the project's   */
/*             new slides from Take 2 (N257) before the Take is sent.         */
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

/** A deck made of the first Take's questions: its recording screen draws
 *  each one tall, with a mark for each question (N449 item 4). */
export function isFirstTakeDeck(slides: readonly { title: string }[]): boolean {
  return slides.length > 0 && slides.every((s) => firstTakeKicker(s.title) !== null);
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
 *  item 4). Only Take 1's goodbye: from Take 2 on, the project goes on as
 *  any project does. */
export function isFirstTakeArc(ownerId: string | null, arcId: string, takeIndex = 1): boolean {
  return !!arcId && takeIndex === 1 && firstTakeArc(ownerId) === arcId;
}

const REAL_TALK_KEY = "willab.first_take_real_talk";

function realTalkKey(ownerId: string | null): string {
  return `${REAL_TALK_KEY}:${ownerId ?? "guest"}`;
}

/** Whether the next Take of `arcId` is the real talk, set up afresh. */
export function realTalkPending(ownerId: string | null, arcId: string | null | undefined): boolean {
  if (!arcId) return false;
  try {
    return window.localStorage.getItem(realTalkKey(ownerId)) === arcId;
  } catch {
    return false;
  }
}

/** "Record Take 2" after the first Take (N449 item 1): Take 2 of the first
 *  Take's project, its set-up from the start, the topic the plan's. False
 *  when this device made no first Take (the real talk then starts a project
 *  of its own, as before). */
export function startRealTalk(ownerId: string | null, topic: string | null, open: () => void): boolean {
  const arc = firstTakeArc(ownerId);
  if (!arc) return false;
  writeExploreArc(ownerId, arc, 2);
  try {
    window.localStorage.setItem(realTalkKey(ownerId), arc);
  } catch {
    return false;
  }
  beginSetupDraftWithTopic(ownerId, topic);
  open();
  return true;
}

/** Before the real talk's Take is sent: its slides become the project's
 *  new slides from this Take (N257), so the Take is kept on them. Nothing
 *  for any other Take. A refused update leaves the Take to go as it is. */
export async function keepRealTalkSlides(
  ownerId: string | null,
  projectId: string,
  deck: { slides: { title: string; body: string }[]; presentationRef: string | null },
): Promise<void> {
  if (!realTalkPending(ownerId, projectId)) return;
  const stored = await updateProjectDeck(projectId, deck);
  if (!stored.ok) return;
  try {
    window.localStorage.removeItem(realTalkKey(ownerId));
  } catch {
    /* the next Take then sets up again, on the same project */
  }
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
