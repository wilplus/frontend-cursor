import { bffFetch } from "@/lib/api/bffFetch";

/* The plan (rules: docs/flows/the-plan.md; backend services/plan_flow.py).
   The questions before the first Take, the plan card, the practice days and
   the deadline, in the Lounge. Every write puts its rows into the Lounge
   thread; the caller reloads the thread. Ring row "plan" (ring 5, N204):
   the backend answers enabled false for everyone else. */

export type PlanStep =
  | "deadline"
  | "why"
  | "followup"
  | "stress"
  | "ready"
  | "kickoff"
  | "summary"
  | "done"
  | "how_it_went"
  | "whats_next"
  | "same_event";

export type PlanCall = { starts_at: string; text: string; short: string } | null;

export type Plan = {
  id: string;
  status: "asking" | "active" | "ending" | "ended" | "replaced";
  step: PlanStep;
  /** ISO date, the deadline (given or picked). */
  deadline: string | null;
  deadline_given: boolean;
  /** "Sat 14 Nov". */
  deadline_short: string | null;
  /** "14 November". */
  deadline_day: string | null;
  days: number[];
  days_text: string;
  every_day: boolean;
  total: number;
  /** Practices done since the plan began. */
  done: number;
  level: string | null;
  level_name: string | null;
  pace_week: boolean;
  key_line: string | null;
  why_line: string | null;
  /** The key line's recording, for "How you said it". */
  key_answer_id: string | null;
  calls: { kickoff: PlanCall; summary: PlanCall };
  /** Has the plan's first Take been recorded? */
  first_take_done: boolean;
  /** "Wednesday", "tomorrow", or null. */
  next_day: string | null;
  topic: string | null;
  /** A new event's plan, waiting for the next Take before its questions. */
  waiting: boolean;
};

export type PlanState = { enabled: boolean; plan: Plan | null; wrote: boolean };

const OFF: PlanState = { enabled: false, plan: null, wrote: false };

export function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function zoneQuery(extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  const tz = browserZone();
  if (tz) params.set("tz", tz);
  const q = params.toString();
  return q ? `?${q}` : "";
}

function stateOf(body: unknown): PlanState {
  const b = (body ?? {}) as Partial<PlanState>;
  return {
    enabled: b.enabled === true,
    plan: b.plan && typeof b.plan === "object" ? (b.plan as Plan) : null,
    wrote: b.wrote === true,
  };
}

/** The plan as it stands. On the first call it may begin the questions, or
 *  write a practice day's hello; ``wrote`` says the thread changed. */
export async function getPlan(): Promise<PlanState> {
  try {
    const result = await bffFetch(`/api/v2/plan${zoneQuery()}`, { cache: "no-store" });
    if (result.kind !== "response" || !result.ok) return OFF;
    return stateOf(result.body);
  } catch {
    return OFF;
  }
}

async function send(path: string, init: { method?: "POST" | "PUT"; json?: unknown; body?: BodyInit }): Promise<PlanState | null> {
  try {
    const result = await bffFetch(path, { method: init.method ?? "POST", cache: "no-store", timeoutMs: 60_000, ...init });
    if (result.kind !== "response" || !result.ok) return null;
    return { ...stateOf(result.body), enabled: true, wrote: true };
  } catch {
    return null;
  }
}

/** "Pick a date" (an ISO date) or "No date yet" (null). */
export function answerDeadline(date: string | null): Promise<PlanState | null> {
  return send("/api/v2/plan/deadline", { json: { date, tz: browserZone() } });
}

/** One voice answer: the message, a follow-up, or "How did it go?". */
export function sendPlanAnswer(audio: Blob, durationMs: number): Promise<PlanState | null> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `answer.${ext}`);
  form.append("duration_ms", String(Math.round(durationMs)));
  return send("/api/v2/plan/answer", { body: form });
}

/** A tap on the 1 to 10 scale; never shown back (N178). */
export function sendRating(value: number): Promise<PlanState | null> {
  return send("/api/v2/plan/rating", { json: { value } });
}

export type CallWhich = "kickoff" | "summary";

/** The open times for a call, as ISO strings. */
export async function callSlots(which: CallWhich, from: string, to: string): Promise<string[]> {
  try {
    const result = await bffFetch(`/api/v2/plan/slots${zoneQuery({ which, from, to })}`, { cache: "no-store" });
    if (result.kind !== "response" || !result.ok) return [];
    const slots = (result.body as { slots?: unknown } | null)?.slots;
    return Array.isArray(slots) ? slots.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export type CallResult = { state: PlanState; checkout: { url?: string; client_secret?: string } | null };

/** Book a call at ``start``, or Skip it (null). A paid call may come back
 *  with a checkout to finish, as the booking page does. */
export async function bookCall(which: CallWhich, start: string | null): Promise<CallResult | null> {
  try {
    const result = await bffFetch("/api/v2/plan/call", {
      method: "POST",
      cache: "no-store",
      timeoutMs: 60_000,
      json: { which, start, tz: browserZone() },
    });
    if (result.kind !== "response" || !result.ok) return null;
    const body = (result.body ?? {}) as { checkout?: CallResult["checkout"] };
    return { state: { ...stateOf(result.body), enabled: true, wrote: true }, checkout: body.checkout ?? null };
  } catch {
    return null;
  }
}

/** Change the deadline or the practice days ("Change your plan", "Edit"). */
export function changePlan(change: { deadline?: string; days?: number[] }): Promise<PlanState | null> {
  return send("/api/v2/plan", { method: "PUT", json: { ...change, tz: browserZone() } });
}

export function askCoach(): Promise<PlanState | null> {
  return send("/api/v2/plan/ask-coach", { json: {} });
}

/** "I have a new event" or "Keep practising". */
export function nextPlan(choice: "new_event" | "keep_practising"): Promise<PlanState | null> {
  return send("/api/v2/plan/next", { json: { choice, tz: browserZone() } });
}

/** "I have a new event" in Change your plan: the questions come after the
 *  next Take (N178). */
export function startNewEvent(): Promise<PlanState | null> {
  return send("/api/v2/plan/new-event", { json: { tz: browserZone() } });
}

/* The plan as last read, for the screens outside the Lounge: the recording
   screens ask whether "How do you feel?" comes before this Take (D4). */
let lastPlan: Plan | null = null;

export function rememberPlan(plan: Plan | null): void {
  lastPlan = plan;
}

/** Before any Take but a plan's first, "How do you feel?" with a Skip (D4;
 *  backend N151, N178): once the plan's first Take is recorded. */
export function feelingsDue(): boolean {
  return lastPlan !== null && lastPlan.status === "active" && lastPlan.first_take_done;
}

/** "Is this for {date}?" on a new project (H2): Yes keeps the plan; No
 *  starts the questions for a new one. */
export function sameEvent(yes: boolean): Promise<PlanState | null> {
  return send("/api/v2/plan/same-event", { json: { yes, tz: browserZone() } });
}

/** The URL that plays a voice answer (the key line's "How you said it"). */
export function answerAudioUrl(answerId: string): string {
  return `/api/v2/plan/answers/${encodeURIComponent(answerId)}/audio`;
}
