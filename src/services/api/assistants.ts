import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  A host's own chat, answered by "{name}'s assistant" (backend N578 to       */
/*  N580, N582, N586, N590; `services/assistants.py`, `services/chat_setup.py`).*/
/*  Every route is behind the ring row `chat_builder` (N579 item 2) and        */
/*  answers 404 without it; each read here answers null then, and on any       */
/*  other failure, so every screen that uses it draws nothing.                 */
/* -------------------------------------------------------------------------- */

/** How people answer when the assistant asks something (N579 item 1). */
export type AnswerWith = { tap: boolean; type: boolean; record: boolean };
/** One of the first Take's questions (N579 item 1; Artur's five to start). */
export type RecipeQuestion = { q: string; title?: string; under?: string; answers: string[] };
/** A chat's recipe as the backend keeps it (N578 item 7). Only the
 *  definable parts are ever sent back (`assistants.DEFINABLE`). */
export type Recipe = {
  welcome: string[];
  questions: RecipeQuestion[];
  answer_with: AnswerWith;
  about: string[];
  fit?: Record<string, unknown> | null;
  model?: Record<string, unknown> | null;
};
export type Builder = { assistant: string; recipe: Recipe | null; startingQuestions: RecipeQuestion[] };
/** What someone in a host's chat reads of it (GET /v2/chats/<id>/host). */
export type Host = { assistant: string; about: string[]; questions: RecipeQuestion[]; answerWith: AnswerWith };

/** The parts of a recipe a host may set (backend `assistants.DEFINABLE`). */
const DEFINABLE = ["welcome", "questions", "answer_with", "about", "fit", "model"] as const;

async function call(path: string, init: Parameters<typeof bffFetch>[1]): Promise<Record<string, unknown> | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    const body = result.kind === "response" && result.ok ? result.body : null;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

function questionsOf(value: unknown): RecipeQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const q = raw as Record<string, unknown> | null;
    if (!q || typeof q.q !== "string") return [];
    return [{
      q: q.q,
      ...(typeof q.title === "string" && q.title ? { title: q.title } : {}),
      ...(typeof q.under === "string" && q.under ? { under: q.under } : {}),
      answers: strings(q.answers),
    }];
  });
}

function answerWithOf(value: unknown): AnswerWith {
  const w = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return { tap: w.tap !== false, type: w.type !== false, record: w.record !== false };
}

function recipeOf(value: unknown): Recipe | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  return {
    welcome: strings(r.welcome),
    questions: questionsOf(r.questions),
    answer_with: answerWithOf(r.answer_with),
    about: strings(r.about),
    ...(r.fit && typeof r.fit === "object" ? { fit: r.fit as Record<string, unknown> } : {}),
    ...(r.model && typeof r.model === "object" ? { model: r.model as Record<string, unknown> } : {}),
  };
}

/** The builder's read: my assistant's name, my recipe as kept (or null) and
 *  Artur's five to start from. Null without the ring. */
export async function getBuilder(): Promise<Builder | null> {
  const body = await call("/api/v2/chats/recipe", { method: "GET" });
  if (!body || typeof body.assistant !== "string") return null;
  return { assistant: body.assistant, recipe: recipeOf(body.recipe), startingQuestions: questionsOf(body.starting_questions) };
}

/** What a PUT sends: the definable parts only, never the stamps the backend
 *  adds (`v`, `updated_at`), which it would refuse. */
export function recipeBody(recipe: Recipe): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of DEFINABLE) {
    const value = recipe[key];
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}

/** Keep my recipe. {ok, recipe} once kept; {ok: false, code, error} when
 *  refused (RECIPE_WORDS, RECIPE_INVALID, RECIPE_LOCKED, with the backend's
 *  own sentence why) or on any failure (both null). */
export type Saved = { ok: true; recipe: Recipe } | { ok: false; code: string | null; error: string | null };

export async function saveRecipe(recipe: Recipe): Promise<Saved> {
  try {
    const result = await bffFetch("/api/v2/chats/recipe", { method: "PUT", json: recipeBody(recipe), cache: "no-store" });
    if (result.kind !== "response") return { ok: false, code: null, error: null };
    const body = (result.body && typeof result.body === "object" ? result.body : {}) as Record<string, unknown>;
    const kept = result.ok ? recipeOf(body.recipe) : null;
    if (kept) return { ok: true, recipe: kept };
    return {
      ok: false,
      code: typeof body.code === "string" ? body.code : null,
      error: typeof body.error === "string" && body.error ? body.error : null,
    };
  } catch {
    return { ok: false, code: null, error: null };
  }
}

/** Will's line on what you know is worth, with "Set up my chat" (N586 item
 *  5). True when he wrote it. */
export async function offerChatSetup(): Promise<boolean> {
  const body = await call("/api/v2/chats/recipe/setup/offer", { method: "POST", json: {} });
  return body?.offered === true;
}

/** The setup's first question, or its open one again, in Will's chat. */
export async function beginChatSetup(): Promise<boolean> {
  const body = await call("/api/v2/chats/recipe/setup", { method: "POST", json: {} });
  return body?.started === true;
}

/** A tap, or typed words, under Will's setup question (`to`, its client id).
 *  True once his next lines are written. */
export async function answerChatSetupStep(to: string, answer: { picked: string } | { said: string }): Promise<boolean> {
  const body = await call("/api/v2/chats/recipe/setup/answer", { method: "POST", json: { to, ...answer } });
  return Array.isArray(body?.messages);
}

/** The host's chat as the person in it reads it, or null: no host with a
 *  recipe and the ring, the host themself, or a backend without the route. */
export async function getHost(chatId: string): Promise<Host | null> {
  const body = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/host`, { method: "GET" });
  const host = body?.host as Record<string, unknown> | null | undefined;
  if (!host || typeof host.assistant !== "string" || !host.assistant) return null;
  return { assistant: host.assistant, about: strings(host.about), questions: questionsOf(host.questions), answerWith: answerWithOf(host.answer_with) };
}
