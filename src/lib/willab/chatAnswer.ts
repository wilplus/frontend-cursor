"use client";

import { useSyncExternalStore } from "react";
import { createProject } from "@/services/api/projects";
import { sendChatAnswer, undoChatAnswer, type ChatMessage } from "@/services/api/chats";
import { answerInquiry, undoInquiry } from "@/services/api/takeMatches";
import {
  clearExploreArc,
  readExploreArc,
  writeExploreArc,
  type ExploreArc,
  type ExploreArcDeck,
} from "./exploreArc";

/* -------------------------------------------------------------------------- */
/*  "Record an answer" in a chat with a person (backend N321 item 4, N336,    */
/*  N345, N361, N363, N441; rules: docs/flows/customer-requests.md C1).       */
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
/*    send     as soon as the Take is uploaded, the answer goes to the        */
/*             backend, held there for what is left of the 5 seconds (N441    */
/*             item 3), so leaving the app no longer stops it: a voice        */
/*             message that plays the Take (POST /v2/chats/<id>/answer). Once */
/*             the 5 seconds have passed it shows as sent. A refused send     */
/*             stays in the bar, "Not sent" with "Send again" (N441 item 1).  */
/*    undo     takes it back on the backend before the person sees it; the   */
/*             Take stays the speaker's own practice and Will says so in      */
/*             their chat with him (N441 item 5). A Take that never uploads   */
/*             shows its error on the recording screens, as any Take's.       */
/*                                                                            */
/*  A question (`asks`, "Record your question" in "Ask {name}", backend N483 */
/*  item 4, N498) goes the same way: its project has no slides of its own, so */
/*  the recording screens open on the default presentation (Opening, Main     */
/*  points, Summary), and it is sent to the question route, which marks it    */
/*  for the other person to answer.                                           */
/*                                                                            */
/*  One at a time. The recording screens read `answering()` as they open;    */
/*  the chat reads `usePendingAnswer`.                                        */
/* -------------------------------------------------------------------------- */

/* "Ask {name}" remembers two things on this device (N483 item 4): whether
 * the speaker has asked anyone a question yet (the sheet's three steps show
 * only before that), and whether they have tapped the "+" (orange until
 * then). Unreadable storage reads as not yet. */
const ASKED = "willab.ask.asked";
const PLUS_SEEN = "willab.ask.plusSeen";
function remembered(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function remember(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Not kept on this device: asked again next time.
  }
}
/** The speaker has sent a question before, on this device. */
export const askedBefore = (): boolean => remembered(ASKED);
/** The "+" has been tapped before, on this device. */
export const plusSeen = (): boolean => remembered(PLUS_SEEN);
export const markPlusSeen = (): void => remember(PLUS_SEEN);

/** How long an answer can still be taken back (N345 item 2). */
export const UNDO_MS = 5000;

/** Who the answer is for, and to what. */
export interface AnswerFor {
  chatId: string;
  /** The person's name, at the top of the recording screens (N441 item 7). */
  name: string;
  /** Their question, the one slide (N361 item 3). */
  question: string;
  /** A customer; the answer reaches them in the app until WhatsApp delivery
   *  exists (N441 item 4). */
  customer: boolean;
  /** A question to them, not an answer ("Record your question", N483 item
   *  4): no slide of theirs, the default presentation instead. */
  asks?: boolean;
  /** An answer to a matched Take (backend N485, #1712): the asking chat's
   *  id. It goes to the matching's own routes, held the same 5 seconds;
   *  the chat with the asker is made only once it counts (N486 item 1). */
  inquiry?: string;
  /** An answer to their Take: its slides' titles, in order, so the answer
   *  follows the Take slide by slide (backend N493 item 1). Absent for a
   *  question, which keeps its one slide. */
  slides?: string[];
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
  /** The send was refused: "Not sent" with "Send again" (N441 item 1). */
  failed: boolean;
}

type Answering = AnswerFor & { ownerId: string | null; before: ExploreArc | null; project: string };
type Sending = PendingAnswer & {
  project: string;
  asks: boolean;
  inquiry: string | null;
  take: string | null;
  posting: boolean;
  message: ChatMessage | null;
  undone: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

let current: Answering | null = null;
let starting = false;
let sending: Sending | null = null;
/** What the chat sees of `sending`, a new object at each change. */
let shown: PendingAnswer | null = null;
const listeners = new Set<() => void>();
const sentListeners = new Set<(chatId: string, message: ChatMessage) => void>();

function changed() {
  shown = sending
    ? { chatId: sending.chatId, name: sending.name, durationMs: sending.durationMs, waited: sending.waited, startedAt: sending.startedAt, failed: sending.failed }
    : null;
  listeners.forEach((listener) => listener());
}

/** The deck of an answer: one slide, the asker's words (N361 item 3); an
 *  answer to their Take, the Take's own slides (N493 item 1). A question has
 *  none: the recording screens draw the default presentation. */
function answerDeck(answer: AnswerFor): ExploreArcDeck {
  const titles = answer.slides?.filter((title) => title.trim()) ?? [];
  const slides = answer.asks ? [] : titles.length ? titles.map((title) => ({ title, body: "" })) : [{ title: answer.question, body: "" }];
  return { topic: answer.question, audience: null, presentationRef: null, slides, targetLengthSeconds: null };
}

/** A question's project is named for whom it is to, as its screens' top line
 *  says (N483 item 6). */
const projectName = (answer: AnswerFor) => (answer.asks ? `To ${answer.name}` : answer.question).slice(0, 200);

/** The answer the recording screens are opening for, else null. */
export function answering(): AnswerFor | null {
  if (!current) return null;
  const { chatId, name, question, customer, asks, slides } = current;
  return { chatId, name, question, customer, asks, slides };
}

/** "Record an answer": the question's own project, then `open` opens the
 *  recording screens on it. False when the project could not be made (the
 *  bar stays as it was). */
export async function startAnswer(answer: AnswerFor, ownerId: string | null, open: () => void): Promise<boolean> {
  if (current || sending || starting) return false;
  starting = true;
  const deck = answerDeck(answer);
  const created = await createProject({
    displayName: projectName(answer),
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
  current = { ...answer, ownerId, before: readExploreArc(ownerId), project: created.projectId };
  writeExploreArc(ownerId, created.projectId, 1, deck);
  open();
  return true;
}

/** Finish take (N363 item 1): the answer is on its way. */
export function answerRecorded(durationMs: number): void {
  if (!current) return;
  if (sending?.timer) clearTimeout(sending.timer);
  const next: Sending = {
    chatId: current.chatId,
    name: current.name,
    project: current.project,
    asks: current.asks === true,
    inquiry: current.inquiry ?? null,
    durationMs: Math.max(1, Math.round(durationMs)),
    startedAt: Date.now(),
    take: null,
    message: null,
    waited: false,
    failed: false,
    posting: false,
    undone: false,
    timer: null,
  };
  next.timer = setTimeout(() => {
    if (sending !== next) return;
    next.waited = true;
    next.timer = null;
    if (next.message) sent(next);
    else changed();
  }, UNDO_MS);
  sending = next;
  changed();
}

/** The Take is uploaded (its session id), or it could not be (null). */
export function answerTake(take: string | null): void {
  const answer = sending;
  if (!answer || answer.take) return;
  if (!take) {
    drop(answer);
    return;
  }
  answer.take = take;
  void post(answer);
}

/** Undo (N345 item 2): taken back before the person sees it, on the
 *  backend too; Will says so in the speaker's chat with him (N441 item 5). */
export function undoAnswer(): void {
  const answer = sending;
  if (!answer || answer.waited || answer.failed) return;
  answer.undone = true;
  drop(answer);
  void tellUndo(answer);
}

/** "Send again" (N441 item 1): the same Take, at once; no Undo any more. */
export function sendAgain(): void {
  const answer = sending;
  if (!answer || !answer.failed) return;
  if (answer.timer) clearTimeout(answer.timer);
  answer.timer = null;
  answer.failed = false;
  answer.waited = true;
  changed();
  void post(answer, 0);
}

/** The recording screens closed: the speaker's own project is theirs again.
 *  An answer whose Take never came is dropped; one on its way goes on. */
export function endAnswer(): void {
  const done = current;
  if (!done) return;
  current = null;
  if (done.before) {
    writeExploreArc(done.ownerId, done.before.arcId, done.before.nextTakeIndex, done.before.deck, done.before.sessionId);
  } else {
    clearExploreArc(done.ownerId);
  }
  if (sending && !sending.take) drop(sending);
}

/** Called with each answer the backend has kept, for its chat to show. */
export function onAnswerSent(listener: (chatId: string, message: ChatMessage) => void): () => void {
  sentListeners.add(listener);
  return () => sentListeners.delete(listener);
}

function drop(answer: Sending) {
  if (answer.timer) clearTimeout(answer.timer);
  if (sending === answer) {
    sending = null;
    changed();
  }
}

function sent(answer: Sending) {
  drop(answer);
  const message = answer.message;
  if (message) sentListeners.forEach((listener) => listener(answer.chatId, message));
}

/** To the backend, held there for `holdMs`: by default what is left of the
 *  5 seconds. */
async function post(answer: Sending, holdMs = Math.max(0, answer.startedAt + UNDO_MS - Date.now())) {
  if (answer.posting || answer.message || !answer.take) return;
  answer.posting = true;
  const message = answer.inquiry
    ? await postToInquiry(answer.inquiry, answer.take, answer.durationMs, holdMs)
    : await sendChatAnswer(answer.chatId, answer.take, answer.durationMs, holdMs, answer.asks);
  answer.posting = false;
  answer.message = message;
  if (message && answer.asks) remember(ASKED);
  if (sending !== answer) {
    // Taken back while it was on its way: take this one back too.
    if (message && answer.undone) void tellUndo(answer);
    return;
  }
  if (!message) {
    answer.failed = true;
    changed();
  } else if (answer.waited) {
    sent(answer);
  }
}

/** An answer to a matched Take, held on the matching's route: it has no
 *  chat message of its own until the chat is made, so a kept answer stands
 *  for one here. */
async function postToInquiry(inquiry: string, take: string, durationMs: number, holdMs: number): Promise<ChatMessage | null> {
  const kept = await answerInquiry(inquiry, take, durationMs, holdMs);
  if (!kept) return null;
  return { id: `inquiry-${inquiry}`, mine: true, author: "", kind: "voice", body: "", meta: { answer: true }, created_at: new Date().toISOString() };
}

/** Tell the backend about an Undo; one that came too late shows as sent. */
async function tellUndo(answer: Sending) {
  const result = answer.inquiry
    ? await undoInquiry(answer.inquiry)
    : await undoChatAnswer(answer.chatId, { message: answer.message?.id ?? null, project: answer.project });
  const message = answer.message;
  if (result === "sent" && message) sentListeners.forEach((listener) => listener(answer.chatId, message));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The answer on its way in this chat, if any. */
export function usePendingAnswer(chatId: string): PendingAnswer | null {
  const current = useSyncExternalStore(subscribe, () => shown, () => null);
  if (!current || current.chatId !== chatId) return null;
  return current;
}

/** Tests only. */
export function forgetAnswers(): void {
  if (sending?.timer) clearTimeout(sending.timer);
  current = null;
  sending = null;
  shown = null;
  starting = false;
  listeners.clear();
  sentListeners.clear();
}
