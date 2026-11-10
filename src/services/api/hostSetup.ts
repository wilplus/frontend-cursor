import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  A host's blank setup and what a visitor meets in that chat (backend       */
/*  N612, N616 to N618; the recipe v2 contract of backend #1893). Every       */
/*  setup route is behind the ring row `chat_builder` and answers 404         */
/*  without it: each read here is null then, and on any other failure, so    */
/*  nothing of the setup is drawn.                                            */
/* -------------------------------------------------------------------------- */

export type SendKind = "rec" | "text" | "photo" | "file";
export type OutKind = "answer" | "words" | "todo" | "mark";
export type WhoKind = "shadow" | "you" | "assistant";
export type ModelDraft = { q: string; opts: string[]; says: string };
export type RecipeModel = ModelDraft & { own: boolean; model_id?: string; by?: string; price?: number };
export type Suggest = {
  line: string[];
  send: SendKind[];
  out: OutKind[];
  hello: string[];
  qs: string[];
  taps: string[][];
  models: ModelDraft[];
  sample_in: string;
  sample_out: string;
};
export type HostRecipe = {
  spec: string;
  suggest: Suggest;
  line: string;
  send: SendKind[];
  out: OutKind;
  hello: string;
  questions: { q: string }[];
  taps: string[];
  smart: boolean;
  way: "use" | "own";
  models: RecipeModel[];
  who: WhoKind;
  share: boolean;
  price: number;
  cost: { people: number; sends: number };
  live: boolean;
  /** About health, law or money (N622 item 1): only suggestions to the host. */
  care?: boolean;
};
export type SetupPart = { part: string; title: string; value: string };
export type ChatCost = { lines: { q: string; by: string; price: number }[]; per_send: number; month: number; nothing?: boolean };
export type SetupRead = {
  recipe: HostRecipe | null;
  parts: SetupPart[];
  own_chat: OwnChat | null;
  cost: ChatCost | null;
};
/** The host's own chat: its row, the share link (`/c/<token>`), and the line
 *  a newcomer reads before joining ("People come to {name} ..."). */
export type OwnChat = { title: string; line: string; link?: { token: string; path: string } | null; join_line?: string | null };
export type SharedModel = { model_id: string; q: string; opts: string[]; by: string; price: number; fits: boolean; needs: string };
export type ReplyLine = { kind: "answer" | "model"; body: string; by: string };

type Body = Record<string, unknown>;

async function call(path: string, init: Parameters<typeof bffFetch>[1]): Promise<Body | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    const body = result.kind === "response" && result.ok ? result.body : null;
    return body && typeof body === "object" ? (body as Body) : null;
  } catch {
    return null;
  }
}

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const recipeOf = (value: unknown): HostRecipe | null =>
  value && typeof value === "object" && (value as Body).suggest ? (value as HostRecipe) : null;
const costOf = (value: unknown): ChatCost | null => (value && typeof value === "object" ? (value as ChatCost) : null);

export async function readSetup(): Promise<SetupRead | null> {
  const body = await call("/api/v2/chats/setup", { method: "GET" });
  if (!body) return null;
  const own = body.own_chat as SetupRead["own_chat"];
  return {
    recipe: recipeOf(body.recipe),
    parts: list<SetupPart>(body.parts),
    own_chat: own && typeof own.title === "string" ? own : null,
    cost: costOf(body.cost),
  };
}

export async function startSetup(what: string): Promise<HostRecipe | null> {
  const body = await call("/api/v2/chats/setup/start", { method: "POST", json: { what } });
  return recipeOf(body?.recipe);
}

/** One part kept; null when the backend refused it (the screen stays). */
export type Kept = { recipe: HostRecipe; cost: ChatCost | null } | { refused: string };

/** One part kept; {refused} with the backend's code (RECIPE_WORDS for words
 *  its checks refuse), null on any other failure (the screen stays). */
export async function keepPart(part: string, value: unknown): Promise<Kept | null> {
  try {
    const result = await bffFetch(`/api/v2/chats/setup/${encodeURIComponent(part)}`, { cache: "no-store", method: "PUT", json: { value } });
    if (result.kind !== "response") return null;
    const body = (result.body && typeof result.body === "object" ? result.body : {}) as Body;
    if (!result.ok) return typeof body.code === "string" ? { refused: body.code } : null;
    const recipe = recipeOf(body.recipe);
    return recipe ? { recipe, cost: costOf(body.cost) } : null;
  } catch {
    return null;
  }
}

export async function sharedModels(): Promise<SharedModel[]> {
  const body = await call("/api/v2/chats/setup/models", { method: "GET" });
  return list<SharedModel>(body?.models);
}

export async function tryMyChat(text: string): Promise<ReplyLine[] | null> {
  const body = await call("/api/v2/chats/setup/try", { method: "POST", json: { body: text } });
  return body ? list<ReplyLine>(body.messages) : null;
}

/** What the host said to Will about their chat; the parts when it opens them. */
export async function editSaid(said: string): Promise<{ line: string; parts: SetupPart[] } | null> {
  const body = await call("/api/v2/chats/setup/edit", { method: "POST", json: { said } });
  const parts = list<SetupPart>(body?.parts);
  return body && typeof body.line === "string" && parts.length ? { line: body.line, parts } : null;
}

export async function answerUseful(chatId: string, messageId: string, answer: "yes" | "no" | "skip"): Promise<boolean> {
  const body = await call(
    `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/useful`,
    { method: "POST", json: { answer } },
  );
  return body?.ok === true;
}

/* ── The owner's check (backend N616 item 23, LEARN-03) ─────────────────── */

export type CheckItem = {
  example_id: string;
  example: { content?: Record<string, unknown> | null } & Record<string, unknown>;
  guess: string;
  kept: boolean | null;
  answer: string | null;
};
export type ModelCheck = { version: unknown; answers: string[]; items: CheckItem[]; done: boolean };

function checkOf(body: Body | null): ModelCheck | null {
  if (!body || !Array.isArray(body.items)) return null;
  return { version: body.version, answers: list<string>(body.answers), items: list<CheckItem>(body.items), done: body.done === true };
}

export async function getCheck(modelId: string): Promise<ModelCheck | null> {
  return checkOf(await call(`/api/v2/models/${encodeURIComponent(modelId)}/check`, { method: "GET" }));
}

/** Keep the model's guess, or give the right answer instead. */
export async function answerCheck(modelId: string, exampleId: string, answer: string | null): Promise<ModelCheck | null> {
  const json = answer === null ? { example_id: exampleId, keep: true } : { example_id: exampleId, keep: false, answer };
  return checkOf(await call(`/api/v2/models/${encodeURIComponent(modelId)}/check`, { method: "POST", json }));
}

/* ── Drafted answers, one per screen (backend N618 item 9, N629 item 3) ─── */

export type Draft = {
  message_id: string;
  thread_id: string;
  from: string;
  said: string;
  answer: string;
  lines: { body: string; by: string }[];
  sensitive: boolean;
};

export async function getDrafts(): Promise<Draft[] | null> {
  const body = await call("/api/v2/chats/setup/drafts", { method: "GET" });
  return body ? list<Draft>(body.drafts) : null;
}

/** Send one draft: as drafted, or with the host's own words. */
export async function sendDraft(messageId: string, own: string | null): Promise<boolean> {
  const body = await call(`/api/v2/chats/setup/drafts/${encodeURIComponent(messageId)}/send`, {
    method: "POST",
    json: own === null ? {} : { body: own },
  });
  return Boolean(body);
}
