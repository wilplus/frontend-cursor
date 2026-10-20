import { outcomeCall as call } from "@/lib/api/bffCall";
import { CONFIDENCE_RATING_VALUES, type ConfidenceRatingValue } from "./stateRatings";

/** Another speaker's moment, audio only (AC-9). */
export type OtherClip = {
  id: string;
  src: string;
  startOffsetMs: number | null;
  durationMs: number | null;
  /** The listener's own community it comes from, by name; null: general. */
  community: string | null;
};

/** A moment the listener already judged, and how. */
export type OtherAnswer = OtherClip & { answer: ConfidenceRatingValue };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function mapClip(raw: unknown): OtherClip | null {
  const c = (raw ?? {}) as Record<string, unknown>;
  if (typeof c.clip_id !== "string" || typeof c.audio_ref !== "string" || !c.audio_ref) return null;
  return {
    id: c.clip_id,
    src: c.audio_ref,
    startOffsetMs: num(c.start_offset_ms),
    durationMs: num(c.duration_ms),
    community: typeof c.community === "string" && c.community.trim() ? c.community.trim() : null,
  };
}

function mapClips(data: Record<string, unknown>): OtherClip[] {
  if (!Array.isArray(data.clips)) return [];
  return data.clips.flatMap((raw) => mapClip(raw) ?? []);
}

const isValue = (v: unknown): v is ConfidenceRatingValue =>
  typeof v === "string" && (CONFIDENCE_RATING_VALUES as readonly string[]).includes(v);

function mapAnswers(data: Record<string, unknown>): OtherAnswer[] {
  if (!Array.isArray(data.answers)) return [];
  return data.answers.flatMap((raw) => {
    const clip = mapClip(raw);
    const value = ((raw ?? {}) as Record<string, unknown>).value;
    return clip && isValue(value) ? [{ ...clip, answer: value }] : [];
  });
}

/** The moments to judge after practice; none on any failure. */
export async function fetchOtherClips(): Promise<OtherClip[]> {
  const res = await call("/api/v2/user/communities/queue", { method: "GET" }, mapClips);
  return res.ok ? res.data : [];
}

/** The moments the listener already judged, newest first (at most three):
 *  the judging reopened from the Lounge shows them answered. None on any
 *  failure. */
export async function fetchOtherAnswers(): Promise<OtherAnswer[]> {
  const res = await call("/api/v2/user/communities/answers", { method: "GET" }, mapAnswers);
  return res.ok ? res.data : [];
}

/** One answer, sent behind the screen; a failure is not shown. */
export async function answerOtherClip(clipId: string, value: ConfidenceRatingValue): Promise<void> {
  await call("/api/v2/user/communities/answers", { method: "POST", body: { clip_id: clipId, value } }, () => null);
}
