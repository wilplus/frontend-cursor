/* -------------------------------------------------------------------------- */
/*  The coach's side of the plan (backend N213; docs/flows/the-plan.md and     */
/*  docs/flows/coach-panel.md). The plan reaches the queue on its speaker's    */
/*  card (mapMomentsQueue); these open it:                                    */
/*                                                                            */
/*    GET  /api/v2/coach/plans/:id            the plan to answer: blind       */
/*    POST /api/v2/coach/plans/:id/level      the coach's level → What happened */
/*    POST /api/v2/coach/plans/:id/answered   a stuck level's video, shared   */
/*    POST /api/v2/coach/plans/:id/unclear    Audio unclear                    */
/*    GET  /api/v2/coach/plans/:id/answers/:answerId/audio                    */
/*                                                                            */
/*  BLIND COACH: the plan's level is never read before the coach picks; it   */
/*  comes back with the pick. Reads soft-fail to null.                        */
/* -------------------------------------------------------------------------- */

import { coachRead, coachWrite } from "./coachAuth";

export interface PlanVoice {
  answerId: string | null;
  durationMs: number | null;
}

export interface PlanKeyLine extends PlanVoice {
  text: string;
}

export interface PlanLevelOption {
  key: string;
  name: string;
}

/** "Which level comes first?", or a stuck level's video screen. */
export interface CoachPlan {
  planId: string;
  kind: "new" | "asked" | "stuck" | null;
  /** A level to pick: the voice message and the key line, when given. */
  why: PlanVoice | null;
  keyLine: PlanKeyLine | null;
  levels: PlanLevelOption[];
  /** A stuck level: its name, and the Take the coach's video goes on. */
  levelName: string | null;
  takeSessionId: string | null;
}

/** What happened, once the coach has picked. Stress and Ready only when the
 *  speaker gave them (backend N211). */
export interface PlanReveal {
  you: string;
  machine: string | null;
  deadlineShort: string | null;
  stress: number | null;
  ready: number | null;
  keyLine: PlanKeyLine | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function mapVoice(raw: unknown): PlanVoice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return { answerId: str(r.answer_id), durationMs: num(r.duration_ms) };
}

function mapKeyLine(raw: unknown): PlanKeyLine | null {
  const voice = mapVoice(raw);
  const text = voice ? str((raw as Record<string, unknown>).text) : null;
  return voice && text ? { ...voice, text } : null;
}

const KINDS: readonly string[] = ["new", "asked", "stuck"];

export function mapCoachPlan(raw: unknown): CoachPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const planId = str(r.plan_id);
  if (!planId) return null;
  const levels = Array.isArray(r.levels)
    ? r.levels.flatMap((l) => {
        const o = (l ?? {}) as Record<string, unknown>;
        const key = str(o.key);
        const name = str(o.name);
        return key && name ? [{ key, name }] : [];
      })
    : [];
  return {
    planId,
    kind: typeof r.kind === "string" && KINDS.includes(r.kind) ? (r.kind as CoachPlan["kind"]) : null,
    why: mapVoice(r.why),
    keyLine: mapKeyLine(r.key_line),
    levels,
    levelName: str(r.level_name),
    takeSessionId: str(r.take_session_id),
  };
}

export function mapPlanReveal(raw: unknown): PlanReveal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = (v: unknown) => str((v as Record<string, unknown> | null)?.name);
  const you = name(r.you);
  if (!you) return null;
  return {
    you,
    machine: name(r.machine),
    deadlineShort: str(r.deadline_short),
    stress: num(r.stress),
    ready: num(r.ready),
    keyLine: mapKeyLine(r.key_line),
  };
}

const base = (planId: string) => `/api/v2/coach/plans/${encodeURIComponent(planId)}`;

export async function fetchCoachPlan(planId: string): Promise<CoachPlan | null> {
  const res = await coachRead(base(planId));
  return res.ok ? mapCoachPlan(res.data) : null;
}

const failOf = (data: Record<string, unknown> | null, fallback: string) =>
  typeof data?.error === "string" && data.error ? data.error : fallback;

/** The coach's level; What happened comes with it. */
export async function pickPlanLevel(
  planId: string,
  level: string,
): Promise<{ ok: true; reveal: PlanReveal } | { ok: false; message: string | null }> {
  const res = await coachWrite(`${base(planId)}/level`, "POST", { level });
  const reveal = res.ok ? mapPlanReveal(res.data) : null;
  return reveal ? { ok: true, reveal } : { ok: false, message: res.ok ? null : failOf(res.data, "") || null };
}

/** A stuck level's video, already shared as the coach's word: the plan
 *  leaves the queue. True once done. */
export async function markPlanAnswered(planId: string): Promise<boolean> {
  return (await coachWrite(`${base(planId)}/answered`, "POST", {})).ok;
}

/** Audio unclear: the plan leaves this coach's queue. True once done. */
export async function markPlanUnclear(planId: string): Promise<boolean> {
  return (await coachWrite(`${base(planId)}/unclear`, "POST", {})).ok;
}

export function planAudioUrl(planId: string, answerId: string): string {
  return `${base(planId)}/answers/${encodeURIComponent(answerId)}/audio`;
}
