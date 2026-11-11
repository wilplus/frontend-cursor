import { bffFetch } from "@/lib/api/bffFetch";
import type { TeachScreen } from "@/services/api/models";

/* -------------------------------------------------------------------------- */
/*  Starting a model (backend N528 item 4, N566 items 2 to 6, N570, N571,     */
/*  N582, N585; the rules and their words in services/model_setup.py, the     */
/*  routes in routes/v2/model_setup.py).                                      */
/*                                                                            */
/*  Ring 6, feature `ai_models`, as for the list (models.ts): below it every   */
/*  route answers 404, read here as null, and "Start your own" stays hidden.   */
/*  A draft is 404 to anyone but its owner. Every word a setup screen draws    */
/*  comes in `screen`: the screens add none of their own.                      */
/* -------------------------------------------------------------------------- */

export const SETUP_STEPS = [
  "problem", "today", "teach", "kind", "scale", "question", "ai", "rules", "data", "columns", "check",
  "exam", "journey", "first10", "share", "public", "invite", "ready",
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export type SetupChoice = {
  key: string;
  title: string;
  line: string;
  check?: boolean;
  on?: boolean;
  faded?: boolean;
  tag?: string;
  role?: string;
};

/** One step as the owner's screen shows it (model_setup.step_screen). */
export type SetupScreen = {
  step: SetupStep;
  chapter: "Describe" | "Shape" | "Share";
  chapters: { name: string; on: boolean }[];
  /** "Describe · 1 of 3". */
  caption: string;
  /** "Optional" on an optional step. */
  optional: string | null;
  /** The thin bar, 0 to 100: where the owner is in the setup, not a score. */
  bar: number;
  lines: string[];
  notes: string[];
  choices: SetupChoice[];
  fields: Record<string, unknown>;
  actions: string[];
  /** "A model like yours already exists", over the third answer. */
  sheet?: { title: string; card: { id: string; name: string; badge: string; started_by: string; line: string }; line: string; actions: string[] };
  others?: { title: string; choices: SetupChoice[] };
  strictness?: { title: string; choices: SetupChoice[] };
  table?: [string, string][];
  hist?: { point: number; n: number }[];
  after?: string[];
  teaching?: TeachScreen;
  checklist?: { title: string; items: { title: string; step: SetupStep; done: boolean }[] } | null;
  locked?: { title: string; lines: string[] };
  /** The invite step: the owner's own chat link, "/c/<token>", which
   *  "Copy an invite link" copies (backend N598); null when they have none
   *  yet, and GET /v2/chats/link makes it. */
  chat_link?: string | null;
};

export type SetupState = { model_id: string; status: "draft" | "learning" | "ready" | "archived"; screen: SetupScreen };
/** A step the backend refused, with its reason in words. */
export type SetupRefusal = { refused: string };

const id = (value: string) => encodeURIComponent(value);

/** Refusals of this app's own relay, not the backend's words. */
const PLUMBING = new Set(["INVALID_MULTIPART", "BAD_REQUEST", "BACKEND_UNAVAILABLE", "UPSTREAM_TIMEOUT", "UNAUTHENTICATED"]);

function stateOf(body: unknown): SetupState | null {
  const raw = body as Partial<SetupState> | null;
  return raw && typeof raw.model_id === "string" && raw.screen && typeof raw.screen.step === "string"
    ? (raw as SetupState)
    : null;
}

async function call(path: string, init: Parameters<typeof bffFetch>[1]): Promise<SetupState | SetupRefusal | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    if (result.kind !== "response") return null;
    if (result.ok) return stateOf(result.body);
    const body = result.body as { error?: unknown; code?: unknown } | null;
    // The backend's own reason in words; never this app's plumbing (a request
    // the relay could not read), which says nothing to the owner.
    if (typeof body?.code === "string" && PLUMBING.has(body.code)) return null;
    return result.status === 400 && typeof body?.error === "string" ? { refused: body.error } : null;
  } catch {
    return null;
  }
}

async function read(path: string, init: Parameters<typeof bffFetch>[1] = { method: "GET" }): Promise<SetupState | null> {
  const out = await call(path, init);
  return out && "screen" in out ? out : null;
}

/** "Start your own": a new draft; null below the ring. */
export async function beginSetup(): Promise<SetupState | null> {
  return read("/api/v2/models/setup", { method: "POST", json: {} });
}

/** A model started from its blocks (N636 item 7): its question, its three
 *  answers, what it gives back and what it is built on; then its first 10. */
export async function beginFromBlocks(blocks: { question: string; answers: string[]; gives: string; base: string }): Promise<SetupState | SetupRefusal | null> {
  return call("/api/v2/models/setup/blocks", { method: "POST", json: blocks });
}

/** The draft where it stopped, or one step (a checklist item). */
export async function getSetup(modelId: string, step: SetupStep | null = null): Promise<SetupState | null> {
  return read(`/api/v2/models/${id(modelId)}/setup${step ? `?step=${id(step)}` : ""}`);
}

/** One step's answer: the next step, a refusal in words, or null. */
export async function saveSetupStep(
  modelId: string,
  step: Exclude<SetupStep, "ready">,
  answer: Record<string, unknown>,
): Promise<SetupState | SetupRefusal | null> {
  return call(`/api/v2/models/${id(modelId)}/setup/${id(step)}`, { method: "POST", json: answer });
}

/** "Start with this, finish the rest later", with the scale as it stands. */
export async function startNow(modelId: string, scale?: { t: string; d: string }[]): Promise<SetupState | SetupRefusal | null> {
  return call(`/api/v2/models/${id(modelId)}/setup/start-now`, { method: "POST", json: scale ? { scale } : {} });
}

async function upload(modelId: string, what: "study" | "data", file: File): Promise<SetupState | SetupRefusal | null> {
  const form = new FormData();
  form.append("file", file);
  return call(`/api/v2/models/${id(modelId)}/setup/${what}`, { method: "POST", body: form });
}

/** A study read into starting rules. */
export function uploadStudy(modelId: string, file: File) {
  return upload(modelId, "study", file);
}

/** Existing data read, its columns guessed and checked. */
export function uploadData(modelId: string, file: File) {
  return upload(modelId, "data", file);
}

/** The next of the owner's first 10 (`screen.teaching`), or where they are. */
export async function getFirstTen(modelId: string): Promise<SetupState | null> {
  return read(`/api/v2/models/${id(modelId)}/setup/first-ten`);
}

export async function answerFirstTen(
  modelId: string,
  exampleId: string,
  step: TeachScreen["step"],
  answer: string | null,
): Promise<SetupState | null> {
  return read(`/api/v2/models/${id(modelId)}/setup/first-ten/${id(exampleId)}`, { method: "POST", json: { step, answer } });
}
