import { bffFetch } from "@/lib/api/bffFetch";

/* Strengths (Linear WIL-112; backend N241, signed N258; services/strengths.py;
   rules: docs/flows/principles.md §1 N). Ring 5 (row strengths): the
   backend answers 404 for anyone else, read here as off. Writes that put
   rows into the Lounge answer them; the caller reloads. */

export type StrengthNote = { body: string; on: string; on_label: string; label: string | null };
export type Strength = {
  id: string;
  title: string;
  kept_on: string | null;
  archived_on: string | null;
  /** Every note that shows it, newest first. */
  notes: StrengthNote[];
};
export type Strengths = { enabled: boolean; kept: Strength[]; archived: Strength[] };
/** The lens: the strength Will suggests and the notes it came from. */
export type Suggestion = { id: string; title: string; status: string; notes: StrengthNote[] };

async function call(path: string, init: Parameters<typeof bffFetch>[1]): Promise<unknown | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    return result.kind === "response" && result.ok ? (result.body ?? {}) : null;
  } catch {
    return null;
  }
}

export async function getStrengths(): Promise<Strengths> {
  const body = (await call("/api/v2/strengths", { method: "GET" })) as Partial<Strengths> | null;
  if (!body) return { enabled: false, kept: [], archived: [] };
  return { enabled: true, kept: body.kept ?? [], archived: body.archived ?? [] };
}

/** The Lounge opened: the strength before a talk; true when rows were written. */
export async function strengthsToday(): Promise<boolean> {
  const body = (await call("/api/v2/strengths/today", { method: "POST", json: {} })) as { messages?: unknown } | null;
  return Array.isArray(body?.messages) && body.messages.length > 0;
}

export async function getSuggestion(id: string): Promise<Suggestion | null> {
  return (await call(`/api/v2/strengths/${encodeURIComponent(id)}`, { method: "GET" })) as Suggestion | null;
}

export async function answerStrengthAsk(id: string, choice: "look" | "not_now"): Promise<boolean> {
  return (await call(`/api/v2/strengths/${encodeURIComponent(id)}/ask`, { method: "POST", json: { choice } })) !== null;
}

export async function decideStrength(id: string, choice: "accept" | "edit" | "not_now", text?: string): Promise<boolean> {
  return (await call(`/api/v2/strengths/${encodeURIComponent(id)}/decide`, { method: "POST", json: { choice, text } })) !== null;
}

export async function archiveStrength(id: string): Promise<Strengths | null> {
  const body = (await call(`/api/v2/strengths/${encodeURIComponent(id)}/archive`, { method: "POST", json: {} })) as Partial<Strengths> | null;
  return body ? { enabled: true, kept: body.kept ?? [], archived: body.archived ?? [] } : null;
}
