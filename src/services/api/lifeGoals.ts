import { bffFetch } from "@/lib/api/bffFetch";

/* Life goals (Will learning plan, step 3; backend N172, services/life_goals.py;
   rules: docs/flows/principles.md §1 M). Founder only (ring 6):
   the backend answers enabled false, and 404 to the rest, for anyone else.
   Writes that put rows into the Lounge answer them; the caller reloads. */

export type SpaceKey = "personal" | "career" | "good";
export type HorizonKey = "1y" | "3y" | "10y" | "life";
export type StepKey = "y10" | "y3" | "y1";
export type ChangeableStep = "goal" | "want" | "give" | StepKey | "quarter" | "talk";
/** A clash with another goal (M12): that goal's id, who wins, the words. */
export type Clash = { with: string; wins: string; text: string };
export type ClashOption = { wins: string; emoji: string; label: string };

export type Ladder = {
  goal?: string;
  quotes?: string[];
  want?: string;
  give?: string;
  said?: string;
  horizon?: HorizonKey;
  horizon_by?: string;
  steps?: Partial<Record<StepKey, { text: string; by?: string | null }>>;
  /** ``on``: the quarter's last day once a review set it; ``asked``: the
   *  last day it came back for (M13, N186). Both the server's. */
  quarter?: { text: string; by?: string | null; next?: boolean; on?: string; asked?: string };
  /** Kept by the server, never written by the lens (N185). */
  clashes?: Clash[];
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
  changes: Partial<Record<ChangeableStep | "clash", { on: string; earlier: string | null }>>;
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

/** Before a goal is set (M12): the kept goal it pulls against, the line
 *  that names both and the answers; null when there is none. */
export async function checkClash(
  id: string,
): Promise<{ with: string; line: string; options: ClashOption[] } | null> {
  const body = (await call(`/api/v2/life-goals/${encodeURIComponent(id)}/clash/check`, {
    method: "POST",
    json: {},
  })) as { clash?: { with?: unknown; line?: unknown; options?: unknown } | null } | null;
  const clash = body?.clash;
  if (!clash || typeof clash.with !== "string" || typeof clash.line !== "string" || !Array.isArray(clash.options)) {
    return null;
  }
  return { with: clash.with, line: clash.line, options: clash.options as ClashOption[] };
}

/** Which wins when they clash, kept on both ladders; the goal as it is now. */
export async function answerClash(id: string, other: string, wins: string): Promise<{ text: string; goal: LifeGoal } | null> {
  const body = (await call(`/api/v2/life-goals/${encodeURIComponent(id)}/clash`, {
    method: "POST",
    json: { with: other, wins },
  })) as { text?: unknown; goal?: LifeGoal } | null;
  return typeof body?.text === "string" && body.goal ? { text: body.text, goal: body.goal } : null;
}

export type QuarterOutcome = "got_there" | "moved" | "stalled";

/** The Lounge opened (N186): the quarter's two bubbles when one is due; true
 *  when rows were written, so the caller reloads. */
export async function quarterDue(): Promise<boolean> {
  const body = (await call("/api/v2/life-goals/quarter/due", { method: "POST", json: {} })) as {
    messages?: unknown;
  } | null;
  return Array.isArray(body?.messages) && body.messages.length > 0;
}

/** Start or Not now under "Did it move?"; the rows are in the thread. */
export async function answerQuarterAsk(id: string, choice: "start" | "not_now"): Promise<boolean> {
  return (await call(`/api/v2/life-goals/${encodeURIComponent(id)}/quarter/ask`, { method: "POST", json: { choice } })) !== null;
}

/** Their own # notes from the quarter that say what got in the way too. */
export async function quarterNotes(id: string, inTheWay: string): Promise<{ text: string; on: string }[]> {
  const body = (await call(`/api/v2/life-goals/${encodeURIComponent(id)}/quarter/notes`, {
    method: "POST",
    json: { in_the_way: inTheWay },
  })) as { notes?: unknown } | null;
  return Array.isArray(body?.notes)
    ? body.notes.filter((n): n is { text: string; on: string } => typeof n?.text === "string" && typeof n?.on === "string")
    : [];
}

/** How the quarter went, in words, and the next quarter's step. */
export async function reviewQuarter(
  id: string,
  outcome: QuarterOutcome,
  inTheWay: string | null,
  next: string | null,
): Promise<LifeGoal | null> {
  return (await call(`/api/v2/life-goals/${encodeURIComponent(id)}/quarter`, {
    method: "POST",
    json: { outcome, in_the_way: inTheWay, next },
  })) as LifeGoal | null;
}

/** Change or Not now under a note that sounds like a change (M14); the rows
 *  are in the thread. */
export async function answerNoteChange(id: string, choice: "change" | "not_now"): Promise<boolean> {
  return (await call(`/api/v2/life-goals/${encodeURIComponent(id)}/change`, { method: "POST", json: { choice } })) !== null;
}
