import { bffFetch } from "@/lib/api/bffFetch";
import type { FirstTakeSlide } from "@/lib/willab/firstTake";

/* The plan (rules: docs/flows/the-plan.md; backend services/plan_flow.py).
   The questions before the first Take, the plan card, its levels and
   the deadline, in the Lounge. Every write puts its rows into the Lounge
   thread; the caller reloads the thread. Ring row "plan" (ring 5, N204):
   the backend answers enabled false for everyone else. */

export type PlanStep =
  | "deadline"
  | "why"
  | "followup"
  /** Will has asked for the plan's own yes and waits for it (N211). */
  | "consent"
  | "stress"
  | "ready"
  | "kickoff"
  | "summary"
  | "done"
  | "how_it_went"
  | "whats_next"
  | "same_event";

export type PlanCall = { starts_at: string; text: string; short: string } | null;

/** The plan's bar wherever it shows (backend `plan.bar`, N564 item 3): the
 *  level's name and its four marks, the done ones filled; which of the
 *  plan's three levels. Never points, a score or a percentage (Never 1). */
export type PlanBarData = {
  level: string;
  level_name: string;
  marks: number;
  of: number;
  level_n: number;
  levels: number;
};

export type Plan = {
  id: string;
  status: "asking" | "active" | "ending" | "ended" | "replaced";
  step: PlanStep;
  /** ISO date: the talk's date, only for someone preparing a talk (backend
   *  N564 item 6); null for everyone else. */
  deadline: string | null;
  /** Is the speaker preparing a talk with a date? */
  talk?: boolean;
  /** "Sat 14 Nov". */
  deadline_short: string | null;
  /** "14 November". */
  deadline_day: string | null;
  /** Twelve: three levels of four Takes (backend N564 item 2). */
  total: number;
  /** Practices done since the plan began. */
  done: number;
  level: string | null;
  level_name: string | null;
  /** The plan's bar: the level's name and its four marks (backend N564
   *  item 3); null before the plan has a level. */
  bar?: PlanBarData | null;
  pace_week: boolean;
  key_line: string | null;
  why_line: string | null;
  /** The key line's recording, for "How you said it". */
  key_answer_id: string | null;
  calls: { kickoff: PlanCall; summary: PlanCall };
  /** Has the plan's first Take been recorded? */
  first_take_done: boolean;
  topic: string | null;
  /** A new event's plan, waiting for the next Take before its questions; or
   *  a new speaker's, after a Take recorded first, until that Take's walk
   *  (backend N262). */
  waiting: boolean;
  /** The speaker is being onboarded: the questions, then a new speaker's plan
   *  until the first Take. The principles wait meanwhile (backend N243). */
  onboarding?: boolean;
  /** The plan's own yes (backend N211): "granted" while its switch is off. */
  consent?: "granted" | "declined" | "unanswered";
  /** The first Take is the onboarding (backend N401, behind the ring row
   *  `first_take`): true while the plan waits for that Take, with its five
   *  slides; the bar's middle is then "Start your first recording". */
  first_take?: boolean;
  first_take_slides?: FirstTakeSlide[] | null;
  /** The speaking way in while Take 1 is processed (backend N572, N573,
   *  N592; `services/way_in.py`), once it has begun; null before. */
  way_in?: WayInView | null;
};

/** The way in as the app draws it (backend `way_in.view`). */
export type WayInView = {
  /** The beat that waits for an answer: "profile", "choice", "talk_date",
   *  "share", "agreement", or null. */
  asking: string | null;
  done: string[];
  chosen: string[] | null;
  talk_date: string | null;
  walk_ready: boolean;
  walk_done: boolean;
  /** "Record Take 2" may be tapped: the walk is done (N592 item 3). */
  record_next: boolean;
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

/** Whether `getPlan` failed to read the plan (it then answers as if off). */
export function planReadFailed(state: PlanState): boolean {
  return state === OFF;
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

/** Will's ask for the plan's own yes: "Yes, ask me" or "Not now" (N211). */
export function answerConsent(yes: boolean): Promise<PlanState | null> {
  return send("/api/v2/plan/consent/answer", { json: { yes } });
}

/** One voice answer: the message, a follow-up, or "How did it go?". */
export function sendPlanAnswer(audio: Blob, durationMs: number): Promise<PlanState | null> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `answer.${ext}`);
  form.append("duration_ms", String(Math.round(durationMs)));
  return send("/api/v2/plan/answer", { body: form });
}

/** The speaking chat, the only one with the way in (backend N590). */
export const SPEAKING_CHAT = "artur";

/** An answer to the way in's open beat: a tap (`picked`), several (the
 *  choice), words (`said`), or a day (`date`, null for "No date yet"). */
export type WayInAnswer = { beat: string; picked?: string | string[]; said?: string; date?: string | null };

/** The way in's one call (backend `POST /v2/plan/way-in`): begins it once
 *  Take 1 is sent, takes an answer, reads the Take when its words are
 *  stored, and writes the beats that are due. Each call is idempotent. */
export async function wayIn(answer?: WayInAnswer): Promise<PlanState | null> {
  try {
    const result = await bffFetch("/api/v2/plan/way-in", {
      method: "POST",
      cache: "no-store",
      timeoutMs: 60_000,
      json: { chat: SPEAKING_CHAT, ...(answer ? { answer } : {}), tz: browserZone() },
    });
    if (result.kind !== "response" || !result.ok) return null;
    const messages = (result.body as { messages?: unknown } | null)?.messages;
    // `wrote`: the call put rows into the thread, which the caller reads again.
    return { ...stateOf(result.body), enabled: true, wrote: Array.isArray(messages) && messages.length > 0 };
  } catch {
    return null;
  }
}

/** A spoken answer in the way in ("Tell me what to change."). */
export function wayInVoice(audio: Blob, beat: string): Promise<PlanState | null> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `answer.${ext}`);
  form.append("chat", SPEAKING_CHAT);
  form.append("beat", beat);
  return send("/api/v2/plan/way-in/voice", { body: form });
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

/** Change the talk's date ("Change your plan", "Edit"); there are no
 *  practice days to change (backend N564). */
export function changePlan(change: { deadline?: string }): Promise<PlanState | null> {
  return send("/api/v2/plan", { method: "PUT", json: { ...change, tz: browserZone() } });
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

/** "How do you feel?" may be asked: always for a speaker without a plan
 *  (backend N215), and with a plan only after its own yes (D5; backend N211,
 *  N217). A plan from before the yes existed reads as granted. */
export function feelingsAllowed(): boolean {
  return lastPlan === null || lastPlan.consent === undefined || lastPlan.consent === "granted";
}

/** Before any Take but a plan's first, "How do you feel?" with a Skip (D4;
 *  backend N151, N178): once the plan's first Take is recorded, and only
 *  after the plan's own yes. */
export function feelingsDue(): boolean {
  return lastPlan !== null && lastPlan.status === "active" && lastPlan.first_take_done && feelingsAllowed();
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
