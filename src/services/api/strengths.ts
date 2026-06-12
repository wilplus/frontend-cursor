import { getAuthToken } from "@/lib/api/auth-client";
import {
  mapReadoutFeatures,
  type ReadoutFeatures,
} from "@/components/willab/readout";

/* -------------------------------------------------------------------------- */
/*  strengths — the slide-grouped strong-sides page (§7b, BE PR #76)           */
/*                                                                            */
/*  GET /api/v2/user/strengths → { general:[moment], trainings:[{ session_id,  */
/*  topic, created_at, presentation_ref, title_slide, slides:[{ index, title,  */
/*  body, strong_snippets:[moment] }] }] }. A dedicated, pre-grouped endpoint   */
/*  (separate from /user/library, which the Lounge bot still uses):             */
/*    • general — strong moments from sessions with NO deck, newest-first.      */
/*    • trainings — one per deck-session (newest-first), each walking its deck   */
/*      slides; every slide carries the strong moments delivered on it, sorted   */
/*      by rank (1 = best). Slides with NO strong moment are KEPT — a prompt to   */
/*      train that one again.                                                   */
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

export interface StrengthTraining {
  sessionId: string;
  topic: string;
  createdAt: string;
  presentationRef: string | null;
  /** The deck's title slide (index 0) — null when absent. */
  titleSlide: StrengthSlide | null;
  slides: StrengthSlide[];
}

export interface StrengthsView {
  general: StrengthMoment[];
  trainings: StrengthTraining[];
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

function mapTraining(raw: unknown): StrengthTraining | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string") return null;
  return {
    sessionId: r.session_id,
    topic: typeof r.topic === "string" ? r.topic : "",
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
    presentationRef:
      typeof r.presentation_ref === "string" && r.presentation_ref.length > 0
        ? r.presentation_ref
        : null,
    titleSlide: mapSlide(r.title_slide),
    slides: Array.isArray(r.slides)
      ? r.slides.map(mapSlide).filter((s): s is StrengthSlide => s !== null)
      : [],
  };
}

export function mapStrengths(raw: unknown): StrengthsView {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    general: Array.isArray(r.general)
      ? r.general.map(mapMoment).filter((m): m is StrengthMoment => m !== null)
      : [],
    trainings: Array.isArray(r.trainings)
      ? r.trainings
          .map(mapTraining)
          .filter((t): t is StrengthTraining => t !== null)
      : [],
  };
}

export async function fetchStrengths(): Promise<StrengthsView> {
  const token = await getAuthToken();
  if (!token) return { general: [], trainings: [] };

  let res: Response;
  try {
    res = await fetch("/api/v2/user/strengths", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return { general: [], trainings: [] };
  }
  if (!res.ok) return { general: [], trainings: [] };
  return mapStrengths(await res.json().catch(() => null));
}

/* ─────────────────────── Trainings home: takes + best lines ─────────────── */

export interface TakeCard {
  training: StrengthTraining;
  takeNumber: number;
  /** "<topic>, take N" */
  label: string;
}

export interface BestLines {
  topic: string;
  presentationRef: string | null;
  /** Best moment per slide (one per slide), in deck order. */
  slides: { index: number; title: string; body: string; moment: StrengthMoment }[];
}

export interface StrengthsHome {
  /** Combined best line per slide (the highlight reel); null when no deck data. */
  bestLines: BestLines | null;
  /** Every recording as a numbered take, newest first. */
  takes: TakeCard[];
  general: StrengthMoment[];
}

/**
 * Shape the strengths view into the Trainings home: a best-lines reel + each
 * recording as a numbered take ("<topic>, take N", take 1 = first recording of
 * that deck), newest first. FE fallback for grouping/best — the BE `take_number`
 * + `best_lines` are authoritative (a deck re-served with a new presentation_ref,
 * or a true cross-take "best", can't be derived from per-session data here).
 */
export function strengthsHome(view: StrengthsView): StrengthsHome {
  const byTopic = new Map<string, StrengthTraining[]>();
  for (const t of view.trainings) {
    const key = t.topic || "Presentation";
    const arr = byTopic.get(key);
    if (arr) arr.push(t);
    else byTopic.set(key, [t]);
  }

  const takes: TakeCard[] = [];
  for (const [topic, group] of byTopic) {
    group
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach((training, i) =>
        takes.push({
          training,
          takeNumber: i + 1,
          label: `${topic}, take ${i + 1}`,
        })
      );
  }
  takes.sort((a, b) => b.training.createdAt.localeCompare(a.training.createdAt));

  return { bestLines: buildBestLines(view.trainings), takes, general: view.general };
}

function buildBestLines(trainings: StrengthTraining[]): BestLines | null {
  // FE fallback: the most recent recording's best moment per slide. (The BE's
  // cross-take aggregation picks the best of each slide across ALL takes.)
  const recent = trainings[0];
  if (!recent) return null;
  const slides = recent.slides
    .filter((s) => s.moments.length > 0)
    .map((s) => ({ index: s.index, title: s.title, body: s.body, moment: s.moments[0] }));
  if (slides.length === 0) return null;
  return {
    topic: recent.topic || "Presentation",
    presentationRef: recent.presentationRef,
    slides,
  };
}
