import { getAuthToken } from "@/lib/api/auth-client";
import type { ConfidenceRatingValue } from "./stateRatings";

/** Another speaker's moment, audio only (AC-9). */
export type OtherClip = {
  id: string;
  src: string;
  startOffsetMs: number | null;
  durationMs: number | null;
};

async function send(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const token = await getAuthToken();
    if (!token) return null;
    return await fetch(path, {
      ...init,
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch {
    return null;
  }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The moments to judge after practice; none on any failure. */
export async function fetchOtherClips(): Promise<OtherClip[]> {
  const res = await send("/api/v2/user/communities/queue");
  if (!res?.ok) return [];
  const data = (await res.json().catch(() => null)) as { clips?: unknown } | null;
  if (!Array.isArray(data?.clips)) return [];
  return data.clips.flatMap((raw) => {
    const c = (raw ?? {}) as Record<string, unknown>;
    if (typeof c.clip_id !== "string" || typeof c.audio_ref !== "string" || !c.audio_ref) return [];
    return [{ id: c.clip_id, src: c.audio_ref, startOffsetMs: num(c.start_offset_ms), durationMs: num(c.duration_ms) }];
  });
}

/** One answer, sent behind the screen; a failure is not shown. */
export async function answerOtherClip(clipId: string, value: ConfidenceRatingValue): Promise<void> {
  await send("/api/v2/user/communities/answers", {
    method: "POST",
    body: JSON.stringify({ clip_id: clipId, value }),
  });
}
