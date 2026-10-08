/* -------------------------------------------------------------------------- */
/*  The Speakers button's read (coach panel lock, flow 1 and 3; build plan     */
/*  D-CP-12): GET /api/v2/coach/speakers → every speaker this coach may hear, */
/*  pseudonymous, with their goal, what waits and which Takes are answered.   */
/*  Nothing about any moment arrives here (BLIND COACH); the only numbers are */
/*  counts of moments waiting and of Takes (AC-9).                             */
/* -------------------------------------------------------------------------- */

import type { QueueSpeaker, QueueTake } from "@/lib/willab/coachWalk";

export interface PanelSpeakerTake {
  sessionId: string;
  takeIndex: number | null;
  sentAt: string;
  waiting: number;
  waitingForText: boolean;
  answered: boolean;
}

export interface PanelSpeaker {
  pseudonym: string;
  goal: string | null;
  waiting: number;
  /** How many Takes still wait for their text. */
  waitingForText: number;
  takeCount: number;
  takes: PanelSpeakerTake[];
}

function mapTake(raw: unknown): PanelSpeakerTake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string" || !r.session_id) return null;
  const waiting = typeof r.waiting === "number" ? r.waiting : 0;
  const waitingForText = r.waiting_for_text === true;
  return {
    sessionId: r.session_id,
    takeIndex: typeof r.take_index === "number" ? r.take_index : null,
    sentAt: typeof r.sent_at === "string" ? r.sent_at : "",
    waiting,
    waitingForText,
    answered: typeof r.answered === "boolean" ? r.answered : !waitingForText && waiting === 0,
  };
}

/** The backend's list → speakers, in its order. Anything malformed is
 *  dropped rather than drawn wrong. */
export function mapCoachSpeakers(raw: unknown): PanelSpeaker[] {
  if (!Array.isArray(raw)) return [];
  const out: PanelSpeaker[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const takes = Array.isArray(r.takes)
      ? r.takes.map(mapTake).filter((t): t is PanelSpeakerTake => t !== null)
      : [];
    out.push({
      pseudonym: typeof r.pseudonym === "string" && r.pseudonym ? r.pseudonym : "Anonymous",
      goal: typeof r.goal === "string" && r.goal.trim() ? r.goal.trim() : null,
      waiting: typeof r.waiting === "number" ? r.waiting : takes.reduce((n, t) => n + t.waiting, 0),
      waitingForText:
        typeof r.waiting_for_text === "number"
          ? r.waiting_for_text
          : takes.filter((t) => t.waitingForText).length,
      takeCount: typeof r.take_count === "number" ? r.take_count : takes.length,
      takes,
    });
  }
  return out;
}

/** null on any failure: the list then draws the queue's speakers alone. */
export async function fetchCoachSpeakers(): Promise<PanelSpeaker[] | null> {
  try {
    const res = await fetch("/api/v2/coach/speakers", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return mapCoachSpeakers(await res.json().catch(() => null));
  } catch {
    return null;
  }
}

/** The queue's own speakers as the Speakers list draws them: the fallback
 *  when GET /v2/coach/speakers cannot be read (they are the speakers with
 *  moments waiting, which the queue already holds). Pure. */
export function speakersFromQueue(queue: readonly QueueSpeaker[]): PanelSpeaker[] {
  return queue.map((s) => ({
    pseudonym: s.pseudonym,
    goal: s.goal ?? null,
    waiting: s.waiting,
    waitingForText: s.takes.filter((t) => t.waitingForText).length,
    takeCount: s.takes.length,
    takes: s.takes.map((t) => ({
      sessionId: t.sessionId,
      takeIndex: t.takeIndex,
      sentAt: t.sentAt,
      waiting: t.waiting,
      waitingForText: t.waitingForText,
      answered: !t.waitingForText && t.waiting === 0,
    })),
  }));
}

/** A speaker as the panel walks them: the queue's own entry when they are in
 *  it (their moments are there), else their Takes as counts alone. Pure. */
export function queueSpeakerFor(speaker: PanelSpeaker, queue: readonly QueueSpeaker[]): QueueSpeaker {
  const live = queue.find((s) => s.pseudonym === speaker.pseudonym);
  if (live) return live.goal == null && speaker.goal != null ? { ...live, goal: speaker.goal } : live;
  const takes: QueueTake[] = speaker.takes.map((t) => ({
    sessionId: t.sessionId,
    takeIndex: t.takeIndex,
    sentAt: t.sentAt,
    waiting: t.waiting,
    moments: [],
    waitingForText: t.waitingForText,
  }));
  return { pseudonym: speaker.pseudonym, goal: speaker.goal, waiting: speaker.waiting, takes };
}
