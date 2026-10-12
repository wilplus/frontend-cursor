import { outcomeCall as call } from "@/lib/api/bffCall";
import type { ConfidenceRatingValue } from "./stateRatings";

/** Another speaker's moment, audio only (AC-9). */
export type OtherClip = {
  id: string;
  src: string;
  startOffsetMs: number | null;
  durationMs: number | null;
  /** The listener's own community it comes from, by name; null: general. */
  community: string | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function mapClips(data: Record<string, unknown>): OtherClip[] {
  if (!Array.isArray(data.clips)) return [];
  return data.clips.flatMap((raw) => {
    const c = (raw ?? {}) as Record<string, unknown>;
    if (typeof c.clip_id !== "string" || typeof c.audio_ref !== "string" || !c.audio_ref) return [];
    return [{
      id: c.clip_id,
      src: c.audio_ref,
      startOffsetMs: num(c.start_offset_ms),
      durationMs: num(c.duration_ms),
      community: typeof c.community === "string" && c.community.trim() ? c.community.trim() : null,
    }];
  });
}

/** The moments to judge after practice; none on any failure. */
export async function fetchOtherClips(): Promise<OtherClip[]> {
  const res = await call("/api/v2/user/communities/queue", { method: "GET" }, mapClips);
  return res.ok ? res.data : [];
}

/** One answer, sent behind the screen; a failure is not shown. */
export async function answerOtherClip(clipId: string, value: ConfidenceRatingValue): Promise<void> {
  await call("/api/v2/user/communities/answers", { method: "POST", body: { clip_id: clipId, value } }, () => null);
}
