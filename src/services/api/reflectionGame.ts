import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  reflectionGame — the Reflection Game + Confident Voices library (F2 §1)    */
/*                                                                            */
/*  The shadow detector's clipped moments come to the user as a QUESTION,      */
/*  never a claim; votes go back; the coach verifies blind; only verified      */
/*  moments appear in the cross-project library. The wire payloads are the     */
/*  BE's explicit allowlists — by design nothing here can know whether a clip  */
/*  was machine-flagged or a decoy, and nothing carries a count or a score     */
/*  (AC-9). Every call soft-fails: an absent endpoint / unrun migration means  */
/*  the game and library simply do not render.                                 */
/* -------------------------------------------------------------------------- */

export interface ReflectionClip {
  clipId: string;
  audioRef: string;
  startOffsetMs: number;
  durationMs: number;
  arcId: string | null;
  takeSessionId: string | null;
}

export interface ConfidentVoice {
  id: string;
  audioRef: string;
  startOffsetMs: number;
  durationMs: number;
  arcId: string | null;
  topic: string | null;
  verifiedAt: string | null;
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Map one wire clip; null when unplayable (no id / no audio) — never a dead
 *  player. Pure for testability. */
export function mapReflectionClip(raw: unknown): ReflectionClip | null {
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
    arcId: str(r.arc_id) || null,
    takeSessionId: str(r.take_session_id) || null,
  };
}

/** Map one library moment; null when unplayable. Pure. */
export function mapConfidentVoice(raw: unknown): ConfidentVoice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  const audioRef = str(r.audio_ref);
  if (!id || !audioRef) return null;
  return {
    id,
    audioRef,
    startOffsetMs: num(r.start_offset_ms),
    durationMs: num(r.duration_ms),
    arcId: str(r.arc_id) || null,
    topic: str(r.topic) || null,
    verifiedAt: str(r.verified_at) || null,
  };
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getAuthToken();
  if (!token) return null; // both surfaces are signed-in only
  return { Authorization: `Bearer ${token}` };
}

/** The clips to offer right now (BE-capped at 2). [] = nothing to ask —
 *  the game renders nothing. Soft-fails to []. */
export async function fetchReflectionClips(): Promise<ReflectionClip[]> {
  const headers = await authHeaders();
  if (!headers) return [];
  let res: Response;
  try {
    res = await fetch("/api/v2/reflection/clips", {
      headers,
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
    .map(mapReflectionClip)
    .filter((c): c is ReflectionClip => c !== null);
}

/** Record the user's answer to the game question. Resolves false on any
 *  failure so the card can offer the tap again. */
export async function voteReflectionClip(
  clipId: string,
  vote: "best" | "not_this"
): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/reflection/clips/${encodeURIComponent(clipId)}/vote`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vote }),
      }
    );
  } catch {
    return false;
  }
  return res.ok;
}

/** The cross-project Confident Voices library (coach-verified moments only,
 *  newest first). [] = empty or unavailable — the shelf renders nothing. */
export async function fetchConfidentVoices(): Promise<ConfidentVoice[]> {
  const headers = await authHeaders();
  if (!headers) return [];
  let res: Response;
  try {
    res = await fetch("/api/v2/library/confident-voices", {
      headers,
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
  if (!body || !Array.isArray(body.items)) return [];
  return body.items
    .map(mapConfidentVoice)
    .filter((v): v is ConfidentVoice => v !== null);
}
