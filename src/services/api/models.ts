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

export type ProfileModelRow = { name: string; badge: string; line: string; actions: string[] };
export type ProfileModels = { title: string; models: ProfileModelRow[] };
export type ModelInvite = { lines: string[]; action: string };

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
  return body && typeof body.summary === "string" ? (body as unknown as ModelPage) : null;
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

export async function getModelInvite(inviteId: string): Promise<ModelInvite | null> {
  const body = await call(`/api/v2/models/invites/${id(inviteId)}`);
  return body && Array.isArray(body.lines) && typeof body.action === "string" ? (body as unknown as ModelInvite) : null;
}
