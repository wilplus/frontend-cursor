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
export type Host = {
  assistant: string;
  /** What the host's chat is called (backend N642 item 1); null on a backend
   *  without it, where the chat keeps its row's title. */
  name: string | null;
  about: string[];
  questions: RecipeQuestion[];
  answerWith: AnswerWith;
  /** A live v2 recipe's hello and taps ("Something else" added by the
   *  backend); empty for a chat set up before the blank setup (N616 item 4). */
  hello: string;
  taps: string[];
};

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
  // In someone's chat, typing is on only where the read says so (N610): a
  // read with no `type` is a chat that takes no typing.
  const typing = (host.answer_with as { type?: unknown } | null | undefined)?.type === true;
  // A live v2 recipe says what people send; the bar follows it (VIS-02).
  const send = Array.isArray(host.send) ? strings(host.send) : null;
  return {
    assistant: host.assistant,
    name: typeof host.name === "string" && host.name.trim() ? host.name.trim() : null,
    about: strings(host.about),
    questions: questionsOf(host.questions),
    answerWith: send
      ? { tap: true, type: send.includes("text"), record: send.includes("rec") }
      : { ...answerWithOf(host.answer_with), type: typing },
    hello: typeof host.hello === "string" ? host.hello : "",
    taps: strings(host.taps),
  };
}

/* ── One recording answers everyone who asked (backend N584) ──────────── */

/** How sure a match is (N580 item 3): a colour, never a number. */
export type Mark = "green" | "yellow" | "red";
/** One bundle in Will's queue, one card (N602 item 1), in the backend's
 *  words: its title ("{n} people asked"), the question, the first names of
 *  who asked (their faces), the assistant's note once it has answered them
 *  (null until then), "See who asked", and "Record one answer" while it
 *  waits (null once answered). */
export type Bundle = {
  id: string;
  title: string;
  question: string;
  faces: string[];
  note: string | null;
  see: string | null;
  answered: boolean;
  record: string | null;
};
/** One person in the sheet "Who asked" (N602 item 2). */
export type BundleAsker = { id: string; words: string; mark: Mark | null; name: string | null; chat: string; sent: boolean };
/** The sheet "Who asked": its title and "Split them up", in the backend's words. */
export type BundleWho = { title: string; split: string | null; people: BundleAsker[] };

const MARKS: readonly string[] = ["green", "yellow", "red"];
export const markOf = (value: unknown): Mark | null => (typeof value === "string" && MARKS.includes(value) ? (value as Mark) : null);
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

/** My bundles, or null: no ring or no route (404), or any failure. */
export async function getBundles(): Promise<Bundle[] | null> {
  const body = await call("/api/v2/chats/bundles", { method: "GET" });
  if (!body || !Array.isArray(body.bundles)) return null;
  return body.bundles.flatMap((raw) => {
    const b = raw as Record<string, unknown> | null;
    const title = text(b?.title);
    const question = text(b?.question);
    if (!b || typeof b.id !== "string" || !title || !question) return [];
    return [{
      id: b.id,
      title,
      question,
      faces: Array.isArray(b.faces) ? b.faces.map((f) => (typeof f === "string" ? f : "")) : [],
      note: text(b.note),
      see: text(b.see),
      answered: b.answered === true,
      record: text(b.record),
    }];
  });
}

/** "See who asked ›": the sheet "Who asked", or null (404, any failure). */
export async function getBundleWho(bundleId: string): Promise<BundleWho | null> {
  const body = await call(`/api/v2/chats/bundles/${encodeURIComponent(bundleId)}`, { method: "GET" });
  const title = text(body?.title);
  if (!body || !title || !Array.isArray(body.people)) return null;
  const people = body.people.flatMap((raw) => {
    const x = raw as Record<string, unknown> | null;
    if (!x || typeof x.id !== "string" || typeof x.words !== "string") return [];
    return [{ id: x.id, words: x.words, mark: markOf(x.mark), name: text(x.name), chat: String(x.chat ?? ""), sent: x.sent === true }];
  });
  return { title, split: text(body.split), people };
}

/** "Split them up": the picked questions into a bundle of their own; the
 *  new bundle's id, or null when refused. */
export async function splitBundle(bundleId: string, questions: string[]): Promise<string | null> {
  const body = await call(`/api/v2/chats/bundles/${encodeURIComponent(bundleId)}/split`, { method: "POST", json: { questions } });
  return typeof body?.bundle === "string" ? body.bundle : null;
}

/** The host's one recording to everyone in the bundle; how many it reached,
 *  or null when refused. */
export async function answerBundle(bundleId: string, take: string, durationMs: number): Promise<number | null> {
  const body = await call(`/api/v2/chats/bundles/${encodeURIComponent(bundleId)}/answer`, {
    method: "POST",
    json: { take, duration_ms: Math.round(durationMs) },
  });
  return typeof body?.sent === "number" ? body.sent : null;
}

/* ── One Take, its answers in one place (backend N587, N588 item 4) ───── */

/** One answer to my Take: who answered, in which chat, under which heading
 *  ("On your speaking" or "On the matter", the backend's), and whether it
 *  is my coach's (the chat the Take was first sent in). */
export type TakeAnswer = { messageId: string; chat: string; coach: boolean; name: string | null; title: string };
export type TakeAnswers = { shown: TakeAnswer[]; faces: string[]; groups: { title: string; answers: TakeAnswer[] }[] };

function takeAnswerOf(raw: unknown): TakeAnswer[] {
  const a = raw as Record<string, unknown> | null;
  if (!a || typeof a.message_id !== "string" || typeof a.chat !== "string" || typeof a.title !== "string") return [];
  return [{ messageId: a.message_id, chat: a.chat, coach: a.coach === true, name: typeof a.name === "string" && a.name ? a.name : null, title: a.title }];
}

/** The answers gathered under my Take, or null: no ring, a Take sent
 *  nowhere (404), or any failure. */
export async function getTakeAnswers(takeSessionId: string): Promise<TakeAnswers | null> {
  const body = await call(`/api/v2/user/takes/${encodeURIComponent(takeSessionId)}/answers`, { method: "GET" });
  const bubble = body?.bubble as Record<string, unknown> | undefined;
  if (!body || !bubble || !Array.isArray(body.groups)) return null;
  return {
    shown: Array.isArray(bubble.shown) ? bubble.shown.flatMap(takeAnswerOf) : [],
    faces: strings(bubble.faces),
    groups: body.groups.flatMap((raw) => {
      const g = raw as Record<string, unknown> | null;
      if (!g || typeof g.title !== "string") return [];
      const answers = Array.isArray(g.answers) ? g.answers.flatMap(takeAnswerOf) : [];
      return answers.length ? [{ title: g.title, answers }] : [];
    }),
  };
}
