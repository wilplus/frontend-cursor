import { getAuthToken } from "@/lib/api/auth-client";
import {
  mapSlide,
  type BestPresentationSlide,
} from "./bestPresentation";

/* -------------------------------------------------------------------------- */
/*  arcBatch — the explicit "Publish arc" batch action + the student batch view */
/*  (R4-10/11, BE-A). Safe-ahead: both endpoints 404 until the BE ships; every  */
/*  call soft-fails to a calm state (null / not-delivered).                     */
/*                                                                            */
/*  Fences: the batch payload carries NO say_it_stronger (synonyms are          */
/*  instant-view only) and its ideal text is the coach-EDITED composition (L1). */
/*  `direction` may arrive on snippets but is a PRIVATE training label (AC-9)   */
/*  — parsed defensively, NEVER rendered to the student.                        */
/* -------------------------------------------------------------------------- */

/* ------------------------------ publish (coach) --------------------------- */

export type PublishArcResult =
  | { kind: "ok"; takesPublished: number; deliveredAt: string | null }
  | { kind: "ideal_text_incomplete"; slidesPending: number[] }
  | { kind: "error"; status: number; message: string };

/** POST /v2/coach/arc/<id>/publish — publish every take's labelled snippets and
 *  mark the arc batch-delivered. 409 IDEAL_TEXT_INCOMPLETE = the coach must
 *  finish editing the ideal-text slides first (that ordering is intended). */
export async function publishArc(arcId: string): Promise<PublishArcResult> {
  const token = await getAuthToken();
  if (!token) {
    return { kind: "error", status: 401, message: "Sign in as a coach to publish." };
  }

  let res: Response;
  try {
    res = await fetch(`/api/v2/coach/arc/${encodeURIComponent(arcId)}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { kind: "error", status: 0, message: "Couldn't reach the server. Try again." };
  }

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  if (res.status === 409 && body?.code === "IDEAL_TEXT_INCOMPLETE") {
    const pending = Array.isArray(body.slides_pending)
      ? body.slides_pending.filter(
          (n): n is number => typeof n === "number" && Number.isFinite(n)
        )
      : [];
    return { kind: "ideal_text_incomplete", slidesPending: pending };
  }
  if (!res.ok) {
    const msg =
      (typeof body?.error === "string" && body.error) ||
      `Publish failed (HTTP ${res.status}).`;
    return { kind: "error", status: res.status, message: msg };
  }
  return {
    kind: "ok",
    takesPublished:
      typeof body?.takes_published === "number" ? body.takes_published : 0,
    deliveredAt: typeof body?.delivered_at === "string" ? body.delivered_at : null,
  };
}

/* ------------------------------ batch (student) --------------------------- */

/** One coach-labelled snippet in the batch. Coach note + tag only — the batch
 *  view NEVER carries say_it_stronger (instant-only). */
export interface BatchSnippet {
  id: string;
  transcript: string;
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  coachNote: string | null;
  tag: "strong" | "to_work_on" | null;
}

export interface BatchTake {
  takeIndex: number;
  sessionId: string;
  snippets: BatchSnippet[];
}

export type ArcBatch =
  | { delivered: false }
  | {
      delivered: true;
      deliveredAt: string | null;
      takes: BatchTake[];
      idealSlides: BestPresentationSlide[];
    };

function mapBatchSnippet(raw: unknown): BatchSnippet | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0) return null;
  return {
    id: r.id,
    transcript: typeof r.transcript === "string" ? r.transcript : "",
    audioRef:
      typeof r.audio_ref === "string" && r.audio_ref.length > 0
        ? r.audio_ref
        : null,
    startOffsetMs:
      typeof r.start_offset_ms === "number" && Number.isFinite(r.start_offset_ms)
        ? r.start_offset_ms
        : 0,
    durationMs:
      typeof r.duration_ms === "number" && Number.isFinite(r.duration_ms)
        ? r.duration_ms
        : 0,
    coachNote:
      typeof r.coach_note === "string" && r.coach_note.trim().length > 0
        ? r.coach_note
        : null,
    tag: r.tag === "strong" || r.tag === "to_work_on" ? r.tag : null,
    // r.direction is deliberately dropped: private training label (AC-9).
  };
}

function mapBatchTake(raw: unknown): BatchTake | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string") return null;
  return {
    takeIndex: typeof r.take_index === "number" ? r.take_index : 0,
    sessionId: r.session_id,
    snippets: Array.isArray(r.snippets)
      ? r.snippets.map(mapBatchSnippet).filter((s): s is BatchSnippet => !!s)
      : [],
  };
}

/** GET /v2/explore/arc/<id>/batch — null on any failure (incl. the endpoint
 *  not shipped yet), {delivered:false} pre-publish. */
export async function fetchArcBatch(arcId: string): Promise<ArcBatch | null> {
  const token = await getAuthToken();
  if (!token) return null;

  let res: Response;
  try {
    res = await fetch(`/api/v2/explore/arc/${encodeURIComponent(arcId)}/batch`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return null;
  if (body.delivered !== true) return { delivered: false };

  const ideal =
    body.ideal_text && typeof body.ideal_text === "object"
      ? (body.ideal_text as Record<string, unknown>).slides
      : null;
  return {
    delivered: true,
    deliveredAt:
      typeof body.delivered_at === "string" ? body.delivered_at : null,
    takes: (Array.isArray(body.takes) ? body.takes : [])
      .map(mapBatchTake)
      .filter((t): t is BatchTake => !!t)
      .sort((a, b) => a.takeIndex - b.takeIndex),
    idealSlides: (Array.isArray(ideal) ? ideal : [])
      .map(mapSlide)
      .filter((s): s is BestPresentationSlide => !!s),
  };
}
