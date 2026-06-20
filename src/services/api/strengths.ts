import { getAuthToken } from "@/lib/api/auth-client";
import {
  mapReadoutFeatures,
  type ReadoutFeatures,
} from "@/components/willab/readout";

/* -------------------------------------------------------------------------- */
/*  strengths — the slide-grouped strong-sides page (§7b, BE PR #76→#79)       */
/*                                                                            */
/*  GET /api/v2/user/strengths → { general:[moment], presentations:[{         */
/*  presentation_id, presentation_ref, topic, slides, best_lines, takes }] }   */
/*    • general — strong moments from sessions with NO deck, newest-first.    */
/*    • presentations — one per unique deck (by presentation_id), each with   */
/*      a best_lines cross-take highlight reel and individual takes.          */
/* -------------------------------------------------------------------------- */

export interface StrengthMoment {
  transcript: string;
  note: string;
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  /** Rank within a slide (1 = best); null on general / unranked moments. */
  rank: number | null;
  /** §7b — the per-moment acoustic vector (same shape as the readout), for the
   *  "mathematics behind it" toggle. null until the BE adds `features` here. */
  features: ReadoutFeatures | null;
}

export interface StrengthSlide {
  index: number;
  title: string;
  body: string;
  /** Strong moments delivered on this slide, best-first. [] = none yet. */
  moments: StrengthMoment[];
}

export interface PresentationTake {
  takeNumber: number;
  sessionId: string;
  createdAt: string;
  presentationRef: string | null;
  slides: StrengthSlide[];
}

export interface PresentationGroup {
  presentationId: string;
  presentationRef: string | null;
  topic: string;
  slides: StrengthSlide[];
  bestLines: { index: number; title: string; body: string; moment: StrengthMoment }[];
  takes: PresentationTake[]; // newest-first
  // The explore arc this deck belongs to — opens the composed best presentation
  // (`/explore/arc/<arcId>/best-presentation`), which is built from the takes
  // and works BEFORE coach review (coach later re-ranks + confirms breakthroughs).
  arcId: string | null;
}

export interface StrengthsView {
  general: StrengthMoment[];
  presentations: PresentationGroup[];
}

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

function mapMoment(raw: unknown): StrengthMoment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const transcript = typeof r.transcript === "string" ? r.transcript : "";
  const note = typeof r.note === "string" ? r.note : "";
  const audioRef = typeof r.audio_ref === "string" ? r.audio_ref : null;
  // Nothing renderable → drop, so no empty cards leak into the gallery.
  if (!transcript && !note && !audioRef) return null;
  return {
    transcript,
    note,
    audioRef,
    startOffsetMs: num(r.start_offset_ms),
    durationMs: num(r.duration_ms),
    rank: typeof r.rank === "number" && Number.isFinite(r.rank) ? r.rank : null,
    features:
      r.features != null && typeof r.features === "object"
        ? mapReadoutFeatures(r.features)
        : null,
  };
}

function mapSlide(raw: unknown): StrengthSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.index !== "number") return null;
  return {
    index: r.index,
    title: typeof r.title === "string" ? r.title : "",
    body: typeof r.body === "string" ? r.body : "",
    moments: Array.isArray(r.strong_snippets)
      ? r.strong_snippets
          .map(mapMoment)
          .filter((m): m is StrengthMoment => m !== null)
      : [],
  };
}

function mapBestLine(
  raw: unknown
): { index: number; title: string; body: string; moment: StrengthMoment } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.slide_index !== "number") return null;
  const moment = mapMoment(r.moment);
  if (!moment) return null;
  return {
    index: r.slide_index,
    title: typeof r.title === "string" ? r.title : "",
    body: typeof r.body === "string" ? r.body : "",
    moment,
  };
}

function mapTake(raw: unknown): PresentationTake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.take_number !== "number") return null;
  return {
    takeNumber: r.take_number,
    sessionId: typeof r.session_id === "string" ? r.session_id : "",
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
    presentationRef:
      typeof r.presentation_ref === "string" && r.presentation_ref.length > 0
        ? r.presentation_ref
        : null,
    slides: Array.isArray(r.slides)
      ? r.slides.map(mapSlide).filter((s): s is StrengthSlide => s !== null)
      : [],
  };
}

function mapPresentation(raw: unknown): PresentationGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.presentation_id !== "string") return null;
  const takes = Array.isArray(r.takes)
    ? r.takes.map(mapTake).filter((t): t is PresentationTake => t !== null)
    : [];
  return {
    presentationId: r.presentation_id,
    presentationRef:
      typeof r.presentation_ref === "string" && r.presentation_ref.length > 0
        ? r.presentation_ref
        : takes.find((t) => t.presentationRef != null)?.presentationRef ?? null,
    topic: typeof r.topic === "string" ? r.topic : "",
    slides: Array.isArray(r.slides)
      ? r.slides.map(mapSlide).filter((s): s is StrengthSlide => s !== null)
      : [],
    bestLines: Array.isArray(r.best_lines)
      ? r.best_lines
          .map(mapBestLine)
          .filter(
            (
              b
            ): b is { index: number; title: string; body: string; moment: StrengthMoment } =>
              b !== null
          )
      : [],
    takes,
    arcId: typeof r.arc_id === "string" && r.arc_id.length > 0 ? r.arc_id : null,
  };
}

export function mapStrengths(raw: unknown): StrengthsView {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    general: Array.isArray(r.general)
      ? r.general.map(mapMoment).filter((m): m is StrengthMoment => m !== null)
      : [],
    presentations: Array.isArray(r.presentations)
      ? r.presentations
          .map(mapPresentation)
          .filter((p): p is PresentationGroup => p !== null)
      : [],
  };
}

export async function fetchStrengths(): Promise<StrengthsView> {
  const token = await getAuthToken();
  if (!token) return { general: [], presentations: [] };

  let res: Response;
  try {
    res = await fetch("/api/v2/user/strengths", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { general: [], presentations: [] };
  }
  if (!res.ok) return { general: [], presentations: [] };
  return mapStrengths(await res.json().catch(() => null));
}

export async function deletePresentation(presentationId: string): Promise<void> {
  const token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`/api/v2/user/presentations/${presentationId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete presentation failed: ${res.status}`);
}

export async function deleteTake(
  presentationId: string,
  takeNumber: number
): Promise<void> {
  const token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(
    `/api/v2/user/presentations/${presentationId}/takes/${takeNumber}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) throw new Error(`Delete take failed: ${res.status}`);
}
