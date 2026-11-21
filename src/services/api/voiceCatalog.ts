import { bffFetch } from "@/lib/api/bffFetch";
import {
  analysisPending,
  classifyStatus,
  readCatalog,
  readConfig,
  readTips,
  takeFromAnalysis,
  type CatalogResult,
  type ConfigResult,
  type VoiceModel,
  type VoiceTip,
} from "@/lib/willab/experiments/voiceCatalog";
import type { AnalyzeTake, SelfRating } from "@/lib/willab/experiments/types";

/* Calls this app's BFF only. No service-role key. A missing route,
   which is where draft backend PR #2005 still is, is "not on yet". */

async function call(path: string, init: { method?: "GET" | "POST" | "PUT" | "DELETE"; json?: unknown; body?: BodyInit } = {}) {
  try {
    const result = await bffFetch(path, { ...init, auth: "optional" });
    if (!result || result.kind !== "response") return { kind: "network" as const };
    return result;
  } catch {
    return { kind: "network" as const };
  }
}

function missing(result: { kind: string; status?: number }): boolean {
  return result.kind !== "response" || result.status === 404 || result.status === 405 || result.status === 501;
}

function hostOnly(result: { kind: string; status?: number; body?: unknown }): boolean {
  return result.kind === "response" && result.status !== undefined && classifyStatus(result.status, result.body) === "host-only";
}

function absent(result: { kind: string; status?: number; body?: unknown }): boolean {
  return result.kind === "response" && result.status !== undefined && classifyStatus(result.status, result.body) === "absent";
}

export async function listVoiceModels(): Promise<CatalogResult> {
  const result = await call("/api/v2/experiments/models");
  if (hostOnly(result)) return { state: "host-only" };
  if (missing(result) || result.kind !== "response" || !result.ok) return { state: "not-on-yet" };
  return readCatalog(result.body);
}

export async function readExperimentConfig(chatId: string): Promise<ConfigResult> {
  const result = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/experiment-config`);
  if (hostOnly(result)) return { state: "host-only" };
  if (absent(result)) return { state: "absent" };
  if (missing(result) || result.kind !== "response" || !result.ok) return { state: "not-on-yet" };
  return readConfig(result.body);
}

export async function saveExperimentConfig(chatId: string, config: { model_id: string | null; baseline_prompt_ids: string[] }): Promise<ConfigResult> {
  const result = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/experiment-config`, { method: "PUT", json: config });
  if (hostOnly(result)) return { state: "host-only" };
  if (absent(result)) return { state: "absent" };
  if (missing(result) || result.kind !== "response" || !result.ok) return { state: "not-on-yet" };
  return readConfig(result.body);
}

export async function openVoiceSession(file: File | null): Promise<{ id: string } | "not-on-yet"> {
  const consent = { participant: true, researcher: false, version: "experiments-v1" };
  const result = file
    ? await call("/api/v2/experiments/sessions", { method: "POST", body: sessionForm(consent, file) })
    : await call("/api/v2/experiments/sessions", { method: "POST", json: { consent } });
  if (missing(result) || result.kind !== "response" || !result.ok) return "not-on-yet";
  const id = result.body && typeof result.body === "object" ? (result.body as { id?: string }).id : "";
  return id ? { id } : "not-on-yet";
}

function sessionForm(consent: { participant: boolean; researcher: boolean; version: string }, file: File): FormData {
  const form = new FormData();
  form.set("consent", JSON.stringify(consent));
  form.set("business_case", file);
  return form;
}

export async function postVoiceTake(input: {
  sessionId: string;
  promptId: string;
  tag: string;
  selfRating: SelfRating;
  audio: Blob;
}): Promise<{ id: string } | "not-on-yet"> {
  const form = new FormData();
  form.set("audio", input.audio, "talk.webm");
  form.set("prompt_id", input.promptId);
  form.set("tag", input.tag);
  form.set("self_rating", JSON.stringify(input.selfRating));
  const result = await call(`/api/v2/experiments/sessions/${encodeURIComponent(input.sessionId)}/takes`, { method: "POST", body: form });
  if (missing(result) || result.kind !== "response" || !result.ok) return "not-on-yet";
  const id = result.body && typeof result.body === "object" ? (result.body as { id?: string }).id : "";
  return id ? { id } : "not-on-yet";
}

export async function queueAnalysis(takeId: string, modelId: string | null): Promise<"queued" | "not-on-yet"> {
  const result = await call("/api/v2/experiments/analyze-take", {
    method: "POST",
    json: { take_id: takeId, ...(modelId ? { model_id: modelId } : {}) },
  });
  if (missing(result) || result.kind !== "response" || (result.status !== 202 && !result.ok)) return "not-on-yet";
  return "queued";
}

export async function pollAnalysis(takeId: string): Promise<{ state: "pending" } | { state: "ready"; take: AnalyzeTake; tips: VoiceTip[] } | { state: "not-on-yet" }> {
  const result = await call(`/api/v2/experiments/takes/${encodeURIComponent(takeId)}/analysis`);
  if (missing(result) || result.kind !== "response") return { state: "not-on-yet" };
  if (result.status === 202 || analysisPending(result.body)) return { state: "pending" };
  const take = takeFromAnalysis(result.body);
  if (!result.ok || !take) return { state: "not-on-yet" };
  return { state: "ready", take, tips: readTips(result.body) };
}

export async function deleteVoiceData(): Promise<"deleted" | "not-on-yet"> {
  const result = await call("/api/v2/experiments/me", { method: "DELETE" });
  if (missing(result) || result.kind !== "response" || !result.ok) return "not-on-yet";
  return "deleted";
}

export type { VoiceModel };
