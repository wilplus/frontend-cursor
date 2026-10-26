import { bffFetch } from "@/lib/api/bffFetch";

/* Life goals (Will learning plan, step 3; backend N172, services/life_goals.py;
   rules: docs/flows/feedback-walk-and-chat.md §1 M). Founder only (ring 6):
   the backend answers enabled false, and 404 to the rest, for anyone else.
   Writes that put rows into the Lounge answer them; the caller reloads. */

export type SpaceKey = "personal" | "career" | "good";
export type HorizonKey = "1y" | "3y" | "10y" | "life";
export type StepKey = "y10" | "y3" | "y1";
export type ChangeableStep = "goal" | "want" | "give" | StepKey | "quarter" | "talk";

export type Ladder = {
  goal?: string;
  quotes?: string[];
  want?: string;
  give?: string;
  said?: string;
  horizon?: HorizonKey;
  horizon_by?: string;
  steps?: Partial<Record<StepKey, { text: string; by?: string | null }>>;
  quarter?: { text: string; by?: string | null; next?: boolean };
  answers?: { want_most?: string; fulfil?: string; nature?: string; under?: string };
  /** The lens's own record of the questions already answered, so it reopens
   *  where it stopped. */
  progress?: string;
};

export type LifeGoal = {
  id: string;
  space: SpaceKey;
  status: "draft" | "active" | "replaced" | "dropped";
  ladder: Ladder;
  /** The newest change of each step: its date and the words before it. */
  changes: Partial<Record<ChangeableStep, { on: string; earlier: string | null }>>;
  /** The talk goal (the setup answer), on the career goal. */
  talk?: string;
};

export type LifeGoalsState = { enabled: boolean; goals: LifeGoal[]; draft: LifeGoal | null };

const OFF: LifeGoalsState = { enabled: false, goals: [], draft: null };

async function call(path: string, init: Parameters<typeof bffFetch>[1]): Promise<unknown | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    return result.kind === "response" && result.ok ? (result.body ?? {}) : null;
  } catch {
    return null;
  }
}

export async function getLifeGoals(): Promise<LifeGoalsState> {
  const body = (await call("/api/v2/life-goals", {})) as Partial<LifeGoalsState> | null;
  if (!body || body.enabled !== true) return OFF;
  return { enabled: true, goals: Array.isArray(body.goals) ? body.goals : [], draft: body.draft ?? null };
}

/** Start or Not now under the ask after a note; the rows are in the thread. */
export async function answerLifeGoalsAsk(choice: "start" | "not_now"): Promise<boolean> {
  return (await call("/api/v2/life-goals/ask", { method: "POST", json: { choice } })) !== null;
}

/** A spoken answer's words, or null when none were heard. */
export async function transcribeAnswer(audio: Blob): Promise<string | null> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `answer.${ext}`);
  const body = (await call("/api/v2/life-goals/transcribe", { method: "POST", body: form })) as {
    text?: unknown;
  } | null;
  return typeof body?.text === "string" && body.text.trim() ? body.text : null;
}

export async function draftGoal(
  space: SpaceKey,
  answers: NonNullable<Ladder["answers"]>,
): Promise<{ goal: string; quotes: string[] }> {
  const body = (await call("/api/v2/life-goals/draft", { method: "POST", json: { space, answers } })) as {
    goal?: unknown;
    quotes?: unknown;
  } | null;
  return {
    goal: typeof body?.goal === "string" ? body.goal : "",
    quotes: Array.isArray(body?.quotes) ? body.quotes.filter((q): q is string => typeof q === "string") : [],
  };
}

export async function redraftGoal(space: SpaceKey, goal: string, under: string): Promise<{ goal: string; quote: string }> {
  const body = (await call("/api/v2/life-goals/redraft", { method: "POST", json: { space, goal, under } })) as {
    goal?: unknown;
    quote?: unknown;
  } | null;
  return {
    goal: typeof body?.goal === "string" ? body.goal : "",
    quote: typeof body?.quote === "string" ? body.quote : "",
  };
}

/** The goal as the lens holds it; the saved draft, or null. */
export async function saveDraft(id: string | null, space: SpaceKey, ladder: Ladder): Promise<LifeGoal | null> {
  return (await call("/api/v2/life-goals/drafts", { method: "PUT", json: { id, space, ladder } })) as LifeGoal | null;
}

/** The goal is set; its ladder and "Noted. …" are in the thread. */
export async function finishGoal(
  id: string,
  replaces: string | null,
): Promise<{ body: string; metadata?: Record<string, unknown> | null }[] | null> {
  const body = (await call(`/api/v2/life-goals/${encodeURIComponent(id)}/finish`, {
    method: "POST",
    json: replaces ? { replaces } : {},
  })) as { messages?: unknown } | null;
  return Array.isArray(body?.messages) ? (body.messages as { body: string }[]) : null;
}

export async function changeStep(id: string, step: ChangeableStep, text: string): Promise<LifeGoal | null> {
  return (await call(`/api/v2/life-goals/${encodeURIComponent(id)}/steps`, {
    method: "POST",
    json: { step, text },
  })) as LifeGoal | null;
}
