import { loadPromptFile } from "./promptsYaml";
import promptText from "./prompts_v1.yaml?raw";
import type { AnalyzeStep, AnalyzeTake } from "./types";

/* The voice-model catalog and the host's experiment config.
   The list itself comes from GET /v2/experiments/models.
   Nothing here names a model. */

export const ANALYZE_SCHEMA = "analyze-take/v0.1" as const;
export const LISTEN_QUESTION = "Should your chat listen to how people speak?";
export const CALM_LINE = "First we hear your normal voice";
export const NOT_ON_YET = "Not on yet.";
export const LOCKED_STEP = "Not clear enough yet";
export const LISTENING = "Listening…";
export const RESEARCH_BADGE = "For research and testing only";
export const CALM_MIN = 3;
export const CALM_MAX = 5;

const STEPS: AnalyzeStep[] = ["engagement", "arousal", "valence", "clarity"];

export type VoiceModel = {
  id: string;
  name: string;
  /** One sentence from the catalog. Shown as written. */
  measures: string;
  language: string;
  source: "built_in" | "user";
  research_only: boolean;
  needs_baseline: boolean;
  steps: AnalyzeStep[];
  version: string;
  baseline_prompt_ids: string[];
  schema: typeof ANALYZE_SCHEMA;
};

export type VoiceTip = { id: string; name: string; text: string; step: string };

export type BaselinePrompt = { id: string; text: string; tag: string };

export type ExperimentConfig = {
  model_id: string | null;
  needs_baseline: boolean;
  baseline_prompt_ids: string[];
  baseline_prompts: BaselinePrompt[];
};

export type CatalogResult = { state: "ready"; models: VoiceModel[] } | { state: "not-on-yet" } | { state: "host-only" };
export type ConfigResult = { state: "ready"; config: ExperimentConfig } | { state: "not-on-yet" } | { state: "host-only" };
export const HOST_ONLY = "Only the host can change this.";

export function isVoiceModel(value: unknown): value is VoiceModel {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const steps = row.steps;
  const ids = row.baseline_prompt_ids;
  return typeof row.id === "string" && row.id.length > 0
    && typeof row.name === "string" && row.name.length > 0
    && typeof row.measures === "string"
    && (row.source === "built_in" || row.source === "user")
    && typeof row.research_only === "boolean"
    && typeof row.needs_baseline === "boolean"
    && Array.isArray(steps) && steps.every((step) => STEPS.includes(step as AnalyzeStep))
    && typeof row.version === "string"
    && typeof row.language === "string"
    && Array.isArray(ids) && ids.every((id) => typeof id === "string")
    && row.schema === ANALYZE_SCHEMA;
}

export function readCatalog(body: unknown): CatalogResult {
  if (!body || typeof body !== "object" || !Array.isArray((body as { models?: unknown }).models)) return { state: "not-on-yet" };
  const rows = (body as { models: unknown[] }).models;
  const models = rows.filter(isVoiceModel);
  if (!models.length || models.length !== rows.length) return { state: "not-on-yet" };
  return { state: "ready", models };
}

export function readConfig(body: unknown): ConfigResult {
  if (!body || typeof body !== "object") return { state: "not-on-yet" };
  const row = body as Record<string, unknown>;
  const prompts = row.baseline_prompts;
  const ids = row.baseline_prompt_ids;
  if (!Array.isArray(prompts) || !Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return { state: "not-on-yet" };
  const baseline_prompts = prompts.filter(isBaselinePrompt);
  if (baseline_prompts.length !== prompts.length) return { state: "not-on-yet" };
  return {
    state: "ready",
    config: {
      model_id: typeof row.model_id === "string" ? row.model_id : null,
      needs_baseline: row.needs_baseline === true,
      baseline_prompt_ids: ids as string[],
      baseline_prompts,
    },
  };
}

function isBaselinePrompt(value: unknown): value is BaselinePrompt {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.text === "string" && row.tag === "baseline_calm";
}

/** b1–b3 from the prompt file already in the repo. */
export function calmFromFile(): BaselinePrompt[] {
  return loadPromptFile(promptText).prompts
    .filter((prompt) => prompt.tag === "baseline_calm")
    .slice(0, CALM_MAX)
    .map((prompt) => ({ id: prompt.id, text: prompt.text, tag: "baseline_calm" as const }));
}

export function languageWord(code: string): string {
  if (code === "pl") return "Polish";
  if (code === "en") return "English";
  return code;
}

export function sourceWord(source: VoiceModel["source"]): string {
  return source === "built_in" ? "Built in" : "Made here";
}

export function readTips(body: unknown): VoiceTip[] {
  if (!body || typeof body !== "object") return [];
  const rows = (body as { intervention?: unknown }).intervention;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const tip = row as Record<string, unknown>;
    if (typeof tip.id !== "string" || typeof tip.text !== "string" || typeof tip.name !== "string" || typeof tip.step !== "string") return [];
    return [{ id: tip.id, name: tip.name, text: tip.text, step: tip.step }];
  }).slice(0, 2);
}

/** A locked step says so. The screen never reads its score. */
export function stepLocked(take: AnalyzeTake, step: string): boolean {
  const row = take.summary[step as keyof AnalyzeTake["summary"]];
  return !row || row.unlocked !== true;
}

export function takeFromAnalysis(body: unknown): AnalyzeTake | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (Array.isArray(row.takes)) {
    const first = row.takes[0];
    return isTake(first) ? first : null;
  }
  return isTake(body) ? body : null;
}

function isTake(value: unknown): value is AnalyzeTake {
  if (!value || typeof value !== "object") return false;
  const row = value as AnalyzeTake;
  return Array.isArray(row.order) && Array.isArray(row.moments) && Boolean(row.summary);
}

export function analysisPending(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const status = (body as { status?: string }).status;
  return status === "queued" || status === "running";
}
