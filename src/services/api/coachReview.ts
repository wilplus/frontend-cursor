/* -------------------------------------------------------------------------- */
/*  coachReview — per-session review payload + per-snippet save (§B.2 / §B.3)  */
/*                                                                            */
/*  The shape the coach overlay reads (S.4 identity-stripped) and the two-     */
/*  lane write boundary the BE enforces (S.5):                                */
/*    Private lane → direction_label  (training_labels table)                  */
/*    User lane    → note / tag / surfaced (insights_payload)                  */
/*                                                                            */
/*  No cross-derivation: the FE sends each field independently and the BE      */
/*  persists them to separate tables (S.1.2 hard guarantee). Even when the     */
/*  same user gesture sets both, the request body sends them side-by-side and  */
/*  the BE handler dispatches one path per lane.                               */
/* -------------------------------------------------------------------------- */

import {
  mapReadoutFeatures,
  mapReadoutSlide,
  type ReadoutFeatures,
  type ReadoutSlide,
} from "@/components/willab/readout";
import { type Feeling } from "@/components/willab/willabFeelings";
import { type CoachVideoMeta } from "@/services/api/coachVideoMeta";

/** Append the Subsystem V capture fields to a coach-video upload form. The BFF
 *  re-emits every multipart entry, so these flow through to the BE untouched. */
function appendVideoMeta(form: FormData, meta: CoachVideoMeta): void {
  form.append("upload_idempotency_key", meta.idempotencyKey);
  if (meta.device) form.append("device", meta.device);
  if (meta.source) form.append("source", meta.source);
  if (meta.durationSec != null) form.append("duration", String(meta.durationSec));
}

import type { TernaryValue } from "./stateRatings";

export type CoachTag = "strong" | "to_work_on";

/* DirectionLabel ("threat" | "ambiguous" | "challenge") was REMOVED
 * 2026-08-07. The F2 direction construct is retired and must not surface
 * anywhere in the FE. Blind labeling now uses the state-generic ternary
 * instrument (services/api/stateRatings.ts) — yes / no / neutral plus a
 * separate `unrateable`, which is a different lane with its own endpoint and
 * its own save timing. */

/** Per-snippet coach authoring state — what's persisted, what's read back. */
export interface CoachSnippetState {
  note: string;
  /** THIS coach's own blind rating, so a rated snippet does not read as
   *  unanswered after a reload. Never another rater's — the BE scopes the
   *  read to the authenticated caller, because a second answer on screen
   *  anchors the next one and destroys inter-rater independence. */
  ratingValue: TernaryValue | null;
  ratingUnrateable: boolean;
  tag: CoachTag | null;
  surfaced: boolean;
  /** Per-snippet coach video (coach upload). Public URL or null. Authored
   *  whenever the coach has committed a definite rating on the snippet. */
  breakthroughVideoRef: string | null;
}

/** #190 — the coach-only acoustic verdict: a stress↔charisma needle
 *  (`potentiometer` -1..1; -1 = stress, +1 = charisma) plus whether the read
 *  fell outside the normal range (a "worth a listen" nudge). COACH-ONLY — never
 *  rendered on any user surface (it is a verdict, not the reference vector). */
export interface AcousticRead {
  /** -1..1, clamped. Left = stress, right = charisma. */
  potentiometer: number;
  outsideNormalRange: boolean;
  /** FE-7 — what the needle was measured against: the speaker's own history
   *  ("user"), within this take ("take"), or — for a re-read — its parent
   *  take's distribution ("parent_take"). null on older packets. */
  baseline: "user" | "take" | "parent_take" | null;
}

/** Identity-stripped snippet payload (§S.4). NO control/salience score, NO
 *  best/worst flag, NO KPI, NO prior AI direction verdict. */
export interface CoachReviewSnippet {
  id: string;
  index: number;
  transcript: string;
  audioRef: string | null;
  startOffsetMs: number;
  durationMs: number;
  stickiness: {
    composite: number | null;
    comment: string | null;
  };
  /** User-lane acoustic 11-vector (§B.1) — REFERENCE only, the same data the
   *  user sees on their Readout. NOT a verdict, NOT the private direction/KPI/
   *  salience lane; AC-9-safe (nothing new reaches a user surface). The coach
   *  interprets it; the system renders no judgment over it. Null if the BE
   *  packet omits it (defensive — older sessions, partial payloads). */
  features: ReadoutFeatures | null;
  /** The slide on screen when this snippet started (BE-mapped from the tap
   *  timeline) — coach reference, same slide the user sees. null when no deck. */
  slide: ReadoutSlide | null;
  /** AI-Commentator draft (§C1 / BE Prompt 2). Generated at process time,
   *  frozen — never overwritten by coach edits so the (draft,final) diff
   *  survives for the comment-clone corpus. null = AI didn't produce one. */
  aiDraftNote: string | null;
  /** #190 — the coach-only stress↔charisma verdict (needle + worth-a-listen).
   *  null when the packet omits it. NEVER user-facing. */
  acousticRead: AcousticRead | null;
  /** #190 — the machine's qualitative comment (acoustic tone only). Coach-only
   *  reference; the tone wording comes from the BE (never FE-synthesized).
   *  #191 — now null by default (the coach writes from scratch); kept for
   *  back-compat / older packets. */
  autoComment: string | null;
  /** #191 — whether this snippet is the spoken take ("spoken") or a re-read of a
   *  piece's corrected text ("read"). Labels the coach card. null = unknown
   *  (older packets) → treated as spoken. */
  recordingKind: "spoken" | "read" | null;
  /** FP-5 / BE-2 — the parent take (take_session_id) this snippet belongs to. A
   *  re-read carries the id of the take it corrects, so the coach reviews it
   *  inside that take's flow instead of as a stray session. null on older
   *  packets. */
  takeSessionId: string | null;
  coachState: CoachSnippetState;
}

/** Pre-recording feeling captured before a take. Coach-only — AC-9. */
export interface SessionFeeling {
  feeling: Feeling;
  takeIndex: number | null;
  capturedAt: string;
}

/** Per-session review payload (§S.4). Identity is pseudonym + domain only. */
export interface CoachReviewSession {
  sessionId: string;
  pseudonym: string;
  domain: string;
  topic: string;
  sentAt: string;
  state: "pending" | "in_progress" | "done";
  overallMessage: string;
  videoRef: string | null;
  /** The session's served deck PDF, for rendering each snippet's slide page.
   *  null when no deck was attached. */
  presentationRef: string | null;
  snippets: CoachReviewSnippet[];
  /** Pre-recording feelings (BE #108) — newest-first from feelings[]. Coach-only. */
  feelings: SessionFeeling[];
  /** FE-B — a persisted, unapproved ideal-text draft exists for this session's
   *  arc: the coach's cue to open, review, approve, and publish. */
  arcIdealReady: boolean;
  /** The session's arc (rides with arc_ideal_ready); null on older payloads. */
  arcId: string | null;
}

/** What the FE sends per per-snippet save. Any subset of fields. The BE
 *  validates: note requires tag; tag standalone is OK; direction is
 *  independent. Echoes back the persisted state for confirmation. */
export interface CoachSnippetSavePatch {
  note?: string;
  tag?: CoachTag | null;
  surfaced?: boolean;
  /** Set a public URL to attach a breakthrough video; null (or "") to clear. */
  breakthroughVideoRef?: string | null;
}

/* ─── parsers (snake → camel) ───────────────────────────────────────────── */

function pickRating(raw: unknown): TernaryValue | null {
  return raw === "yes" || raw === "no" || raw === "neutral" ? raw : null;
}

function pickTag(raw: unknown): CoachTag | null {
  if (raw === "strong" || raw === "to_work_on") return raw;
  return null;
}

function pickCoachState(raw: unknown): CoachSnippetState {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    note: typeof r.note === "string" ? r.note : "",
    ratingValue: pickRating(r.rating_value),
    ratingUnrateable: r.rating_unrateable === true,
    tag: pickTag(r.tag),
    surfaced: r.surfaced === true,
    breakthroughVideoRef:
      typeof r.breakthrough_video_ref === "string" &&
      r.breakthrough_video_ref.length > 0
        ? r.breakthrough_video_ref
        : null,
  };
}

/** #190 — the coach-only acoustic verdict. Requires a finite potentiometer;
 *  clamps it to -1..1. null when absent/malformed (older packets). */
function pickAcousticRead(raw: unknown): AcousticRead | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const p = r.potentiometer;
  if (typeof p !== "number" || !Number.isFinite(p)) return null;
  return {
    potentiometer: Math.max(-1, Math.min(1, p)),
    outsideNormalRange: r.outside_normal_range === true,
    baseline:
      r.baseline === "user" || r.baseline === "take" || r.baseline === "parent_take"
        ? r.baseline
        : null,
  };
}

function pickFeeling(raw: unknown): SessionFeeling | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const f = r.feeling;
  if (f !== "nervous" && f !== "excited" && f !== "calm" && f !== "unsure") return null;
  return {
    feeling: f,
    takeIndex: typeof r.take_index === "number" ? r.take_index : null,
    capturedAt: typeof r.captured_at === "string" ? r.captured_at : "",
  };
}

function pickSnippet(raw: unknown): CoachReviewSnippet | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const stickiness = (r.stickiness ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    index: typeof r.index === "number" ? r.index : 0,
    transcript: typeof r.transcript === "string" ? r.transcript : "",
    audioRef:
      typeof r.audio_ref === "string"
        ? r.audio_ref
        : typeof r.audioRef === "string"
        ? r.audioRef
        : null,
    startOffsetMs:
      typeof r.start_offset_ms === "number" ? r.start_offset_ms : 0,
    durationMs: typeof r.duration_ms === "number" ? r.duration_ms : 0,
    stickiness: {
      composite:
        typeof stickiness.composite === "number" ? stickiness.composite : null,
      comment:
        typeof stickiness.comment === "string" ? stickiness.comment : null,
    },
    // §B.1 acoustic vector — present-only (null when the BE packet omits it),
    // mapped through the SAME snake→camel parser the user Readout uses.
    features:
      r.features && typeof r.features === "object"
        ? mapReadoutFeatures(r.features)
        : null,
    slide: mapReadoutSlide(r.slide),
    aiDraftNote: (() => {
      const coachStateRaw = (r.coach_state ?? {}) as Record<string, unknown>;
      const v = coachStateRaw.ai_draft_coach_note;
      return typeof v === "string" && v.length > 0 ? v : null;
    })(),
    // #190 — coach-only acoustic verdict + machine tone comment.
    acousticRead: pickAcousticRead(r.acoustic_read),
    autoComment:
      typeof r.auto_comment === "string" && r.auto_comment.length > 0
        ? r.auto_comment
        : null,
    // #191 — spoken take vs re-read; anything but "read" → spoken.
    recordingKind:
      r.recording_kind === "read"
        ? "read"
        : r.recording_kind === "spoken"
        ? "spoken"
        : null,
    // FP-5 / BE-2 — the parent take this snippet belongs to.
    takeSessionId:
      typeof r.take_session_id === "string" && r.take_session_id.length > 0
        ? r.take_session_id
        : null,
    coachState: pickCoachState(r.coach_state),
  };
}

export function mapCoachReviewSession(
  raw: unknown
): CoachReviewSession | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.session_id !== "string") return null;
  const state = r.state;
  return {
    sessionId: r.session_id,
    pseudonym: typeof r.pseudonym === "string" ? r.pseudonym : "",
    domain: typeof r.domain === "string" ? r.domain : "",
    topic: typeof r.topic === "string" ? r.topic : "",
    sentAt: typeof r.sent_at === "string" ? r.sent_at : "",
    state:
      state === "pending" || state === "in_progress" || state === "done"
        ? state
        : "pending",
    overallMessage:
      typeof r.overall_message === "string" ? r.overall_message : "",
    videoRef: typeof r.video_ref === "string" ? r.video_ref : null,
    presentationRef:
      typeof r.presentation_ref === "string" && r.presentation_ref.length > 0
        ? r.presentation_ref
        : null,
    // FP-5 — re-reads (BE-2) are appended by the BE AFTER the spoken take and
    // must stay in that append order: they're revealed by "Next" at the tail of
    // the parent take's flow, never sorted back among the spoken snippets they
    // correct. So we slide-order the spoken snippets only and keep the reads in
    // their BE tail position. (Older packets have no reads → identical result.)
    snippets: (() => {
      const parsed = Array.isArray(r.snippets)
        ? r.snippets
            .map(pickSnippet)
            .filter((s): s is CoachReviewSnippet => s !== null)
        : [];
      const spoken = parsed.filter((s) => s.recordingKind !== "read");
      const reads = parsed.filter((s) => s.recordingKind === "read");
      spoken.sort(
        (a, b) => (a.slide?.index ?? Infinity) - (b.slide?.index ?? Infinity)
      );
      return [...spoken, ...reads];
    })(),
    feelings: Array.isArray(r.feelings)
      ? r.feelings.map(pickFeeling).filter((f): f is SessionFeeling => f !== null)
      : [],
    arcIdealReady: r.arc_ideal_ready === true,
    arcId:
      typeof r.arc_id === "string" && r.arc_id.length > 0 ? r.arc_id : null,
  };
}

/* ─── fetch + save ──────────────────────────────────────────────────────── */

/** Fetch the per-session review payload. Returns null on any failure so
 *  the overlay can render an error state cleanly. */
export async function fetchCoachReviewSession(
  sessionId: string
): Promise<CoachReviewSession | null> {
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}`,
      { credentials: "include", cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return mapCoachReviewSession(data);
}

/** Upload a coach video for the session (§B.5 / §F.6). Multipart
 *  pass-through; BE reuses its user-video transport (storage bucket,
 *  MIME whitelist, size limits). Returns the persisted `video_ref` so
 *  the FE can update `CoachReviewSession.videoRef` and render the
 *  preview without a session refetch. */
export async function uploadCoachVideo(
  sessionId: string,
  file: File,
  meta: CoachVideoMeta
): Promise<string | null> {
  const form = new FormData();
  form.append("video_file", file, file.name || "video.webm");
  appendVideoMeta(form, meta);
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(sessionId)}/video`,
      {
        method: "POST",
        body: form,
        credentials: "include",
      }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return null;
  const ref = (data as Record<string, unknown>).video_ref;
  return typeof ref === "string" ? ref : null;
}

/** Upload a per-snippet breakthrough video (coach authoring). Mirrors
 *  uploadCoachVideo: multipart pass-through, returns the persisted public URL
 *  so the caller can save it via saveCoachSnippet({ breakthroughVideoRef }).
 *  The BE upload endpoint is Phase 2; until it ships this soft-fails to null
 *  and the caller surfaces a retry. */
export async function uploadBreakthroughVideo(
  sessionId: string,
  snippetId: string,
  file: File,
  meta: CoachVideoMeta
): Promise<string | null> {
  const form = new FormData();
  form.append("video_file", file, file.name || "breakthrough.webm");
  appendVideoMeta(form, meta);
  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(
        sessionId
      )}/snippets/${encodeURIComponent(snippetId)}/breakthrough-video`,
      { method: "POST", body: form, credentials: "include" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  // FE-5 — the BE now echoes the authoritative coach_state alongside; prefer
  // the ref inside it, then the older top-level shapes.
  const cs =
    d.coach_state && typeof d.coach_state === "object"
      ? (d.coach_state as Record<string, unknown>)
      : null;
  const ref =
    cs?.breakthrough_video_ref ?? d.breakthrough_video_ref ?? d.video_ref ?? d.public_url;
  return typeof ref === "string" && ref.length > 0 ? ref : null;
}

/** Save a per-snippet patch. Returns the persisted state on success
 *  (echo from BE) or null on failure. This is the USER-FACING lane only —
 *  `note`/`tag`/`surfaced` to `insights_payload`. The blind rating lane is
 *  services/api/stateRatings.ts and never rides on this patch. */
export async function saveCoachSnippet(
  sessionId: string,
  snippetId: string,
  patch: CoachSnippetSavePatch
): Promise<CoachSnippetState | null> {
  const body: Record<string, unknown> = {};
  if (patch.note !== undefined) body.note = patch.note;
  if (patch.tag !== undefined) body.tag = patch.tag;
  if (patch.surfaced !== undefined) body.surfaced = patch.surfaced;
  if (patch.breakthroughVideoRef !== undefined)
    body.breakthrough_video_ref = patch.breakthroughVideoRef;

  let res: Response;
  try {
    res = await fetch(
      `/api/v2/coach/sessions/${encodeURIComponent(
        sessionId
      )}/snippets/${encodeURIComponent(snippetId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return null;
  // BE echoes the persisted coach_state for confirmation.
  return pickCoachState((data as Record<string, unknown>).coach_state ?? data);
}
