import { bffFetch } from "@/lib/api/bffFetch";
import { clearExperimentContext } from "@/lib/willab/experiments/contextStore";
import { loadPromptFile, PromptFileError } from "@/lib/willab/experiments/promptsYaml";
import promptText from "@/lib/willab/experiments/prompts_v1.yaml?raw";
import { sampleAnalysis, seedInterventions } from "@/lib/willab/experiments/sample";
import type { ExperimentSession, ExperimentTake, Intervention, Prompt, PromptFile, SelfRating } from "@/lib/willab/experiments/types";
import { CONSENT_VERSION } from "@/lib/willab/experiments/types";

/* -------------------------------------------------------------------------- */
/*  Private experiments. One client, mocks on, no production calls.           */
/*                                                                            */
/*  EXPERIMENTS_USE_MOCKS stays on unless NEXT_PUBLIC_EXPERIMENTS_MOCK=0.     */
/*  While it is on, these functions never call fetch. This file has no        */
/*  service-role key and no Supabase secret.                                  */
/*                                                                            */
/*  When the flag is off, calls go to this app's /api/v2/experiments/* BFF,   */
/*  which is not built here. That BFF must proxy to the backend routes below  */
/*  on staging, never production.                                              */
/*                                                                            */
/*  POST   /v2/experiments/sessions            JSON consent, or multipart     */
/*                                         with business_case                 */
/*  POST   /v2/experiments/sessions/:id/takes   multipart audio, prompt_id,    */
/*                                              tag, self_rating               */
/*  POST   /v2/experiments/analyze-take         { take_id }                    */
/*  GET|POST /v2/experiments/prompts                                           */
/*  PUT|DELETE /v2/experiments/prompts/:id                                     */
/*  POST   /v2/experiments/prompts/import                                      */
/*  GET|POST /v2/experiments/interventions                                     */
/*  PUT|DELETE /v2/experiments/interventions/:id   { grid, threshold, rule }   */
/*  GET /v2/experiments/export?format=csv|json&audience=self|researcher        */
/*  DELETE /v2/experiments/me                                                  */
/* -------------------------------------------------------------------------- */

export const EXPERIMENTS_USE_MOCKS = process.env.NEXT_PUBLIC_EXPERIMENTS_MOCK !== "0";

const VOLUNTEER_KEY = "wlp-experiment-volunteer";
let memoryVolunteer: string | null = null;
const BUNDLED = loadPromptFile(promptText);

type Store = {
  file: PromptFile;
  sessions: ExperimentSession[];
  takes: ExperimentTake[];
  interventions: Intervention[];
  researcher: boolean;
  seq: number;
};

let store: Store = fresh();
let version = 0;
const listeners = new Set<() => void>();

function fresh(): Store {
  return {
    file: BUNDLED,
    sessions: [],
    takes: [],
    interventions: seedInterventions(BUNDLED),
    researcher: false,
    seq: 1,
  };
}

function touch(): void {
  version += 1;
  listeners.forEach((fn) => fn());
}

export function experimentVersion(): number {
  return version;
}

export function subscribeExperiments(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function resetExperimentStore(): void {
  store = fresh();
  memoryVolunteer = null;
  clearExperimentContext();
  try {
    sessionStorage.removeItem(VOLUNTEER_KEY);
  } catch {
    /* no window in a plain node test */
  }
  touch();
}

export function promptSchema(): PromptFile {
  return store.file;
}

export function peekVolunteerId(): string | null {
  try {
    return sessionStorage.getItem(VOLUNTEER_KEY) ?? memoryVolunteer;
  } catch {
    return memoryVolunteer;
  }
}

export function anonymousVolunteerId(): string {
  const existing = peekVolunteerId();
  if (existing) return existing;
  const id = `vol_${Math.random().toString(36).slice(2, 10)}`;
  memoryVolunteer = id;
  try {
    sessionStorage.setItem(VOLUNTEER_KEY, id);
  } catch {
    /* the id stays in memory for this tab */
  }
  return id;
}

export function readInterventions(): Intervention[] {
  return store.interventions;
}

export function readTakes(): ExperimentTake[] {
  const id = peekVolunteerId();
  if (!id) return [];
  return store.takes.filter((take) => take.volunteer_id === id);
}

function nextId(prefix: string): string {
  const id = `${prefix}_${store.seq}`;
  store.seq += 1;
  return id;
}

export async function openSession(input: { businessCaseName?: string | null; researcher?: boolean; sessionId?: string } = {}): Promise<ExperimentSession | null> {
  const researcher = input.researcher === true;
  const consent = { participant: true, researcher, version: CONSENT_VERSION };
  if (!EXPERIMENTS_USE_MOCKS) {
    const body = await live("POST", "/api/v2/experiments/sessions", { consent });
    return body && typeof body === "object" ? (body as ExperimentSession) : null;
  }
  const volunteer_id = anonymousVolunteerId();
  if (researcher) store.researcher = true;
  const found = store.sessions.find((session) => session.id === input.sessionId && session.volunteer_id === volunteer_id);
  if (found) {
    if (input.businessCaseName) found.business_case = { name: input.businessCaseName, content_type: "application/octet-stream" };
    found.consent = { ...found.consent, researcher: found.consent.researcher || researcher };
    touch();
    return found;
  }
  const session: ExperimentSession = {
    id: nextId("ses"),
    volunteer_id,
    consent,
    business_case: input.businessCaseName ? { name: input.businessCaseName, content_type: "application/octet-stream" } : null,
    created_at: new Date().toISOString(),
  };
  store.sessions.push(session);
  touch();
  return session;
}

export async function saveTake(input: { sessionId: string; prompt: Prompt; selfRating: SelfRating; audioName?: string | null }): Promise<ExperimentTake | null> {
  if (!EXPERIMENTS_USE_MOCKS) return liveTake(input);
  const session = store.sessions.find((item) => item.id === input.sessionId);
  if (!session || session.volunteer_id !== anonymousVolunteerId()) return null;
  const id = nextId("take");
  const take: ExperimentTake = {
    id,
    session_id: session.id,
    volunteer_id: session.volunteer_id,
    prompt_id: input.prompt.id,
    tag: input.prompt.tag,
    reference: input.prompt.reference ?? null,
    self_rating: input.selfRating,
    audio_name: input.audioName ?? null,
    transcript: "",
    analysis: sampleAnalysis(id, store.file),
  };
  store.takes.push(take);
  touch();
  return take;
}

export async function analyzeTake(takeId: string): Promise<ExperimentTake["analysis"] | null> {
  if (!EXPERIMENTS_USE_MOCKS) {
    const body = await live("POST", "/api/v2/experiments/analyze-take", { take_id: takeId });
    return body && typeof body === "object" ? (body as ExperimentTake["analysis"]) : null;
  }
  return store.takes.find((take) => take.id === takeId && take.volunteer_id === anonymousVolunteerId())?.analysis ?? null;
}

export async function savePrompt(prompt: Prompt): Promise<PromptFile | null> {
  if (!EXPERIMENTS_USE_MOCKS) {
    const exists = store.file.prompts.some((item) => item.id === prompt.id);
    const path = exists ? `/api/v2/experiments/prompts/${encodeURIComponent(prompt.id)}` : "/api/v2/experiments/prompts";
    await live(exists ? "PUT" : "POST", path, prompt);
    return null;
  }
  const prompts = store.file.prompts.some((item) => item.id === prompt.id)
    ? store.file.prompts.map((item) => (item.id === prompt.id ? prompt : item))
    : [...store.file.prompts, prompt];
  return replaceFile({ ...store.file, prompts });
}

export async function deletePrompt(id: string): Promise<PromptFile | null> {
  if (!EXPERIMENTS_USE_MOCKS) {
    await live("DELETE", `/api/v2/experiments/prompts/${encodeURIComponent(id)}`);
    return null;
  }
  return replaceFile({ ...store.file, prompts: store.file.prompts.filter((item) => item.id !== id) });
}

export async function saveIntervention(item: Intervention): Promise<Intervention | null> {
  const body = { grid: item.grid, threshold: item.threshold, rule: item.rule };
  if (!EXPERIMENTS_USE_MOCKS) {
    await live("PUT", `/api/v2/experiments/interventions/${encodeURIComponent(item.id)}`, body);
    return null;
  }
  store.interventions = store.interventions.map((current) => (current.id === item.id ? item : current));
  touch();
  return item;
}

export async function importPrompts(): Promise<PromptFile | null> {
  if (!EXPERIMENTS_USE_MOCKS) {
    await live("POST", "/api/v2/experiments/prompts/import", {});
    return null;
  }
  return replaceFile({ ...store.file, prompts: BUNDLED.prompts.map((prompt) => ({ ...prompt })) });
}

export type ExportResult = { ok: true; filename: string; mime: string; body: string } | { ok: false; reason: "consent" };

export async function exportMine(format: "csv" | "json", audience: "self" | "researcher"): Promise<ExportResult> {
  if (audience === "researcher" && !consented()) return { ok: false, reason: "consent" };
  if (!EXPERIMENTS_USE_MOCKS) {
    const body = await live("GET", `/api/v2/experiments/export?format=${format}&audience=${audience}`);
    if (!body || typeof body !== "object") return { ok: false, reason: "consent" };
    return body as ExportResult;
  }
  const volunteer_id = anonymousVolunteerId();
  const takes = store.takes.filter((take) => take.volunteer_id === volunteer_id);
  const body = format === "json" ? jsonExport(volunteer_id, audience, takes) : csvExport(volunteer_id, audience, takes);
  const mime = format === "json" ? "application/json" : "text/csv";
  return { ok: true, filename: `my-sessions.${format}`, mime, body };
}

export async function deleteMine(): Promise<boolean> {
  if (!EXPERIMENTS_USE_MOCKS) {
    const body = await live("DELETE", "/api/v2/experiments/me");
    return Boolean(body);
  }
  const volunteer_id = anonymousVolunteerId();
  store.sessions = store.sessions.filter((session) => session.volunteer_id !== volunteer_id);
  store.takes = store.takes.filter((take) => take.volunteer_id !== volunteer_id);
  store.researcher = false;
  clearExperimentContext();
  memoryVolunteer = null;
  try {
    sessionStorage.removeItem(VOLUNTEER_KEY);
  } catch {
    /* already gone */
  }
  touch();
  return true;
}

export function downloadExport(result: Extract<ExportResult, { ok: true }>): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([result.body], { type: result.mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = result.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function consented(): boolean {
  return store.researcher;
}

function replaceFile(next: PromptFile): PromptFile | null {
  try {
    loadPromptFile(dumpPromptFile(next));
  } catch (err) {
    if (err instanceof PromptFileError) return null;
    throw err;
  }
  store.file = next;
  touch();
  return next;
}

function dumpPromptFile(file: PromptFile): string {
  const prompts = file.prompts.map((prompt) => {
    const reference = prompt.reference ? `, reference: ${prompt.reference}` : "";
    return `  - {id: ${prompt.id}, tag: ${prompt.tag}, text: ${JSON.stringify(prompt.text)}${reference}}`;
  });
  return [
    `version: ${file.version}`,
    `language: ${file.language}`,
    `order: [${file.order.join(", ")}]`,
    `baseline_scored: [${file.baseline_scored.join(", ")}]`,
    `reference_scored: [${file.reference_scored.join(", ")}]`,
    "prompts:",
    ...prompts,
    `self_report: {energy: [${file.self_report.energy.join(", ")}], feeling: [${file.self_report.feeling.join(", ")}]}`,
    "",
  ].join("\n");
}

function jsonExport(volunteer_id: string, audience: "self" | "researcher", takes: ExperimentTake[]): string {
  return JSON.stringify({
    audience,
    volunteer_id,
    takes: takes.map((take) => ({
      session_id: take.session_id,
      take_id: take.id,
      prompt_id: take.prompt_id,
      tag: take.tag,
      reference: take.reference,
      self_rating: take.self_rating,
      audio_name: take.audio_name,
      transcript: take.transcript,
      page: pageName(take.session_id),
      gate: take.analysis.summary.gate,
    })),
  }, null, 2);
}

function csvExport(volunteer_id: string, audience: "self" | "researcher", takes: ExperimentTake[]): string {
  const head = ["audience", "volunteer_id", "session_id", "take_id", "prompt_id", "tag", "reference", "energy", "feeling", "audio", "page", "gate"];
  const lines = takes.map((take) => [
    audience,
    volunteer_id,
    take.session_id,
    take.id,
    take.prompt_id,
    take.tag,
    take.reference ?? "",
    take.self_rating.energy,
    take.self_rating.feeling,
    take.audio_name ?? "",
    pageName(take.session_id),
    take.analysis.summary.gate ?? "",
  ].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\n");
}

function pageName(sessionId: string): string {
  return store.sessions.find((session) => session.id === sessionId)?.business_case?.name ?? "";
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

async function live(method: "GET" | "POST" | "PUT" | "DELETE", path: string, json?: unknown): Promise<unknown> {
  const result = await bffFetch(path, { method, json, auth: "required" });
  return result.kind === "response" && result.ok ? result.body : null;
}

async function liveTake(input: { sessionId: string; prompt: Prompt; selfRating: SelfRating; audioName?: string | null }): Promise<ExperimentTake | null> {
  const form = new FormData();
  form.set("prompt_id", input.prompt.id);
  form.set("tag", input.prompt.tag);
  form.set("self_rating", JSON.stringify(input.selfRating));
  if (input.prompt.reference) form.set("reference", input.prompt.reference);
  if (input.audioName) form.set("audio_name", input.audioName);
  const result = await bffFetch(`/api/v2/experiments/sessions/${encodeURIComponent(input.sessionId)}/takes`, { method: "POST", body: form, auth: "required" });
  return result.kind === "response" && result.ok ? (result.body as ExperimentTake) : null;
}
