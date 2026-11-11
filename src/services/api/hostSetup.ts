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
/** `learning`: someone's model still learning (N633 item 1): free, it gives
 *  no line, and the host's answers teach it. */
export type RecipeModel = ModelDraft & { own: boolean; model_id?: string; by?: string; price?: number; learning?: boolean; base?: string; gives?: string };
export type Suggest = {
  /** The feedback walk Will suggests (N641): all three steps, an Ideal Text. */
  walk?: { steps: WalkStepId[]; out: "ideal_text" | "none" };
  line: string[];
  /** The chat's names to keep or change (backend N642 item 1, N643 item 1). */
  name?: string[];
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
  /** The chat's name; null until one is kept (the first name stands in). */
  name?: string | null;
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
  /** What the feedback walk holds, in order, and what comes at the end
   *  (N641); `wanted` once the host asked for it. Kept, not run yet. */
  walk?: HostWalk;
};
export type WalkStepId = "best" | "fix" | "words";
export type HostWalk = { steps: WalkStepId[]; out: "ideal_text" | "none"; wanted?: boolean };
export type SetupPart = { part: string; title: string; value: string };
export type ChatCost = { lines: { q: string; by: string; price: number }[]; per_send: number; month: number; nothing?: boolean };
export type SetupRead = {
  recipe: HostRecipe | null;
  parts: SetupPart[];
  own_chat: OwnChat | null;
  cost: ChatCost | null;
  /** Models left out because the host was out of tokens, by day (N630 item 1). */
  skipped_models: SkippedModel[];
  /** What the first Take said the person does, to keep or change on "What
   *  do you do?" (N632 item 2); null when it said nothing. */
  spec_guess: string | null;
  price_changes: PriceChange[];
  /** Something to try in Live (backend #1945): false until "What do you do?". */
  can_try: boolean;
};
export type SkippedModel = { model_id: string; q: string; by: string; on: string };
/** The host's own chat: its row, the share link (`/c/<token>`), and the line
 *  a newcomer reads before joining ("People come to {name} ..."). */
export type OwnChat = {
  title: string;
  line: string;
  link?: { token: string; path: string } | null;
  join_line?: string | null;
  /** The chat as people meet it (backend #1945): who the host is, the hello
   *  and the taps ("Something else" last). */
  about?: string[];
  hello?: string;
  taps?: string[];
  /** Whether the host gave the chat a name (N642 item 1). */
  named?: boolean;
};
export type SharedModel = { model_id: string; q: string; opts: string[]; by: string; price: number; fits: boolean; needs: string; learning?: boolean };
/** Someone's model in the host's chat whose price is no longer the one the
 *  host agreed to (N630 item 3, N633 item 4); `was` 0: it was still learning. */
export type PriceChange = { model_id: string; q: string; by: string; was: number; now: number };
/** `walk`: a walk line of the host's saved walk (backend N647 item 8); in
 *  "Test my chat" it shows as the chat shows it, and nothing is kept. */
export type ReplyLine = { kind: "answer" | "model"; body: string; by: string; walk?: boolean };

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
    skipped_models: list<SkippedModel>(body.skipped_models).filter((m) => m && typeof m.by === "string" && typeof m.on === "string"),
    price_changes: list<PriceChange>(body.price_changes).filter((c) => c && typeof c.model_id === "string" && typeof c.by === "string" && typeof c.now === "number"),
    spec_guess: typeof body.spec_guess === "string" && body.spec_guess.trim() ? body.spec_guess.trim() : null,
    can_try: body.can_try === true,
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

/** "I want this" for the feedback walk (N641 item 3): true once told. */
export async function wantWalk(): Promise<boolean> {
  const body = await call("/api/v2/chats/setup/walk/want", { method: "POST", json: {} });
  return body?.wanted === true;
}

/** The walk, part by part (N647 items 1, 2, 6): what it notices (the host's
 *  own models) and what it says for each, with how each is doing. */
export type WalkNotice = { model_id: string; q: string; ready: boolean; learning: boolean; on: boolean };
export type WalkSay = { model_id: string; q: string; says: string; on: boolean; helped: { a: number; b: number } | null };
export type WalkRead = { runs_on_messages: boolean; notice: WalkNotice[]; say: WalkSay[] };

const walkOf = (body: Body | null): WalkRead | null =>
  body && Array.isArray(body.notice) && Array.isArray(body.say)
    ? { runs_on_messages: body.runs_on_messages === true, notice: body.notice as WalkNotice[], say: body.say as WalkSay[] }
    : null;

export async function readWalk(): Promise<WalkRead | null> {
  return walkOf(await call("/api/v2/chats/setup/walk", { method: "GET" }));
}

/** One item turned on or off, or its words changed; null when refused. */
export async function setWalkItem(modelId: string, change: { on: boolean } | { says: string }): Promise<WalkRead | null> {
  const body = await call(`/api/v2/chats/setup/walk/items/${encodeURIComponent(modelId)}`, { method: "PUT", json: change });
  return walkOf(body) ?? (body ? await readWalk() : null);
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
