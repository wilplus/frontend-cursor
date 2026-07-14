import { getAuthToken } from "@/lib/api/auth-client";

/* -------------------------------------------------------------------------- */
/*  trainings — the training tab's arc-grouped source (R4-13, BE-B)            */
/*                                                                            */
/*  GET /api/v2/user/trainings → one entry per arc (deckless included), each   */
/*  with its takes + batch_verified / ideal_ready flags. Replaces the deck-    */
/*  hash-grouped /user/strengths as the tab's feed; the FE falls back to the   */
/*  legacy view while this endpoint 404s (safe-ahead).                         */
/* -------------------------------------------------------------------------- */

export interface TrainingTake {
  sessionId: string;
  takeIndex: number;
  createdAt: string | null;
  hasSlides: boolean;
}

export interface TrainingArc {
  arcId: string;
  topic: string;
  createdAt: string | null;
  takeCount: number;
  takes: TrainingTake[];
  /** True once the coach's "Publish arc" delivered the batch. */
  batchVerified: boolean;
  /** True once the coach finalized the ideal text (gates the ideal button). */
  idealReady: boolean;
  bestPresentationArcId: string;
}

function mapTake(raw: unknown): TrainingTake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string" || r.session_id.length === 0) return null;
  return {
    sessionId: r.session_id,
    takeIndex: typeof r.take_index === "number" ? r.take_index : 0,
    createdAt: typeof r.created_at === "string" ? r.created_at : null,
    hasSlides: r.has_slides === true,
  };
}

function mapArc(raw: unknown): TrainingArc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.arc_id !== "string" || r.arc_id.length === 0) return null;
  const takes = (Array.isArray(r.takes) ? r.takes : [])
    .map(mapTake)
    .filter((t): t is TrainingTake => !!t)
    .sort((a, b) => a.takeIndex - b.takeIndex);
  return {
    arcId: r.arc_id,
    topic:
      typeof r.topic === "string" && r.topic.trim().length > 0
        ? r.topic
        : typeof r.title === "string" && r.title.trim().length > 0
          ? r.title
          : "Training",
    createdAt: typeof r.created_at === "string" ? r.created_at : null,
    takeCount:
      typeof r.take_count === "number" && Number.isFinite(r.take_count)
        ? r.take_count
        : takes.length,
    takes,
    batchVerified: r.batch_verified === true,
    idealReady: r.ideal_ready === true,
    bestPresentationArcId:
      typeof r.best_presentation_arc_id === "string" &&
      r.best_presentation_arc_id.length > 0
        ? r.best_presentation_arc_id
        : r.arc_id,
  };
}

/** Fetch the arc-grouped trainings. null = endpoint missing / error → the
 *  caller falls back to the legacy strengths-fed view. */
export async function fetchTrainings(): Promise<TrainingArc[] | null> {
  const token = await getAuthToken();
  if (!token) return null;

  let res: Response;
  try {
    res = await fetch("/api/v2/user/trainings", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return null;
  const list = Array.isArray(body.trainings)
    ? body.trainings
    : Array.isArray(body.arcs)
      ? body.arcs
      : null;
  if (!list) return null;
  return list.map(mapArc).filter((a): a is TrainingArc => !!a);
}
