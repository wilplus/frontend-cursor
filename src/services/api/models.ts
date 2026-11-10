import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  The AI models (the model launchpad; backend N528, N563, N566; the rules   */
/*  and their words in services/model_launchpad.py, the routes in            */
/*  routes/v2/learning_models.py).                                            */
/*                                                                            */
/*  Ring 6, feature `ai_models`: below it every route answers 404, read here  */
/*  as null, and a null keeps every way in hidden (the rows under the people, */
/*  the profile's section, the invite card). Every read and write answers     */
/*  null on any failure; the caller keeps what it has. Every word a screen    */
/*  draws comes in these answers: the screens add none of their own except    */
/*  the few the backend's rules draw for them (modelsCopy.ts).                */
/* -------------------------------------------------------------------------- */

/** A row under the people in the list of chats: "Your queue", "AI models". */
export type ModelsChatRow = { name: string; line: string };

export type DraftRow = { id: string; name: string; badge: string; line: string; actions: string[] };
export type ModelRow = { id: string; name: string; badge: string; started_by: string; line: string; actions: string[] };
export type ModelList = {
  intro: string;
  filters: string[];
  what_do_i_get: string;
  drafts: DraftRow[];
  models: ModelRow[];
  start: string;
  empty?: { title: string; line: string; actions: string[] };
};
/** The three filters, in the order the backend names them. */
export const MODEL_FILTERS = ["for_you", "ready", "learning"] as const;
export type ModelFilter = (typeof MODEL_FILTERS)[number];

export type WhatDoIGet = { title: string; cards: { title: string; line: string }[]; back: string };
export type Door = { title: string; lines: string[]; actions: string[] };

export type Recipe = {
  input?: "voice" | "text" | "image";
  steps?: string[];
  question?: string;
  scale?: string[];
  pick_question?: string;
  options?: string[];
};
export type ModelPage = {
  id: string;
  name: string;
  owner_name: string | null;
  visibility: "public" | "private";
  status: "draft" | "learning" | "ready" | "archived";
  description: string | null;
  field: string | null;
  role: "owner" | "contributor" | "public";
  summary: string;
  percent: number;
  teachers: number;
  actions: string[];
  /** A teacher's and the owner's page only. */
  recipe?: Recipe;
  jars?: Record<string, number>;
  targets?: Record<string, number>;
  own_part?: Record<string, number>;
  /** Its owner's page only (backend model_setup.owner_panel, MOD-37):
   *  "Needs you now", how far with an honest range, the folds. Totals,
   *  never a person (N526 item 3). */
  owner?: OwnerPanel | null;
};

export type SetupChecklist = { title: string; items: { title: string; step: string; done: boolean }[] };
export type OwnerPanel = {
  needs_you: { title: string; line: string; actions: string[]; step: string } | null;
  head: string;
  rows: [string, string][];
  notes: string[];
  folds: { title: string; rows?: [string, string | number][]; lines?: string[]; then?: { title: string; lines: string[] } }[];
  checklist: SetupChecklist | null;
};

/** An example as a teacher's screen receives it: the case and where it is
 *  from, never the machine's read (backend TEACHER_FIELDS, Never 2). */
export type TeachExample = {
  id: string;
  model_id: string;
  kind?: string | null;
  content?: Record<string, unknown> | null;
  private?: boolean;
  source?: string;
};
export type QueueModelRow = { id: string; name: string; line: string; badge: string; waiting: number; paused: boolean; action: string };
export type Queue = {
  header?: string;
  hint?: string;
  actions?: string[];
  empty?: { title: string; line: string; action: string };
  models: QueueModelRow[];
  examples: TeachExample[];
};

/** One teaching step as the backend's rules draw it (teaching_screen). */
export type TeachScreen = {
  model?: string;
  step: "rate" | "pick" | "words";
  title?: string;
  question?: string | null;
  answers: string[];
  example?: Partial<TeachExample>;
  source_note?: string | null;
};
export type Trust = { lines: string[]; actions: string[] };
export type Answered = {
  saved: boolean;
  note: string | null;
  follow: { model_id: string; line: string; screen: TeachScreen }[];
  trust: Trust | null;
};

export type ProfileModelRow = { id?: string; name: string; badge: string; line: string; actions: string[] };
/** `user_id`: whose section it is (backend #1869). */
export type ProfileModels = { title: string; user_id?: string; models: ProfileModelRow[] };
/** `chat_link`: the inviter's own chat, "/c/<token>", where the teacher
 *  teaches (backend N598); null when the inviter has none. */
export type ModelInvite = { lines: string[]; action: string; chat_link?: string | null };

async function call(path: string, init: Parameters<typeof bffFetch>[1] = { method: "GET" }): Promise<Record<string, unknown> | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    const body = result.kind === "response" && result.ok ? result.body : null;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const id = (value: string) => encodeURIComponent(value);

/** The rows under the people; null below the ring (no rows at all). */
export async function getModelsChatRows(): Promise<ModelsChatRow[] | null> {
  const body = await call("/api/v2/models/rows");
  return body && Array.isArray(body.rows) ? (body.rows as ModelsChatRow[]) : null;
}

export async function getModelList(query = "", filter: ModelFilter | null = null): Promise<ModelList | null> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (filter) params.set("filter", filter);
  const qs = params.toString();
  const body = await call(`/api/v2/models${qs ? `?${qs}` : ""}`);
  return body && Array.isArray(body.models) ? (body as unknown as ModelList) : null;
}

export async function getWhatDoIGet(): Promise<WhatDoIGet | null> {
  const body = await call("/api/v2/models/what-do-i-get");
  return body && Array.isArray(body.cards) ? (body as unknown as WhatDoIGet) : null;
}

export async function getDoor(): Promise<Door | null> {
  const body = await call("/api/v2/models/door");
  return body && Array.isArray(body.lines) ? (body as unknown as Door) : null;
}

export async function getModelPage(modelId: string): Promise<ModelPage | null> {
  const body = await call(`/api/v2/models/${id(modelId)}`);
  if (!body || typeof body.summary !== "string") return null;
  const owner = body.owner as Partial<OwnerPanel> | null | undefined;
  const whole = owner && typeof owner.head === "string" && Array.isArray(owner.rows) && Array.isArray(owner.folds) && Array.isArray(owner.notes);
  return { ...(body as unknown as ModelPage), owner: whole ? (owner as OwnerPanel) : null };
}

/** "This is my field": true once the caller teaches the model. */
export async function enterModel(modelId: string): Promise<boolean> {
  const body = await call(`/api/v2/models/${id(modelId)}/enter`, { method: "POST", json: {} });
  return body?.joined === true;
}

export async function getQueue(only: string | null = null): Promise<Queue | null> {
  const body = await call(`/api/v2/models/queue${only ? `?only=${id(only)}` : ""}`);
  return body && Array.isArray(body.models) && Array.isArray(body.examples) ? (body as unknown as Queue) : null;
}

/** Pause or resume a model's examples; the new state, or null. */
export async function pauseModel(modelId: string, paused: boolean): Promise<boolean | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/pause`, { method: "POST", json: { paused } });
  return typeof body?.paused === "boolean" ? body.paused : null;
}

export async function answerExample(
  modelId: string,
  exampleId: string,
  step: TeachScreen["step"],
  answer: string | null,
): Promise<Answered | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/examples/${id(exampleId)}/answer`, {
    method: "POST",
    json: { step, answer },
  });
  return answeredOf(body);
}

function answeredOf(body: Record<string, unknown> | null): Answered | null {
  if (body?.saved !== true) return null;
  return {
    saved: true,
    note: typeof body.note === "string" ? body.note : null,
    follow: Array.isArray(body.follow) ? (body.follow as Answered["follow"]) : [],
    trust: body.trust && typeof body.trust === "object" ? (body.trust as Trust) : null,
  };
}

/** The profile's "AI models"; null when empty, below the ring, or on failure. */
export async function getProfileModels(userId: string): Promise<ProfileModels | null> {
  const body = await call(`/api/v2/models/profile/${id(userId)}`);
  const section = body?.section as ProfileModels | null | undefined;
  return section && Array.isArray(section.models) && section.models.length ? section : null;
}

/** An invite with its id and model, as GET /v2/models/invites lists it. */
export type ListedInvite = ModelInvite & { id: string; model_id: string };

/** The caller's invites, open or put off ("Not now" keeps them; MOD-49);
 *  null below the ring or on failure. */
export async function getModelInvites(): Promise<ListedInvite[] | null> {
  const body = await call("/api/v2/models/invites");
  if (!body || !Array.isArray(body.invites)) return null;
  return (body.invites as ListedInvite[]).filter((i) => typeof i?.id === "string" && Array.isArray(i.lines) && typeof i.action === "string");
}

/** "Not now" (the invite stays) or accept (the caller teaches the model);
 *  the model's id once the backend kept the answer, else null. An accept
 *  also carries the inviter's chat link, where the teacher teaches (backend
 *  N598); null when there is none. */
export async function answerModelInvite(
  inviteId: string,
  accept: boolean,
): Promise<{ model_id: string; chat_link: string | null } | null> {
  const body = await call(`/api/v2/models/invites/${id(inviteId)}/${accept ? "accept" : "not-now"}`, { method: "POST", json: {} });
  if (typeof body?.model_id !== "string") return null;
  const link = body.chat_link;
  return { model_id: body.model_id, chat_link: typeof link === "string" && link.startsWith("/c/") ? link : null };
}

/** "Add an example you know well" (MOD-21): the case in words, typed, read
 *  from a written file, or a recording's transcript. The new example's id
 *  and the backend's note, or null. */
export async function addModelExample(
  modelId: string,
  added: { text: string } | { transcript: string },
): Promise<{ exampleId: string; note: string | null } | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/examples`, { method: "POST", json: added });
  return typeof body?.example_id === "string"
    ? { exampleId: body.example_id, note: typeof body.note === "string" ? body.note : null }
    : null;
}

/** A spoken answer, as its words (MOD-20): the transcript of the recording
 *  made through the recording path, sent to /answer as the "words" step. */
export async function answerSpoken(modelId: string, exampleId: string, transcript: string): Promise<Answered | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/examples/${id(exampleId)}/answer`, {
    method: "POST",
    json: { step: "words", transcript },
  });
  return answeredOf(body);
}

/** The owner's Archive (MOD-50): hides it from every list, deletes nothing. */
export async function archiveModel(modelId: string): Promise<boolean> {
  const body = await call(`/api/v2/models/${id(modelId)}/archive`, { method: "POST", json: {} });
  return body?.status === "archived";
}

/** "Make public", only after its disclaimer: {confirm: true} (MOD-50). */
export async function makeModelPublic(modelId: string): Promise<boolean> {
  const body = await call(`/api/v2/models/${id(modelId)}/make-public`, { method: "POST", json: { confirm: true } });
  return body?.visibility === "public";
}

export async function getModelInvite(inviteId: string): Promise<ModelInvite | null> {
  const body = await call(`/api/v2/models/invites/${id(inviteId)}`);
  return body && Array.isArray(body.lines) && typeof body.action === "string" ? (body as unknown as ModelInvite) : null;
}

/* -------------------------------------------------------------------------- */
/*  A model's API and its money (backend N528 items 6, 7 and 12, N531, N566   */
/*  items 8 to 10, N577, N583; the rules and their words in                   */
/*  services/model_api.py, the routes in routes/v2/model_api.py). Prices are  */
/*  tokens, drawn by the backend ("300 tokens"); the screens never count.     */
/*  Each read answers null on a 404 (below the ring, or before the backend    */
/*  has the routes), and a null hides the way in.                             */
/* -------------------------------------------------------------------------- */

export type LabelRow = { label: string; value: string };
export type ModelCard = {
  title: string;
  line: string;
  description: string;
  rows: LabelRow[];
  foot: string;
  /** ["Use it in your business", "Try it"]. */
  actions: string[];
  for_sale: boolean;
};
export type TryReply = { sub: string; text: string; sure: boolean; mark?: string };
export type LimitOption = { units: number; label: string; line: string };
export type ModelTerms = {
  title: string;
  /** A person who may not create a key reads why, and nothing else. */
  refused?: string;
  lines?: string[];
  price_units?: number;
  price?: string;
  price_line?: string;
  test_key?: { label: string; line: string; free_answers: number };
  limit?: { label: string; default_units: number; options: LimitOption[] };
  training?: string;
  /** The model's own owner: "Use Pitch Coach in your own product." (MOD-48). */
  own_product?: string;
  actions: string[];
};
export type ShownKey = { id: string | null; title: string; line: string; key: string; note: string; actions: string[] };
export type ModelCode = {
  title: string;
  line: string;
  tabs: { lang: string; label: string; code: string }[];
  sure: string;
  actions: string[];
};
export type UsageKey = { id: string; kind: "test" | "live"; label: string; version: number };
export type ModelUsage = {
  title: string;
  line: string;
  alerts: { title: string; line: string; action: string }[];
  rows: LabelRow[];
  pays_teachers: string;
  send_unsure: { label: string; line: string; on: boolean };
  keys: UsageKey[];
  version: { title?: string; line: string; action?: string };
  /** ["Back to the list", "Delete this key"]. */
  actions: string[];
};
export type SplitRow = { part: "infra" | "founder" | "teachers"; label: string; line?: string; units: number; amount: string };
export type ModelPrice = {
  title: string;
  intro: string;
  price_units: number;
  price: string;
  unit: string;
  floor_units: number;
  step_units: number;
  minus_enabled: boolean;
  suggestions: { units: number; label: string }[];
  similar: string;
  uses: number;
  uses_line: string;
  month: string;
  split: SplitRow[];
  action: string;
  /** The price buyers pay now; the screen's price may be a preview. */
  saved_units?: number | null;
};
export type ModelEarnings = { title: string; line: string; rows: LabelRow[]; fixed?: string; minimum?: string; actions: string[] };
export type ModelDownload = { title: string; refused?: string; lines?: string[]; actions: string[] };

/** The uses a month the price screen asks about, as the backend clamps them. */
export const PRICE_USES = { min: 1_000, max: 100_000, step: 1_000, start: 10_000 } as const;

const has = (body: Record<string, unknown> | null, key: string) => Boolean(body && key in body);

export async function getModelCard(modelId: string): Promise<ModelCard | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/card`);
  return body && Array.isArray(body.rows) ? (body as unknown as ModelCard) : null;
}

/** "Try it": the model's answer, or its unsure line with its mark. */
export async function tryModel(modelId: string, message: string): Promise<TryReply | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/try`, { method: "POST", json: { message } });
  return body && typeof body.text === "string" ? (body as unknown as TryReply) : null;
}

export async function getModelTerms(modelId: string): Promise<ModelTerms | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/use`);
  return body && typeof body.title === "string" && Array.isArray(body.actions) ? (body as unknown as ModelTerms) : null;
}

/** A test key, shown once (no live key is offered: nothing is charged yet). */
export async function createTestKey(modelId: string, monthlyLimitUnits: number | null): Promise<ShownKey | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/keys`, {
    method: "POST",
    json: { kind: "test", monthly_limit_units: monthlyLimitUnits, allow_training: false },
  });
  return body && typeof body.key === "string" ? (body as unknown as ShownKey) : null;
}

export async function getModelCode(modelId: string): Promise<ModelCode | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/code`);
  return body && Array.isArray(body.tabs) ? (body as unknown as ModelCode) : null;
}

export async function getModelUsage(modelId: string): Promise<ModelUsage | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/usage`);
  return body && Array.isArray(body.keys) && Array.isArray(body.rows) ? (body as unknown as ModelUsage) : null;
}

export async function deleteModelKey(keyId: string): Promise<boolean> {
  const body = await call(`/api/v2/models/keys/${id(keyId)}`, { method: "DELETE" });
  return body?.deleted === true;
}

export async function switchModelKey(keyId: string): Promise<number | null> {
  const body = await call(`/api/v2/models/keys/${id(keyId)}/switch`, { method: "POST", json: {} });
  return typeof body?.version === "number" ? body.version : null;
}

/** "Send the questions it wasn't sure about to its teachers", on or off. */
export async function sendUnsure(keyId: string, on: boolean): Promise<boolean | null> {
  const body = await call(`/api/v2/models/keys/${id(keyId)}/unsure`, { method: "POST", json: { on } });
  return typeof body?.on === "boolean" ? body.on : null;
}

/** The price screen; with `units` it previews that price and its split,
 *  saving nothing (only setModelPrice saves). */
export async function getModelPrice(modelId: string, uses: number = PRICE_USES.start, units?: number): Promise<ModelPrice | null> {
  const proposed = units === undefined ? "" : `&units=${Math.round(units)}`;
  const body = await call(`/api/v2/models/${id(modelId)}/price?uses=${uses}${proposed}`);
  return body && Array.isArray(body.split) ? (body as unknown as ModelPrice) : null;
}

export async function setModelPrice(modelId: string, units: number): Promise<ModelPrice | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/price`, { method: "POST", json: { units } });
  return body && Array.isArray(body.split) ? (body as unknown as ModelPrice) : null;
}

export async function getModelEarnings(): Promise<ModelEarnings | null> {
  const body = await call("/api/v2/models/earnings");
  return body && Array.isArray(body.rows) ? (body as unknown as ModelEarnings) : null;
}

export async function getModelDownload(modelId: string): Promise<ModelDownload | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/download`);
  return body && typeof body.title === "string" && (has(body, "lines") || has(body, "refused")) ? (body as unknown as ModelDownload) : null;
}

/** The data itself: the teachers' own ratings and answers. */
export async function getModelDownloadRows(modelId: string): Promise<{ model: string; rows: Record<string, unknown>[] } | null> {
  const body = await call(`/api/v2/models/${id(modelId)}/download?rows=1`);
  return body && Array.isArray(body.rows) ? (body as unknown as { model: string; rows: Record<string, unknown>[] }) : null;
}
