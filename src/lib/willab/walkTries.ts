/* -------------------------------------------------------------------------- */
/*  THE TRIES A PRACTISE ALREADY HAD (founder 2026-10-14, walk first: "An      */
/*  exercise already done plays its tries"). Two sources, both read, never    */
/*  written: the Take's thread in the Lounge (each try as "Practise N" with    */
/*  its voice, then the machine's answer as the next app bubble), and the     */
/*  practice itself as the confidence-practice route serves it (its           */
/*  attempts, and which one it closed on). Pure.                              */
/*                                                                            */
/*  No number, read or score comes out: an answer is "praise" or "again", a   */
/*  try is its voice by its number (AC-9).                                    */
/* -------------------------------------------------------------------------- */

import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ConfidencePractice } from "@/services/api/confidentVoicePractice";
import type { ReplayTries } from "./feedbackWalkModel";
import type { TryOutcome } from "./walkPlan";

type TryAudio = { url: string; durationMs: number | null };

/** The machine's answer a step says: praise ends the loop, the rest ask
 *  again (the thanks after the third try is laid by the plan). */
const ANSWERS: Readonly<Record<string, TryOutcome>> = { improved: "praise", encourage: "again", thanks: "again" };

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

type Laid = { practiceId: string | null; outcomes: Map<number, TryOutcome>; audios: Record<number, TryAudio> };

/** The tries in attempt order, up to the first number without an answer. */
function dense(laid: Laid): ReplayTries | null {
  const outcomes: TryOutcome[] = [];
  for (let n = 1; laid.outcomes.has(n); n += 1) outcomes.push(laid.outcomes.get(n) as TryOutcome);
  if (outcomes.length === 0) return null;
  return { practiceId: laid.practiceId, outcomes, audios: laid.audios };
}

type PendingTry = { practiceId: string | null; attempt: number | null; audio: TryAudio | null; partId: string | null };

/** The step a message is, when it is a walk step of `take`. */
function stepOf(m: LoungeMessage, take: string): { step: string; meta: Record<string, unknown> } | null {
  const meta = m.metadata ?? {};
  if (m.kind !== "walk_step" || meta.take_session_id !== take) return null;
  const step = str(meta.step);
  return step ? { step, meta } : null;
}

/** A "Practise N" bubble: the try waiting for its answer. */
function tryOf(step: string, meta: Record<string, unknown>): PendingTry {
  const clip = meta.clip && typeof meta.clip === "object" ? (meta.clip as Record<string, unknown>) : null;
  const src = str(clip?.src);
  return {
    practiceId: str(clip?.practice_id) ?? str(step.slice("try:".length)),
    attempt: num(meta.attempt),
    audio: src ? { url: src, durationMs: num(clip?.duration_ms) } : null,
    partId: str(meta.part_id),
  };
}

/** The answer laid on its paragraph's tries, with the voice of the try it
 *  answers. */
function layAnswer(byPart: Map<string, Laid>, meta: Record<string, unknown>, outcome: TryOutcome, pending: PendingTry | null): void {
  const partId = str(meta.part_id) ?? pending?.partId ?? null;
  const attempt = num(meta.attempt) ?? pending?.attempt ?? null;
  if (!partId || attempt === null || attempt < 1) return;
  const laid: Laid = byPart.get(partId) ?? { practiceId: null, outcomes: new Map(), audios: {} };
  laid.outcomes.set(attempt, outcome);
  if (pending && (pending.attempt === null || pending.attempt === attempt)) {
    laid.practiceId = laid.practiceId ?? pending.practiceId;
    if (pending.audio) laid.audios[attempt] = pending.audio;
  }
  byPart.set(partId, laid);
}

/** The tries of each practise in `take`'s thread, by the moment's
 *  paragraph. A try is the speaker's "Practise N" bubble (step `try:<id>`,
 *  its clip the voice); its answer is the app's next improved, encourage
 *  or thanks bubble, which names the paragraph (`part_id`) and the try
 *  (`attempt`). */
export function threadTries(messages: readonly LoungeMessage[], take: string): ReadonlyMap<string, ReplayTries> {
  const byPart = new Map<string, Laid>();
  let pending: PendingTry | null = null;
  for (const m of messages) {
    const at = stepOf(m, take);
    if (!at) continue;
    if (at.step.startsWith("try:")) {
      pending = tryOf(at.step, at.meta);
      continue;
    }
    const outcome = ANSWERS[at.step];
    if (!outcome) continue;
    layAnswer(byPart, at.meta, outcome, pending);
    pending = null;
  }
  const out = new Map<string, ReplayTries>();
  for (const [partId, laid] of byPart) {
    const tries = dense(laid);
    if (tries) out.set(partId, tries);
  }
  return out;
}

/** The tries of a practice as its own route serves it: every attempt's
 *  voice, each answered "again" but the one the practice closed on with
 *  praise (`selected_attempt_id`). Null with no attempt. */
export function practiceTries(practice: ConfidencePractice): ReplayTries | null {
  const attempts = [...practice.attempts].sort((a, b) => a.attemptIndex - b.attemptIndex);
  if (attempts.length === 0) return null;
  const outcomes: TryOutcome[] = [];
  const audios: Record<number, TryAudio> = {};
  attempts.forEach((a, i) => {
    const n = i + 1;
    outcomes.push(practice.selectedAttemptId === a.id ? "praise" : "again");
    if (a.audioRef) audios[n] = { url: a.audioRef, durationMs: a.durationMs };
  });
  return { practiceId: practice.id, outcomes, audios };
}
