import { getAuthToken } from "@/lib/api/auth-client";
import { guestOwnerHeaders } from "./projects";

/* -------------------------------------------------------------------------- */
/*  bestPresentation — explore-arc best-presentation service (F1 / F2 / F3)   */
/*                                                                            */
/*  After 3 (opt 4) explore takes the BE assembles the user's best delivery   */
/*  per slide into a continuous "ideal presentation." These two endpoints      */
/*  power the progress bar (cheap poll) and the full overlay (on demand).      */
/*                                                                            */
/*  Both soft-fail to null — the overlay / bubble simply hide when the BE       */
/*  hasn't shipped the endpoint yet (graceful degradation, same pattern as      */
/*  recordingProgress).                                                         */
/* -------------------------------------------------------------------------- */

export interface BestPresentationProgress {
  takesDone: number;
  takesTarget: number;
  takesRemaining: number;
  ready: boolean;
  /** BE `coach_finalized` (B8) — true once the coach has assembled the ideal
   *  text. At 3/3 with this still false, the bubble shows the "waiting for the
   *  coach" state. Absent → false (so a ready-but-unfinalized arc shows the wait
   *  rather than nothing). */
  coachFinalized: boolean;
}

/** One slide in the assembled best presentation. text is the BE-composed,
 *  lightly-edited transcript of the user's best-rated CHALLENGE take for
 *  this slide. text is empty string when no usable take exists yet (F5). */
export interface BestPresentationSlide {
  index: number;
  title: string;
  /** BE-composed text (verbatim from user words + minimal continuity edits).
   *  Empty string = no usable take for this slide (render a placeholder). */
  text: string;
  audioRef: string | null;
  /** BE #143 — the line's span within its take's audio, so playback clamps to
   *  the spoken line instead of replaying the whole take from 0. 0 when absent. */
  startOffsetMs: number;
  durationMs: number;
  takeIndex: number;
  /** True when the user has saved a custom edit to this slide's text. */
  edited: boolean;
  /** P8/B5 — short key phrases for at-a-glance reading while presenting
   *  (coach-corrected when present, auto-derived otherwise; BE folds). [] until
   *  the BE ships them. */
  keyPhrases: string[];
}

export interface BestPresentationResult {
  ready: boolean;
  progress: BestPresentationProgress;
  slides: BestPresentationSlide[];
  /** The arc's deck PDF URL, if a presentation was attached. Passed through
   *  SlideRender for PDF page thumbnails; null = TextSlide fallback. */
  presentationRef: string | null;
  /** BE #141 — false until a human coach has reviewed/confirmed this composed
   *  presentation. While false the FE shows a "draft, pending coach review"
   *  badge. Defaults true on an older payload so we never mislabel a real one. */
  coachReviewed: boolean;
  /** C — the presentation's display name (BE sources it from the arc's
   *  session_context.topic). null on an older payload / when absent. */
  name: string | null;
}

/* ------------------------------- mappers ---------------------------------- */

function mapProgress(raw: unknown): BestPresentationProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const done =
    typeof r.takes_done === "number" && Number.isFinite(r.takes_done)
      ? r.takes_done
      : null;
  const target =
    typeof r.takes_target === "number" &&
    Number.isFinite(r.takes_target) &&
    r.takes_target > 0
      ? r.takes_target
      : null;
  if (done === null || target === null) return null;
  const remaining =
    typeof r.takes_remaining === "number" && Number.isFinite(r.takes_remaining)
      ? r.takes_remaining
      : Math.max(0, target - done);
  return {
    takesDone: done,
    takesTarget: target,
    takesRemaining: remaining,
    ready: typeof r.ready === "boolean" ? r.ready : done >= target,
    coachFinalized: r.coach_finalized === true,
  };
}

/** Exported for the arc-batch view (R4-11), whose ideal_text.slides reuse the
 *  exact build_best_presentation slide shape. */
export function mapSlide(raw: unknown): BestPresentationSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const index =
    typeof r.index === "number" && Number.isFinite(r.index) ? r.index : null;
  if (index === null) return null;
  return {
    index,
    title: typeof r.title === "string" ? r.title : "",
    text: typeof r.text === "string" ? r.text : "",
    audioRef: typeof r.audio_ref === "string" && r.audio_ref.length > 0 ? r.audio_ref : null,
    startOffsetMs:
      typeof r.start_offset_ms === "number" && Number.isFinite(r.start_offset_ms)
        ? r.start_offset_ms
        : 0,
    durationMs:
      typeof r.duration_ms === "number" && Number.isFinite(r.duration_ms)
        ? r.duration_ms
        : 0,
    takeIndex: typeof r.take_index === "number" ? r.take_index : 1,
    edited: typeof r.edited === "boolean" ? r.edited : false,
    keyPhrases: Array.isArray(r.key_phrases)
      ? r.key_phrases.filter(
          (k): k is string => typeof k === "string" && k.length > 0
        )
      : [],
  };
}

/* ------------------------------ fetch ------------------------------------- */

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Cheap poll — returns only the progress counts.
 *  Soft-fails to null (404 / network / no endpoint). */
export async function fetchBestPresentationProgress(
  arcId: string
): Promise<BestPresentationProgress | null> {
  const headers = await authHeaders();
  if (!headers.Authorization) Object.assign(headers, guestOwnerHeaders());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/progress`,
      {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      }
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) return null;
  return mapProgress(await res.json().catch(() => null));
}

// Delivery layer: per-slide text editing is retired — the coach edits the
// ONE-BLOCK ideal text (idealText.ts) and the user edits their notebook copy.

/** "Still being prepared" sentinel — the arc's takes are done, but the coach
 *  hasn't finalized every slide's ideal text yet. Distinct from the not-ready
 *  progress state (takes still owed): the FE shows a calm "your coach is putting
 *  this together" panel and NEVER the raw auto-draft. Detected on a 200 body via
 *  `ready === true && coach_finalized === false` (the BE serves empty slide text
 *  until then). */
export interface BestPresentationPreparing {
  preparing: true;
}

export async function fetchBestPresentation(
  arcId: string
): Promise<BestPresentationResult | BestPresentationPreparing | null> {
  const headers = await authHeaders();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/best-presentation`,
      {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      }
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return null;
  const progress = mapProgress(body.progress);
  if (!progress) return null;
  const ready = typeof body.ready === "boolean" ? body.ready : progress.ready;
  // "Still being prepared by your coach": past the 402 gate (this IS a 200) and
  // the takes are done, but the coach hasn't finalized every slide — the BE
  // serves empty slide text until then, never the raw auto-draft. Absent
  // coach_finalized → true (an older payload serves its content as before, so
  // no spurious "preparing"). Guarded on `ready` so a <3-takes arc still shows
  // the "need N more takes" state, not "preparing".
  const coachFinalized = body.coach_finalized !== false;
  if (ready && !coachFinalized) return { preparing: true };
  const rawSlides = Array.isArray(body.slides) ? body.slides : [];
  return {
    ready,
    progress,
    slides: rawSlides
      .map(mapSlide)
      .filter((s): s is BestPresentationSlide => s !== null),
    presentationRef:
      typeof body.presentation_ref === "string" && body.presentation_ref.length > 0
        ? body.presentation_ref
        : null,
    coachReviewed:
      typeof body.coach_reviewed === "boolean" ? body.coach_reviewed : true,
    name:
      typeof body.name === "string" && body.name.length > 0 ? body.name : null,
  };
}
