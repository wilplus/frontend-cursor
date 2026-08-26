import type {
  LoungeMessage,
  LoungeMessageDraft,
} from "@/services/api/loungeMessages";

/* -------------------------------------------------------------------------- */
/*  loungeReports — Readout / Insight reports as durable thread entries        */
/*                                                                            */
/*  Reports persist in the Lounge thread (kinds `recording_summary` / `insight`)│
/*  so a user can scroll back to every past Readout and coach Insight. The      */
/*  FE appends the Readout summary when a recording completes; the BE appends    */
/*  the Insight on coach publish (handoff). The metadata carries the renderable │
/*  fields — the hero pair (§5) is optional until seam ③ populates real metrics.*/
/* -------------------------------------------------------------------------- */

export const REPORT_KINDS = ["recording_summary", "insight"] as const;

export const TAKE_PROCESSED_BODY =
  "Take processed. Your Ideal Text was kept unchanged.";
export const IDEAL_TEXT_UNCONFIRMED_BODY =
  "We processed your take, but couldn’t create your Ideal Text.";

export function isReportMessage(m: Pick<LoungeMessage, "kind">): boolean {
  return m.kind === "recording_summary" || m.kind === "insight";
}

/** Build the Readout-summary draft appended to the thread on completion. */
export function readoutSummaryDraft(input: {
  topic: string;
  recordingId?: string;
  /** The take's session id — makes the card open its own readout (slides +
   *  per-slide transcript) via ReportCard.onOpenReadout, even pre-coach. */
  sessionId?: string;
  /** The explore arc this take belongs to — persisted on the message so the
   *  "View your best presentation" bubble stays clickable across logout/login
   *  (and any other device) without depending on localStorage. */
  arcId?: string;
  /** The take number for this recording (explore takes only) — shown on the
   *  "Your Recording" card. */
  takeIndex?: number;
  /** C7 — the feeling named for this take, stamped here so the post-recording
   *  joke offer reads a per-take value (never a stale global). */
  feeling?: string;
  speechRate?: number; // §3.3 features.speech_rate (hero)
  pauseRatio?: number; // §3.3 features.pause_ratio (hero)
}): LoungeMessageDraft {
  return {
    role: "system",
    kind: "recording_summary",
    body: `Readout · ${input.topic}`,
    // Inline object literal so it satisfies Record<string, unknown>.
    metadata: {
      report_type: "readout",
      recording_id: input.recordingId,
      session_id: input.sessionId,
      arc_id: input.arcId,
      take_index: input.takeIndex,
      topic: input.topic,
      feeling: input.feeling,
      speech_rate: input.speechRate,
      pause_ratio: input.pauseRatio,
    },
  };
}

/** A later take completed without replacing the canonical Ideal Text.
 *
 *  The take session UUID is also the Lounge client id. It is the one stable
 *  identity shared by the worker and every browser observer, so a reconnect,
 *  a retry, and a backend/frontend race all upsert the same terminal card. */
export function takeProcessedDraft(input: {
  sessionId: string;
  arcId: string;
  takeIndex: number;
}): LoungeMessageDraft {
  return {
    clientId: input.sessionId,
    role: "bot",
    kind: "ideal_text",
    body: TAKE_PROCESSED_BODY,
    metadata: {
      variant: "take_processed",
      arc_id: input.arcId,
      take_session_id: input.sessionId,
      take_index: input.takeIndex,
    },
  };
}

/** Take 1's analysis persisted, but its canonical document was not confirmed.
 *  The session UUID matches the backend writer, so timeout, reconnect, and
 *  repeated retries converge on one durable terminal card. */
export function idealTextUnconfirmedDraft(input: {
  sessionId: string;
  arcId: string;
  takeIndex?: 1;
}): LoungeMessageDraft {
  return {
    clientId: input.sessionId,
    role: "bot",
    kind: "ideal_text",
    body: IDEAL_TEXT_UNCONFIRMED_BODY,
    metadata: {
      variant: "ideal_text_unconfirmed",
      arc_id: input.arcId,
      take_session_id: input.sessionId,
      take_index: input.takeIndex ?? 1,
      actions: ["retry_ideal_text", "view_take_feedback"],
    },
  };
}

/* ----------------------------- render accessors --------------------------- */
/*  Read report metadata defensively (it crosses the wire as Record<unknown>). */

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export interface ReadoutView {
  topic: string | null;
  takeIndex: number | null;
  speechRate: number | null;
  pauseRatio: number | null;
}
export interface InsightView {
  overallMessage: string | null;
  noteCount: number | null;
  /** topic + takeIndex for the "Feedback on …" card line. The BE must add
   *  `topic` + `take_index` to the insight message metadata for these to
   *  populate; null until then (the card omits the missing parts). */
  topic: string | null;
  takeIndex: number | null;
}

export function readoutView(
  md: Record<string, unknown> | null | undefined,
): ReadoutView {
  const m = md ?? {};
  return {
    topic: str(m.topic),
    takeIndex: num(m.take_index),
    speechRate: num(m.speech_rate),
    pauseRatio: num(m.pause_ratio),
  };
}

export function insightView(
  md: Record<string, unknown> | null | undefined,
): InsightView {
  const m = md ?? {};
  return {
    overallMessage: str(m.overall_message),
    noteCount: num(m.note_count),
    topic: str(m.topic),
    takeIndex: num(m.take_index),
  };
}

export interface BestPresentationView {
  /** The arc to open in BestPresentationOverlay; null → card not openable. */
  arcId: string | null;
  topic: string | null;
}

/** Read the best_presentation_ready card metadata (BE-inserted at the 3rd take). */
export function bestPresentationView(
  md: Record<string, unknown> | null | undefined,
): BestPresentationView {
  const m = md ?? {};
  return { arcId: str(m.arc_id), topic: str(m.topic) };
}
