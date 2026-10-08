/* -------------------------------------------------------------------------- */
/*  The coach's walk — the pure half (founder 2026-09-30, A1 to A8; build plan  */
/*  P2-8 to P2-10). The queue's shape, the state words, and where the walk     */
/*  goes next. No fetch, no React, so vitest pins every rule.                  */
/*                                                                            */
/*  BLIND COACH: a moment's kind arrives only once THIS coach has rated it;     */
/*  the backend withholds it and the mapper keeps null for anything absent.    */
/* -------------------------------------------------------------------------- */

import { COACH_WALK_COPY } from "./coachWalkCopy";
import { DEFAULT_DECK } from "./defaultDeck";

export type MomentState = keyof typeof COACH_WALK_COPY.state;
export type MomentKind = keyof typeof COACH_WALK_COPY.kind;
export type AnswerValue = keyof typeof COACH_WALK_COPY.answer;

export interface QueueMoment {
  snippetId: string;
  state: MomentState;
  /** null until this coach has rated the moment. */
  kind: MomentKind | null;
}

export interface QueueTake {
  sessionId: string;
  takeIndex: number | null;
  sentAt: string;
  waiting: number;
  moments: QueueMoment[];
  /** The bookmarks are not frozen yet: the Take is listed, never absent
   *  (founder 2026-10-01, A1). */
  waitingForText: boolean;
}

export interface QueueSpeaker {
  pseudonym: string;
  /** The speaker's goal, as the queue carries it (coach panel lock, flow 3:
   *  "A speaker. Their goal and their Takes"); null when they have none. */
  goal?: string | null;
  waiting: number;
  takes: QueueTake[];
}

const STATES = Object.keys(COACH_WALK_COPY.state) as MomentState[];
const KINDS = Object.keys(COACH_WALK_COPY.kind) as MomentKind[];
const ANSWERS = Object.keys(COACH_WALK_COPY.answer) as AnswerValue[];

function isState(value: unknown): value is MomentState {
  return typeof value === "string" && (STATES as string[]).includes(value);
}

export function isKind(value: unknown): value is MomentKind {
  return typeof value === "string" && (KINDS as string[]).includes(value);
}

export function isAnswer(value: unknown): value is AnswerValue {
  return typeof value === "string" && (ANSWERS as string[]).includes(value);
}

function mapMoment(raw: unknown): QueueMoment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.snippet_id !== "string" || !isState(r.state)) return null;
  return {
    snippetId: r.snippet_id,
    state: r.state,
    kind: isKind(r.kind) ? r.kind : null,
  };
}

function mapTake(raw: unknown): QueueTake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string") return null;
  const moments = Array.isArray(r.moments)
    ? r.moments.map(mapMoment).filter((m): m is QueueMoment => m !== null)
    : [];
  return {
    sessionId: r.session_id,
    takeIndex: typeof r.take_index === "number" ? r.take_index : null,
    sentAt: typeof r.sent_at === "string" ? r.sent_at : "",
    waiting: typeof r.waiting === "number" ? r.waiting : countWaiting(moments),
    moments,
    waitingForText: r.waiting_for_text === true,
  };
}

/** GET /v2/coach/queue/moments → speakers, in the backend's order (oldest
 *  first). Anything malformed is dropped rather than drawn wrong. */
export function mapMomentsQueue(raw: unknown): QueueSpeaker[] {
  if (!Array.isArray(raw)) return [];
  const out: QueueSpeaker[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const takes = Array.isArray(r.takes)
      ? r.takes.map(mapTake).filter((t): t is QueueTake => t !== null)
      : [];
    const goal = typeof r.goal === "string" ? r.goal : typeof r.speaker_goal === "string" ? r.speaker_goal : "";
    out.push({
      pseudonym: typeof r.pseudonym === "string" && r.pseudonym ? r.pseudonym : "Anonymous",
      goal: goal.trim() || null,
      waiting:
        typeof r.waiting === "number"
          ? r.waiting
          : takes.reduce((n, t) => n + t.waiting, 0),
      takes,
    });
  }
  return out;
}

export function countWaiting(moments: QueueMoment[]): number {
  return moments.filter((m) => m.state === "judge_it" || m.state === "answer_it").length;
}

/** The one number the Lounge bubble shows: how many speakers have a moment
 *  waiting on this coach, or a Take still waiting for its text. A count of
 *  people to see, never of quality. */
export function speakersWaiting(queue: QueueSpeaker[]): number {
  return queue.filter((s) => s.waiting > 0 || s.takes.some((t) => t.waitingForText)).length;
}

export function stateWord(state: MomentState): string {
  return COACH_WALK_COPY.state[state];
}

export function kindWord(kind: MomentKind | null): string | null {
  return kind ? COACH_WALK_COPY.kind[kind] : null;
}

export function answerWord(value: AnswerValue | null): string | null {
  return value ? COACH_WALK_COPY.answer[value] : null;
}

/** A moment the coach still has to do something with. */
export function isOpen(state: MomentState): boolean {
  return state === "judge_it" || state === "answer_it";
}

/** The index of the next open moment strictly after `after` (or the first
 *  open one when `after` is null); -1 when the take has none left. */
export function nextOpenIndex(moments: QueueMoment[], after: number | null): number {
  const start = after === null ? 0 : after + 1;
  for (let i = start; i < moments.length; i += 1) {
    if (isOpen(moments[i].state)) return i;
  }
  return -1;
}

/** The moment's state after this coach's own move on it, kept locally until
 *  the queue refreshes: a rating turns Judge it into Judged (the Read screen
 *  learns whether a request is open); Nothing to add and an answer close it. */
export function afterJudged(moment: QueueMoment): QueueMoment {
  return moment.state === "judge_it" ? { ...moment, state: "judged" } : moment;
}

export function afterRequestOpen(moment: QueueMoment, kind: MomentKind): QueueMoment {
  return { ...moment, state: "answer_it", kind };
}

export function afterNothingToAdd(moment: QueueMoment): QueueMoment {
  return { ...moment, state: "nothing_to_add" };
}

export function replaceMoment(moments: QueueMoment[], next: QueueMoment): QueueMoment[] {
  return moments.map((m) => (m.snippetId === next.snippetId ? next : m));
}

/** The slide on the Read screen, as a thumbnail (founder 2026-09-30, B5: the
 *  slide-mapping control is gone; "the slide itself can stay as a thumbnail
 *  on Read"). `pageIndex` is the deck page the speaker had on screen when the
 *  moment began, from the tap timeline; `presentationRef` is the take's PDF,
 *  or null for the default deck. */
export interface ReadSlide {
  presentationRef: string | null;
  pageIndex: number;
}

/** Which picture Read may show for a moment, or null for none. Pure.
 *
 *  Only a picture the speaker actually had: a page of the take's own PDF, or,
 *  for a deckless take, the default deck's slide, recognised by its title
 *  (the default deck is what a deckless speaker clicks through). A deck typed
 *  in by hand has no picture behind it, so it draws nothing rather than the
 *  default deck's artwork. The slide's words are never drawn as a stand-in. */
export function readSlideFor(
  presentationRef: string | null,
  slide: { index: number; title: string } | null,
): ReadSlide | null {
  if (!slide || !Number.isInteger(slide.index) || slide.index < 0) return null;
  if (presentationRef) return { presentationRef, pageIndex: slide.index };
  const mock = DEFAULT_DECK[slide.index];
  if (mock?.artworkSrc && mock.title === slide.title) {
    return { presentationRef: null, pageIndex: slide.index };
  }
  return null;
}
