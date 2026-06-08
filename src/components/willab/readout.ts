/* -------------------------------------------------------------------------- */
/*  readout — the §5 Readout payload (BE §3.3 contract), camelCased            */
/*                                                                            */
/*  BE sends snake_case; `mapReadoutPayload` is the defensive snake→camel       */
/*  boundary so the component never touches wire shapes. Parent-audio +         */
/*  offset-window model: each snippet carries its `audioRef` + offset window     */
/*  (start_offset_ms / duration_ms) for MediaPlayer. Every metric is            */
/*  number | null — a missing feature renders as "—", never as 0.             */
/* -------------------------------------------------------------------------- */

export interface ReadoutFeatures {
  f0Mean: number | null;
  f0Sd: number | null;
  speechRate: number | null; // HERO
  meanPause: number | null;
  pauseRatio: number | null; // HERO
  loudnessRange: number | null;
  voicedRatio: number | null;
  f0Slope: number | null; // derived (dynamics)
  pauseRegularity: number | null; // derived
  intensityEnvelope: number | null; // derived
  f0MidEndDelta: number | null; // derived
}

export interface ReadoutStickiness {
  composite: number | null;
  comment: string | null;
}

export type CoachTag = "strong" | "to_work_on";

/** Coach's user-facing note on a snippet — POST-PUBLISH ONLY (§14 user lane;
 *  the private direction label never crosses into this). */
export interface ReadoutCoach {
  note: string;
  tag: CoachTag | null;
  /** §6b coaching guidance — "when/how to use this" (`when`) + "E.g." example
   *  lines (`examples`). Additive (post-corrections), coaching not prescription;
   *  null / [] until the coach authors them. */
  when: string | null;
  examples: string[];
}

export interface ReadoutSnippet {
  id: string;
  startOffsetMs: number;
  durationMs: number;
  transcript: string;
  audioRef: string | null;
  features: ReadoutFeatures;
  stickiness: ReadoutStickiness;
  coach: ReadoutCoach | null;
}

export interface ReadoutPayload {
  snippets: ReadoutSnippet[];
  /** insights_payload.overall_message — post-publish only; null on the raw Readout. */
  overallMessage: string | null;
  /** insights_payload.video_ref — the OVERALL coach video (§F.6), a sibling of
   *  overall_message, NOT per-snippet. A ready-to-use public URL
   *  (`coach_media_public_url`) the BE folds into insights_payload at publish
   *  time. Present only on sessions published after a coach video upload;
   *  null otherwise → hide-when-empty, same as overallMessage. A session
   *  published before the coach added a video won't carry one until re-publish. */
  videoRef: string | null;
}

/* ------------------------------- mapper ----------------------------------- */

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function int(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Snake→camel for the acoustic 11-vector. Exported so the coach-review parser
 *  (coachReview.ts) reuses the SAME map — including the `mean_pause_seconds`
 *  unit contract — instead of duplicating it (C1: coach sees the same data). */
export function mapReadoutFeatures(raw: unknown): ReadoutFeatures {
  const f = obj(raw);
  return {
    f0Mean: num(f.f0_mean),
    f0Sd: num(f.f0_sd),
    speechRate: num(f.speech_rate),
    // BE-2: the unit contract is baked into the field name now —
    // `mean_pause_seconds` (BE locked seconds, ending the ms↔s ping-pong).
    // Read it directly; no /1000, no ambiguity.
    meanPause: num(f.mean_pause_seconds),
    pauseRatio: num(f.pause_ratio),
    loudnessRange: num(f.loudness_range),
    voicedRatio: num(f.voiced_ratio),
    f0Slope: num(f.f0_slope),
    pauseRegularity: num(f.pause_regularity),
    intensityEnvelope: num(f.intensity_envelope),
    f0MidEndDelta: num(f.f0_mid_end_delta),
  };
}

export function mapReadoutSnippet(raw: unknown): ReadoutSnippet {
  const r = obj(raw);
  const stick = obj(r.stickiness);
  return {
    id: str(r.id),
    startOffsetMs: int(r.start_offset_ms),
    durationMs: int(r.duration_ms),
    transcript: str(r.transcript),
    audioRef: typeof r.audio_ref === "string" ? r.audio_ref : null,
    features: mapReadoutFeatures(r.features),
    stickiness: {
      composite: num(stick.composite),
      comment: typeof stick.comment === "string" ? stick.comment : null,
    },
    coach: mapCoach(r.coach),
  };
}

/** Map the post-publish coach block; null when absent or empty (pre-publish). */
function mapCoach(raw: unknown): ReadoutCoach | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const note = typeof c.note === "string" ? c.note : "";
  const tag =
    c.tag === "strong" || c.tag === "to_work_on" ? (c.tag as CoachTag) : null;
  const when = typeof c.when === "string" && c.when.length > 0 ? c.when : null;
  const examples = Array.isArray(c.examples)
    ? c.examples.filter(
        (e): e is string => typeof e === "string" && e.length > 0
      )
    : [];
  if (!note && !tag && !when && examples.length === 0) return null;
  return { note, tag, when, examples };
}

export function mapReadoutPayload(raw: unknown): ReadoutPayload {
  const r = obj(raw);
  const snippets = Array.isArray(r.snippets) ? r.snippets : [];
  const insights = obj(r.insights_payload);
  return {
    snippets: snippets.map(mapReadoutSnippet),
    overallMessage:
      typeof insights.overall_message === "string"
        ? insights.overall_message
        : null,
    videoRef:
      typeof insights.video_ref === "string" && insights.video_ref.length > 0
        ? insights.video_ref
        : null,
  };
}

/* ------------------------------- dev mock --------------------------------- */
/*  Walkable sample data until seam ③ returns the real poll payload. Static
 *  values (no random/Date) so renders are deterministic. */
export function mockReadout(topic: string): ReadoutPayload {
  const snippet = (
    i: number,
    transcript: string,
    speechRate: number,
    pauseRatio: number,
    comment: string
  ): ReadoutSnippet => ({
    id: `sample-${i}`,
    startOffsetMs: 0,
    durationMs: 8000,
    transcript,
    audioRef: null,
    features: {
      f0Mean: 165,
      f0Sd: 28,
      speechRate,
      meanPause: 0.4,
      pauseRatio,
      loudnessRange: 14,
      voicedRatio: 0.71,
      f0Slope: -2,
      pauseRegularity: 0.6,
      intensityEnvelope: 0.5,
      f0MidEndDelta: -8,
    },
    stickiness: { composite: 0.72, comment },
    coach: null,
  });
  return {
    overallMessage: null,
    videoRef: null,
    snippets: [
      snippet(1, `Opening on ${topic}…`, 152, 0.28, "You set the frame and stayed on it."),
      snippet(
        2,
        "…and that's when I realized the whole approach had to change.",
        148,
        0.32,
        "You built on one idea instead of jumping around."
      ),
      snippet(3, "So the takeaway is simple.", 139, 0.25, "You landed the point cleanly."),
    ],
  };
}
