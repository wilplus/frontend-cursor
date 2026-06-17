import { getAuthToken } from "@/lib/api/auth-client";

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
  takeIndex: number;
  /** true when this slide's best take follows a threat snippet in the same
   *  arc — the moment the challenge mindset clicked. Challenge-side only. */
  breakthrough: boolean;
  /** Short plain-language "why" text for the breakthrough, e.g.
   *  "Comfortable pace, natural rise and fall." Render verbatim. */
  breakthroughNote: string | null;
}

export interface BestPresentationResult {
  ready: boolean;
  progress: BestPresentationProgress;
  slides: BestPresentationSlide[];
  /** The arc's deck PDF URL, if a presentation was attached. Passed through
   *  SlideRender for PDF page thumbnails; null = TextSlide fallback. */
  presentationRef: string | null;
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
  };
}

function mapSlide(raw: unknown): BestPresentationSlide | null {
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
    takeIndex: typeof r.take_index === "number" ? r.take_index : 1,
    breakthrough:
      typeof r.breakthrough === "boolean" ? r.breakthrough : false,
    breakthroughNote:
      typeof r.breakthrough_note === "string" && r.breakthrough_note.length > 0
        ? r.breakthrough_note
        : null,
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
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/progress`,
      { method: "GET", headers, credentials: "include", cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  return mapProgress(await res.json().catch(() => null));
}

/** Full payload — fetched once when the overlay opens.
 *  Soft-fails to null. */
export async function fetchBestPresentation(
  arcId: string
): Promise<BestPresentationResult | null> {
  const headers = await authHeaders();
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/explore/arc/${encodeURIComponent(arcId)}/best-presentation`,
      { method: "GET", headers, credentials: "include", cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return null;
  const progress = mapProgress(body.progress);
  if (!progress) return null;
  const rawSlides = Array.isArray(body.slides) ? body.slides : [];
  return {
    ready: typeof body.ready === "boolean" ? body.ready : progress.ready,
    progress,
    slides: rawSlides
      .map(mapSlide)
      .filter((s): s is BestPresentationSlide => s !== null),
    presentationRef:
      typeof body.presentation_ref === "string" && body.presentation_ref.length > 0
        ? body.presentation_ref
        : null,
  };
}
