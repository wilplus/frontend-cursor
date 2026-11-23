import { bffFetch } from "@/lib/api/bffFetch";

export type ReviewCopy = { feedback?: string; ideal_sections?: string[] };
export type ReviewRevision = { revision: number; document: ReviewCopy };
export type ReviewRuns = Record<string, { id: string; at: string; kind: "tempo" | "voice" }[]>;

function reviewPath(project: string): string {
  return `/api/v2/explore/arc/${encodeURIComponent(project)}/review`;
}

export async function readReviewRuns(project: string): Promise<ReviewRuns | null> {
  const res = await bffFetch(`${reviewPath(project)}/runs`, { cache: "no-store" });
  if (res.kind !== "response" || !res.ok) return null;
  const runs = (res.body as { runs?: ReviewRuns } | null)?.runs;
  return runs ?? null;
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
