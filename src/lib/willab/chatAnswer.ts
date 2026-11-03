"use client";

import { useSyncExternalStore } from "react";
import { createProject } from "@/services/api/projects";
import { sendChatAnswer, type ChatMessage } from "@/services/api/chats";
import {
  clearExploreArc,
  readExploreArc,
  writeExploreArc,
  type ExploreArc,
  type ExploreArcDeck,
} from "./exploreArc";

/* -------------------------------------------------------------------------- */
/*  "Record an answer" in a chat with a person (backend N321 item 4, N336,    */
/*  N345, N361, N363; rules: docs/flows/customer-requests.md C1).             */
/*                                                                            */
/*    start    the question becomes a project of its own, one slide holding   */
/*             the asker's words (N361 item 3), and the recording screens     */
/*             open on it at once, no feelings check (N363 item 2). The      */
/*             project never becomes the speaker's current one: the one they  */
/*             had is put back when the screens close.                        */
/*    finish   Finish take brings the speaker straight back to the chat       */
/*             (N363 item 1), where the answer reads "Sending to {name}…"     */
/*             with Undo for 5 seconds (N345 item 2). The Take uploads and    */
/*             processes on its own, as any Take does.                        */
/*    send     once the 5 seconds have passed and the Take is uploaded, the   */
/*             answer is sent: a voice message that plays the Take (backend   */
/*             POST /v2/chats/<id>/answer). Undo throws it away before the    */
/*             person sees it; the Take stays the speaker's own practice. A   */
/*             Take that never uploads, or a refused send, shows nothing new, */
/*             as a voice note's failure does (N321 item 2).                  */
/*                                                                            */
/*  One answer at a time. The recording screens read `answering()` as they   */
/*  open; the chat reads `usePendingAnswer`.                                  */
/* -------------------------------------------------------------------------- */

/** How long an answer can still be taken back (N345 item 2). */
export const UNDO_MS = 5000;

/** Who the answer is for, and to what. */
export interface AnswerFor {
  chatId: string;
  /** The person's name, above "Take 1 · Slide 1 of 1" (N334 item 2). */
  name: string;
  /** Their question, the one slide (N361 item 3). */
  question: string;
  /** A customer gets the answer on WhatsApp (N342). */
  customer: boolean;
}

/** An answer recorded and on its way: "Sending to {name}…" with Undo. */
export interface PendingAnswer {
  chatId: string;
  name: string;
  durationMs: number;
  /** The 5 seconds have passed: no more Undo, it goes as soon as it can. */
  waited: boolean;
  /** When the 5 seconds started (ms), for the bar's countdown (N368). */
  startedAt: number;
}

type Answering = AnswerFor & { ownerId: string | null; before: ExploreArc | null };
type Sending = PendingAnswer & {
  take: string | null;
  posting: boolean;
  failed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

let answering_: Answering | null = null;
let starting = false;
let sending: Sending | null = null;
const listeners = new Set<() => void>();
const sentTo = new Set<(chatId: string, message: ChatMessage) => void>();

function changed() {
  listeners.forEach((listener) => listener());
}

/** The deck of an answer: one slide, the asker's words (N361 item 3). */
export function answerDeck(question: string): ExploreArcDeck {
  return { topic: question, audience: null, presentationRef: null, slides: [{ title: question, body: "" }], targetLengthSeconds: null };
}

/** The answer the recording screens are opening for, else null. */
export function answering(): AnswerFor | null {
  if (!answering_) return null;
  const { chatId, name, question, customer } = answering_;
  return { chatId, name, question, customer };
}

/** "Record an answer": the question's own project, then `open` opens the
 *  recording screens on it. False when the project could not be made (the
 *  bar stays as it was). */
export async function startAnswer(answer: AnswerFor, ownerId: string | null, open: () => void): Promise<boolean> {
  if (answering_ || sending || starting) return false;
  starting = true;
  const deck = answerDeck(answer.question);
  const created = await createProject({
    displayName: answer.question.slice(0, 200),
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
  answering_ = { ...answer, ownerId, before: readExploreArc(ownerId) };
  writeExploreArc(ownerId, created.projectId, 1, deck);
  open();
  return true;
}

/** Finish take (N363 item 1): the answer is on its way. */
export function answerRecorded(durationMs: number): void {
  if (!answering_) return;
  if (sending?.timer) clearTimeout(sending.timer);
  const next: Sending = {
    chatId: answering_.chatId,
    name: answering_.name,
    durationMs: Math.max(1, Math.round(durationMs)),
    startedAt: Date.now(),
    take: null,
    waited: false,
    posting: false,
    failed: false,
    timer: null,
  };
  next.timer = setTimeout(() => {
    if (sending !== next) return;
    sending = { ...next, waited: true, timer: null };
    changed();
    void trySend(sending);
  }, UNDO_MS);
  sending = next;
  changed();
}

/** The Take is uploaded (its session id), or it could not be (null). */
export function answerTake(take: string | null): void {
  const current = sending;
  if (!current) return;
  if (!take) {
    current.failed = true;
    if (current.waited) drop(current);
    return;
  }
  current.take = take;
  void trySend(current);
}

/** Undo (N345 item 2): thrown away before the person sees it. */
export function undoAnswer(): void {
  if (sending && !sending.waited) drop(sending);
}

/** The recording screens closed: the speaker's own project is theirs again.
 *  An answer whose Take never came is dropped; one on its way goes on. */
export function endAnswer(): void {
  const done = answering_;
  if (!done) return;
  answering_ = null;
  if (done.before) {
    writeExploreArc(done.ownerId, done.before.arcId, done.before.nextTakeIndex, done.before.deck, done.before.sessionId);
  } else {
    clearExploreArc(done.ownerId);
  }
  if (sending && !sending.take && !sending.posting) drop(sending);
}

/** Called with each answer the backend has kept, for its chat to show. */
export function onAnswerSent(listener: (chatId: string, message: ChatMessage) => void): () => void {
  sentTo.add(listener);
  return () => sentTo.delete(listener);
}

function drop(answer: Sending) {
  if (answer.timer) clearTimeout(answer.timer);
  if (sending === answer) {
    sending = null;
    changed();
  }
}

async function trySend(answer: Sending) {
  if (sending !== answer || !answer.waited || answer.posting) return;
  if (answer.failed && !answer.take) {
    drop(answer);
    return;
  }
  if (!answer.take) return;
  answer.posting = true; // sent once
  const message = await sendChatAnswer(answer.chatId, answer.take, answer.durationMs);
  if (sending === answer) drop(answer);
  if (message) sentTo.forEach((listener) => listener(answer.chatId, message));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The answer on its way in this chat, if any. */
export function usePendingAnswer(chatId: string): PendingAnswer | null {
  const current = useSyncExternalStore(subscribe, () => sending, () => null);
  if (!current || current.chatId !== chatId) return null;
  return current;
}

/** Tests only. */
export function forgetAnswers(): void {
  if (sending?.timer) clearTimeout(sending.timer);
  answering_ = null;
  sending = null;
  starting = false;
  listeners.clear();
  sentTo.clear();
}
