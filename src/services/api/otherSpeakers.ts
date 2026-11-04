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

type Level = "high" | "middle" | "low";

async function queue(take?: string | null, level?: Level | null): Promise<OtherClip[]> {
  const params = new URLSearchParams();
  if (take) params.set("take", take);
  if (level) params.set("level", level);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await call(`/api/v2/user/communities/queue${query}`, { method: "GET" }, mapClips);
  return res.ok ? res.data : [];
}

/** A moment asked ahead is kept this long, well under the life of its
 *  signed link (the backend's PLAYBACK_TTL_SECONDS, 15 minutes). */
const AHEAD_MS = 10 * 60 * 1000;
const ahead = new Map<string, { at: number; clips: Promise<OtherClip[]> }>();
const aheadKey = (take: string, level: Level) => `${take}|${level}`;

function keptAhead(take: string, level: Level): Promise<OtherClip[]> | null {
  const kept = ahead.get(aheadKey(take, level));
  return kept && Date.now() - kept.at < AHEAD_MS ? kept.clips : null;
}

/** The One thing walk's one moment, asked as the walk opens (C8, N309 item
 *  2), so it is there when the walk gets to it: one request per take and
 *  level, kept while its link lives; an empty answer (a failure) is not
 *  kept. */
export function prefetchOtherClips(take: string, level: Level): void {
  if (keptAhead(take, level)) return;
  const key = aheadKey(take, level);
  const clips = queue(take, level).then((list) => {
    if (list.length === 0 && ahead.get(key)?.clips === clips) ahead.delete(key);
    return list;
  });
  ahead.set(key, { at: Date.now(), clips });
}

/** The moments to judge after practice, for the walk of `take` (N119): one
 *  per level, three speakers, fixed for the Take; with `level`, the One
 *  thing walk's one moment of that machine level (N309 item 2), the one
 *  asked ahead while it is fresh. None on any failure. */
export async function fetchOtherClips(take?: string | null, level?: Level | null): Promise<OtherClip[]> {
  return (take && level ? keptAhead(take, level) : null) ?? queue(take, level);
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
