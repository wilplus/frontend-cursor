import { bffFetch } from "@/lib/api/bffFetch";
import type { TempoEvent, TempoStretch } from "@/lib/willab/tempoStep";
import { levelNameOf } from "@/lib/willab/planCopy";
import type { WalkClip } from "@/lib/willab/feedbackWalkModel";

/** How long one read of the stretch may take before it counts as failed. */
const TEMPO_READ_TIMEOUT_MS = 10_000;

/** The Take's stretch for the walk's tempo step (backend N162, N166): the
 *  clip the pace scale reads furthest from the green, fast or slow, and what
 *  it was about (for the One thing walk, whose opening says no topic, the
 *  backend makes no topic call: C-TEMPO). Null when no clip left the green;
 *  "failed" when the read failed, which is not "no stretch" (T): the caller
 *  asks again. */
export async function fetchReviewTempo(arcId: string, takeId: string): Promise<TempoStretch | null | "failed"> {
  try {
    // A read that hangs counts as failed and is asked again; the bound stays
    // above the backend's own topic call (8 s) for a walk that still writes one.
    const result = await bffFetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/review/tempo/${encodeURIComponent(takeId)}`,
      { cache: "no-store", timeoutMs: TEMPO_READ_TIMEOUT_MS },
    );
    if (result.kind !== "response" || !result.ok) return "failed";
    return readTempo((result.body as { tempo?: unknown } | null)?.tempo);
  } catch {
    return "failed";
  }
}

/** The backend's answer, when it is whole. Pure. */
export function readTempo(raw: unknown): TempoStretch | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as {
    reading?: unknown; topic?: unknown; said?: unknown; plan_level?: unknown; slide_index?: unknown;
    snippet_id?: unknown; snippet_audio_ref?: unknown; start_offset_ms?: unknown; duration_ms?: unknown;
  };
  const said = (t.said ?? {}) as { before?: unknown; stretch?: unknown; after?: unknown };
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  if ((t.reading !== "rushed" && t.reading !== "slow") || !text(t.topic).trim() || !text(said.stretch).trim()) return null;
  return {
    reading: t.reading,
    topic: text(t.topic),
    said: { before: text(said.before), stretch: text(said.stretch), after: text(said.after) },
    planLevel: levelNameOf(typeof t.plan_level === "string" ? t.plan_level : null),
    clip: clipOf(t),
    // The stretch's slide and its recording, when served (C-TEMPO): an
    // index and an id, never a read.
    ...(typeof t.slide_index === "number" && Number.isInteger(t.slide_index) && t.slide_index >= 0 ? { slideIndex: t.slide_index } : {}),
    ...(typeof t.snippet_id === "string" && t.snippet_id ? { snippetId: t.snippet_id } : {}),
  };
}

/** The stretch's clip as the walk's moments carry theirs: a signed http(s)
 *  link with the offset and length within it. None without one. Pure. */
function clipOf(t: { snippet_id?: unknown; snippet_audio_ref?: unknown; start_offset_ms?: unknown; duration_ms?: unknown }): WalkClip | null {
  const src = t.snippet_audio_ref;
  if (typeof src !== "string" || !/^https?:\/\//.test(src)) return null;
  const ms = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  return {
    src,
    startOffsetMs: ms(t.start_offset_ms),
    durationMs: ms(t.duration_ms),
    snippetId: typeof t.snippet_id === "string" ? t.snippet_id : null,
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
      // `skipped`: the speaker ended the game, by Skip or by leaving it,
      // after a try too, so Will's note never reads it as played out
      // (C-TEMPO-GAME).
      json: { reading, tries: game.tries.map((t) => ({ result: t.result, path: t.path.slice(0, 300) })), close: game.close, skipped: game.skipped === true },
    });
  } catch {
    // Will learns less from this Take; the speaker's walk goes on.
  }
}
