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

export type DirectionLabel = "threat" | "ambiguous" | "challenge";
export type CoachTag = "strong" | "to_work_on";

/** Per-snippet coach authoring state — what's persisted, what's read back. */
export interface CoachSnippetState {
  directionLabel: DirectionLabel | null;
  note: string;
  tag: CoachTag | null;
  surfaced: boolean;
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
  coachState: CoachSnippetState;
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
  snippets: CoachReviewSnippet[];
}

/** What the FE sends per per-snippet save. Any subset of fields. The BE
 *  validates: note requires tag; tag standalone is OK; direction is
 *  independent. Echoes back the persisted state for confirmation. */
export interface CoachSnippetSavePatch {
  directionLabel?: DirectionLabel | null;
  note?: string;
  tag?: CoachTag | null;
  surfaced?: boolean;
}

/* ─── parsers (snake → camel) ───────────────────────────────────────────── */

function pickDirection(raw: unknown): DirectionLabel | null {
  if (raw === "threat" || raw === "ambiguous" || raw === "challenge") return raw;
  return null;
}

function pickTag(raw: unknown): CoachTag | null {
  if (raw === "strong" || raw === "to_work_on") return raw;
  return null;
}

function pickCoachState(raw: unknown): CoachSnippetState {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    directionLabel: pickDirection(r.direction_label),
    note: typeof r.note === "string" ? r.note : "",
    tag: pickTag(r.tag),
    surfaced: r.surfaced === true,
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
    snippets: Array.isArray(r.snippets)
      ? r.snippets
          .map(pickSnippet)
          .filter((s): s is CoachReviewSnippet => s !== null)
      : [],
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
  file: File
): Promise<string | null> {
  const form = new FormData();
  form.append("video_file", file, file.name || "video.webm");
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

/** Save a per-snippet patch. Returns the persisted state on success
 *  (echo from BE) or null on failure. The two-lane split is preserved:
 *  the BE persists `direction_label` to `training_labels` and
 *  `note`/`tag`/`surfaced` to `insights_payload` in independent writes. */
export async function saveCoachSnippet(
  sessionId: string,
  snippetId: string,
  patch: CoachSnippetSavePatch
): Promise<CoachSnippetState | null> {
  const body: Record<string, unknown> = {};
  if (patch.directionLabel !== undefined)
    body.direction_label = patch.directionLabel;
  if (patch.note !== undefined) body.note = patch.note;
  if (patch.tag !== undefined) body.tag = patch.tag;
  if (patch.surfaced !== undefined) body.surfaced = patch.surfaced;

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
