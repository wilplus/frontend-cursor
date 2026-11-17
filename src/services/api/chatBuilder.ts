import { bffFetch } from "@/lib/api/bffFetch";
import type { CoachDefinition, PluginDraft } from "@/lib/willab/chatBuilder/types";

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

function definitionOf(value: unknown): CoachDefinition | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as CoachDefinition;
  if (doc.schema !== 1 || doc.id !== "speaking-coach" || !Array.isArray(doc.walk?.steps)) return null;
  return doc;
}

/** The draft, or null when the backend has none or is not there yet. */
export async function readCoachDraft(): Promise<CoachDefinition | null> {
  const body = await call("/api/v2/coaches/speaking-coach", { method: "GET" });
  return definitionOf(body?.document);
}

export async function saveCoachDraft(document: CoachDefinition): Promise<CoachDefinition | null> {
  const body = await call("/api/v2/coaches/speaking-coach/draft", { method: "PUT", json: { document } });
  return definitionOf(body?.document);
}

/** Writes nothing. The plan keys come back, or null when the route is absent. */
export async function previewCoach(document: CoachDefinition): Promise<string[] | null> {
  const body = await call("/api/v2/coaches/speaking-coach/preview", { method: "POST", json: { document } });
  return Array.isArray(body?.keys) ? body.keys.filter((k): k is string => typeof k === "string") : null;
}

export async function submitPlugin(source: string): Promise<PluginDraft | null> {
  const body = await call("/api/v2/coaches/speaking-coach/plugins", { method: "POST", json: { source } });
  if (!body || typeof body.status !== "string") return null;
  return body as unknown as PluginDraft;
}

export async function publishCoach(): Promise<boolean> {
  const body = await call("/api/v2/coaches/speaking-coach/publish", { method: "POST", json: {} });
  return body?.published === true;
}

/** Published to this account. Null: the hardcoded walk. */
export async function readActiveCoach(): Promise<CoachDefinition | null> {
  const body = await call("/api/v2/coaches/speaking-coach/active", { method: "GET" });
  return definitionOf(body?.document);
}
