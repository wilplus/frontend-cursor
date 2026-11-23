import { bffFetch } from "@/lib/api/bffFetch";
import type { LoungeMessage } from "./loungeMessages";

export type ReviewCopy = { feedback?: string; ideal_sections?: string[] };
export type ReviewRevision = { revision: number; document: ReviewCopy };
export type ReviewRun = { id: string; at: string; kind: "tempo" | "voice" };
export type ReviewRuns = Record<string, ReviewRun[]>;

function reviewPath(project: string): string {
  return `/api/v2/explore/arc/${encodeURIComponent(project)}/review`;
}

export async function readReviewRuns(project: string): Promise<ReviewRuns | null> {
  const res = await bffFetch(`${reviewPath(project)}/runs`, { cache: "no-store" });
  if (res.kind !== "response" || !res.ok) return null;
  const runs = (res.body as { runs?: ReviewRuns } | null)?.runs;
  return runs ?? null;
}

/** Match the write-side walk identity, beyond the general chat's first page. */
export async function readReviewSteps(project: string, take: string): Promise<LoungeMessage[]> {
  const res = await bffFetch(reviewPath(project) + "/runs?take=" + encodeURIComponent(take), { cache: "no-store" });
  if (res.kind !== "response" || !res.ok) return [];
  const messages = (res.body as { messages?: LoungeMessage[] } | null)?.messages;
  return Array.isArray(messages) ? messages : [];
}

export async function readReviewCopy(project: string, take: string): Promise<ReviewRevision | null> {
  const res = await bffFetch(`${reviewPath(project)}/notes/${encodeURIComponent(take)}`, { cache: "no-store" });
  return res.kind === "response" && res.ok ? res.body as ReviewRevision : null;
}

export async function saveReviewCopy(project: string, take: string, revision: number, document: ReviewCopy) {
  const res = await bffFetch(`${reviewPath(project)}/notes/${encodeURIComponent(take)}`, {
    method: "PUT", json: { revision, document },
  });
  if (res.kind !== "response" || (!res.ok && res.status !== 409)) return null;
  return { conflict: res.status === 409, revision: res.body as ReviewRevision };
}
