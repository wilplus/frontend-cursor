/* -------------------------------------------------------------------------- */
/*  coachReflectionQueue — the BLIND clip-verification lane (F2 §1d)           */
/*                                                                            */
/*  Voted Reflection-Game clips waiting on a coach verdict. The wire payload   */
/*  is audio + transcript ONLY: no machine flag, no provenance, no user vote,  */
/*  no user identity. That is not an oversight to be worked around — a coach   */
/*  who could see the model's guess or the student's answer would stop being   */
/*  an independent third judgement, and the agreement matrix built from these  */
/*  verdicts would be worth nothing. Nothing in this module may ask for more.  */
/*                                                                            */
/*  Queue PRIORITY (founder decision): text verification outranks clip         */
/*  verification — render this below text-verification work, never above.      */
/*                                                                            */
/*  Every call soft-fails: a non-coach (403), an unshipped endpoint (404) or   */
/*  an unrun migration means the queue simply does not render.                 */
/* -------------------------------------------------------------------------- */

export interface CoachReflectionClip {
  clipId: string;
  /** Freshly minted upstream on every serve — use on receipt, never cache. */
  audioRef: string;
  startOffsetMs: number;
  durationMs: number;
  transcript: string;
}

export type CoachVerdict = "confident" | "not_confident";

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Map one wire clip; null when unplayable (no id / no audio) — never a dead
 *  player in the queue. Pure for testability. */
export function mapCoachReflectionClip(
  raw: unknown
): CoachReflectionClip | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const clipId = str(r.clip_id);
  const audioRef = str(r.audio_ref);
  if (!clipId || !audioRef) return null;
  return {
    clipId,
    audioRef,
    startOffsetMs: num(r.start_offset_ms),
    durationMs: num(r.duration_ms),
    transcript: str(r.transcript),
  };
}

/** The clips awaiting this coach's verdict, oldest vote first.
 *  [] = nothing to verify, not a coach, or the lane is unavailable. */
export async function fetchCoachReflectionQueue(): Promise<
  CoachReflectionClip[]
> {
  let res: Response;
  try {
    res = await fetch("/api/v2/coach/reflection/queue", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || !Array.isArray(body.clips)) return [];
  return body.clips
    .map(mapCoachReflectionClip)
    .filter((c): c is CoachReflectionClip => c !== null);
}

/** Store the coach's blind verdict. `confident` is what lands the moment in
 *  the student's Confident Voices library. Resolves false on any failure so
 *  the card can offer the decision again rather than silently swallowing it. */
export async function submitCoachVerdict(
  clipId: string,
  verdict: CoachVerdict
): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/reflection/${encodeURIComponent(clipId)}/verdict`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ verdict }),
      }
    );
  } catch {
    return false;
  }
  return res.ok;
}
