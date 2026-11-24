import { bffFetch } from "@/lib/api/bffFetch";
import { getAuthToken } from "@/lib/api/auth-client";
import { mapProjectDeletion, type ProjectDeletion } from "./projectDeletion";

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
  /** Delivery layer — true once this take's published feedback page exists. */
  feedbackAvailable: boolean;
  /** The Take's own generated review has finished processing. */
  reviewAvailable?: boolean;
  /** Inclusive one-based slides that were recorded in this Take. */
  recordedRange?: { startSlide: number; endSlide: number };
  /** The upload key the Take was sent with; null when it was made another
   *  way; undefined when the server does not say (before backend #1824).
   *  A Take kept on the phone reads it (backend N556 item 3). */
  uploadKey?: string | null;
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
  /** Delivery layer — the arc's cover image ref (the served deck PDF); null =
   *  render the mock cover. */
  coverRef: string | null;
  /** An open deletion request (P1, N8): the project is locked while set. */
  deletion: ProjectDeletion | null;
  /** Archived by its owner (N14): hidden from the project list, listed in
   *  Data & consent. Only sent when archived projects were asked for. */
  archived: boolean;
  /** When the project's newest Take was made (ISO); null = none or not
   *  sent. The project with the newest Take is the current one (N254). */
  lastTakeAt?: string | null;
  practiceCoverage?: { practised: number; total: number; unit: "slides" | "sections" };
}

type RecordedRange = NonNullable<TrainingTake["recordedRange"]>;

function mapRecordedRange(raw: unknown): RecordedRange | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { start_slide: first, end_slide: last } = raw as Record<string, unknown>;
  if (typeof first !== "number" || typeof last !== "number" ||
      !Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first) return undefined;
  return { startSlide: first, endSlide: last };
}

// An older server kept exact ranges on the latest Take of each slide group.
function legacyRecordedRanges(raw: unknown): Map<string, RecordedRange> {
  const ranges = new Map<string, RecordedRange>();
  if (!Array.isArray(raw)) return ranges;
  for (const entry of raw) {
    const range = mapRecordedRange(entry);
    if (range && typeof entry.latest_session_id === "string") ranges.set(entry.latest_session_id, range);
  }
  return ranges;
}

function mapTake(raw: unknown, legacyRanges: ReadonlyMap<string, RecordedRange>): TrainingTake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string" || r.session_id.length === 0) return null;
  const recordedRange = mapRecordedRange(r.recorded_range) ?? legacyRanges.get(r.session_id);
  return {
    sessionId: r.session_id,
    takeIndex: typeof r.take_index === "number" ? r.take_index : 0,
    createdAt: typeof r.created_at === "string" ? r.created_at : null,
    hasSlides: r.has_slides === true,
    feedbackAvailable: r.feedback_available === true,
    ...(recordedRange ? { recordedRange } : {}),
    ...(typeof r.review_available === "boolean" ? { reviewAvailable: r.review_available } : {}),
    ...("upload_key" in r
      ? { uploadKey: typeof r.upload_key === "string" && r.upload_key ? r.upload_key : null }
      : {}),
  };
}

function mapCoverage(raw: unknown): TrainingArc["practiceCoverage"] {
  const coverage = raw as Partial<NonNullable<TrainingArc["practiceCoverage"]>> | undefined;
  const practised = coverage?.practised;
  const total = coverage?.total;
  const unit = coverage?.unit;
  if (typeof practised !== "number" || typeof total !== "number" ||
      !Number.isInteger(practised) || !Number.isInteger(total) || practised < 0 || total < practised ||
      (unit !== "slides" && unit !== "sections")) return undefined;
  return { practised, total, unit };
}

function mapArc(raw: unknown): TrainingArc | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.arc_id !== "string" || r.arc_id.length === 0) return null;
  const coverage = mapCoverage(r.practice_coverage);
  const legacyRanges = legacyRecordedRanges(r.practice_chunks);
  const takes = (Array.isArray(r.takes) ? r.takes : [])
    .map((take: unknown) => mapTake(take, legacyRanges))
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
    coverRef:
      typeof r.cover_ref === "string" && r.cover_ref.length > 0
        ? r.cover_ref
        : typeof r.presentation_ref === "string" && r.presentation_ref.length > 0
          ? r.presentation_ref
          : null,
    deletion: mapProjectDeletion(r.deletion),
    archived: r.archived === true,
    lastTakeAt:
      typeof r.last_take_at === "string" && r.last_take_at ? r.last_take_at : null,
    ...(coverage ? { practiceCoverage: coverage } : {}),
  };
}

type TrainingsCacheEntry = { value: TrainingArc[]; cachedAt: number };

const TRAININGS_CACHE_MAX_AGE_MS = 15_000;
const cachedTrainings = new Map<string, TrainingsCacheEntry>();
const inFlightTrainings = new Map<string, Promise<TrainingArc[] | null>>();

function trainingsCacheKey(token: string, includeArchived: boolean): string {
  // The bearer token is an in-memory identity boundary. A new account, or a
  // refreshed token, can never read another account's project list.
  return `${token}\u0000${includeArchived ? "archived" : "active"}`;
}

/** Fetch the arc-grouped trainings. Concurrent and recent callers share the
 * authenticated result; failures are never cached. `force` is for live
 * processing/recovery reads that must see a newly completed Take. */
export async function fetchTrainings(
  {
    includeArchived = false,
    force = false,
  }: { includeArchived?: boolean; force?: boolean } = {},
): Promise<TrainingArc[] | null> {
  const token = await getAuthToken();
  if (!token) return null;
  const key = trainingsCacheKey(token, includeArchived);
  const cached = cachedTrainings.get(key);
  if (!force && cached && Date.now() - cached.cachedAt <= TRAININGS_CACHE_MAX_AGE_MS) {
    return cached.value;
  }
  const existing = inFlightTrainings.get(key);
  if (existing) return existing;

  const read = requestTrainings(includeArchived, key);
  inFlightTrainings.set(key, read);
  const clearInFlight = () => {
    if (inFlightTrainings.get(key) === read) inFlightTrainings.delete(key);
  };
  read.then(clearInFlight, clearInFlight);
  return read;
}

async function requestTrainings(
  includeArchived: boolean,
  cacheKey: string,
): Promise<TrainingArc[] | null> {
  const res = await bffFetch(
    includeArchived ? "/api/v2/user/trainings?include_archived=1" : "/api/v2/user/trainings",
    { cache: "no-store" },
  );
  if (res.kind !== "response" || !res.ok) return null;
  const body = res.body as Record<string, unknown> | null;
  if (!body) return null;
  const list = Array.isArray(body.trainings)
    ? body.trainings
    : Array.isArray(body.arcs)
      ? body.arcs
      : null;
  if (!list) return null;
  const value = list.map(mapArc).filter((a): a is TrainingArc => !!a);
  cachedTrainings.set(cacheKey, { value, cachedAt: Date.now() });
  return value;
}

/** Test-only reset for the page-scoped read cache. */
export function __resetTrainingsCacheForTests(): void {
  cachedTrainings.clear();
  inFlightTrainings.clear();
}
