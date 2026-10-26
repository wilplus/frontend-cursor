import { bffFetch } from "@/lib/api/bffFetch";
import type { TempoEvent, TempoStretch } from "@/lib/willab/tempoStep";

/** The Take's stretch for the walk's tempo step (backend N162, N166): the
 *  clip the pace scale reads furthest from the green, fast or slow, and what
 *  it was about. Null when no clip left the green, and on any failure: the
 *  walk then has no tempo step. */
export async function fetchReviewTempo(arcId: string, takeId: string): Promise<TempoStretch | null> {
  try {
    const result = await bffFetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/review/tempo/${encodeURIComponent(takeId)}`,
      { cache: "no-store" },
    );
    if (result.kind !== "response" || !result.ok) return null;
    return readTempo((result.body as { tempo?: unknown } | null)?.tempo);
  } catch {
    return null;
  }
}

/** The backend's answer, when it is whole. Pure. */
export function readTempo(raw: unknown): TempoStretch | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as { reading?: unknown; topic?: unknown; said?: unknown };
  const said = (t.said ?? {}) as { before?: unknown; stretch?: unknown; after?: unknown };
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  if ((t.reading !== "rushed" && t.reading !== "slow") || !text(t.topic).trim() || !text(said.stretch).trim()) return null;
  return {
    reading: t.reading,
    topic: text(t.topic),
    said: { before: text(said.before), stretch: text(said.stretch), after: text(said.after) },
  };
}

/** Keep the Take's tempo game for Will (backend N166 step 4): each try's
 *  result and the dot's path, and how it ended. Never audio. A failure is
 *  dropped: the walk never waits on it. */
export async function postTempoGame(
  arcId: string,
  takeId: string,
  reading: TempoStretch["reading"],
  game: Extract<TempoEvent, { kind: "ended" }>,
): Promise<void> {
  try {
    await bffFetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/review/tempo/${encodeURIComponent(takeId)}`, {
      method: "POST",
      cache: "no-store",
      json: { reading, tries: game.tries.map((t) => ({ result: t.result, path: t.path.slice(0, 300) })), close: game.close },
    });
  } catch {
    // Will learns less from this Take; the speaker's walk goes on.
  }
}
