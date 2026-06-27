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
  speechRate: number | null; // HERO — raw wpm
  speechRatePct: number | null; // HERO — % of 125-wpm reference, e.g. 143
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

/** Phase 2 — the slide on screen during this snippet, mapped BE-side from the
 *  tap timeline (greatest t_ms ≤ start_offset_ms). `index` → the PDF page;
 *  title/body are the slide text (the text-card fallback). null = no deck. */
export interface ReadoutSlide {
  index: number;
  title: string;
  body: string;
}

/** The COMPLETE 1:1 transcript of everything said while a given deck slide was
 *  on screen (BE slide_transcripts — the whole-recording word list bucketed by
 *  the tap timeline, one entry per deck slide; empty transcript is valid = the
 *  slide had no speech). Drives the per-deck-slide readout pagination so the
 *  quiet first slide is never dropped. start/duration are the slide's span in
 *  the parent recording, for "play this slide" playback. */
export interface ReadoutSlideTranscript {
  index: number;
  transcript: string;
  startOffsetMs: number;
  durationMs: number;
}

export interface ReadoutSnippet {
  id: string;
  startOffsetMs: number;
  durationMs: number;
  transcript: string;
  audioRef: string | null;
  features: ReadoutFeatures;
  stickiness: ReadoutStickiness;
  /** Rank within the slide (1 = best); null when the BE doesn't rank readout
   *  snippets. Used to pick the slide's single top moment. */
  rank: number | null;
  /** Blended quality (`power_score`, else `overall_score`); null when absent. */
  powerScore: number | null;
  coach: ReadoutCoach | null;
  /** Phase 2 — the slide delivered during this snippet; null when no deck. */
  slide: ReadoutSlide | null;
  /** True when this snippet's challenge take followed a threat snippet — the
   *  moment stress flipped into charisma. Show the breakthrough button. */
  breakthrough: boolean;
  /** Short plain-language "why" text; render verbatim. Null until BE sends it. */
  breakthroughNote: string | null;
  /** Per-snippet breakthrough video (`breakthrough_video_ref`). A ready-to-use
   *  public URL the BE attaches to the breakthrough moment; null until shipped
   *  (BE field pending — see the BE handoff). Distinct from the session-level
   *  insights_payload.video_ref. */
  breakthroughVideoRef: string | null;
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
  /** Phase 2 — the session's served deck PDF (presentation_ref), used to render
   *  the per-snippet slide page. null when no deck was attached. */
  presentationRef: string | null;
  /** The deck's slides (index/title/body), in deck order. Used so the readout
   *  can page per DECK SLIDE (incl. slides with no salient snippet). [] = none. */
  slides: ReadoutSlide[];
  /** The complete per-slide 1:1 transcripts. Present → the readout paginates
   *  per deck slide (slide + its full transcript); [] → fall back to the
   *  per-snippet pagination (older recordings). */
  slideTranscripts: ReadoutSlideTranscript[];
  /** BE `voice_metrics_available` — false when the take had no usable acoustic
   *  signal (too quiet / empty). The readout then shows a soft notice in place
   *  of the metrics block instead of empty PITCH/PACE/VOLUME rows. Defaults to
   *  true (absent → render metrics as today). */
  voiceMetricsAvailable: boolean;
  /** Phase-1 pricing — false on an unpaid arc (teaser scope: the BE withholds
   *  written commentary + extra videos + ideal text). The readout then shows the
   *  "unlock the full audit" CTA. Defaults to true (absent → full, unlocked). */
  auditPaid: boolean;
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
  const speechRate = num(f.speech_rate);
  return {
    f0Mean: num(f.f0_mean),
    f0Sd: num(f.f0_sd),
    speechRate,
    speechRatePct:
      num(f.speech_rate_pct) ??
      (speechRate !== null ? Math.round((speechRate / 125) * 100) : null),
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
    rank: num(r.rank),
    powerScore: num(r.power_score) ?? num(r.overall_score),
    coach: mapCoach(r.coach),
    slide: mapReadoutSlide(r.slide),
    breakthrough: typeof r.breakthrough === "boolean" ? r.breakthrough : false,
    breakthroughNote:
      typeof r.breakthrough_note === "string" && r.breakthrough_note.length > 0
        ? r.breakthrough_note
        : null,
    breakthroughVideoRef:
      typeof r.breakthrough_video_ref === "string" &&
      r.breakthrough_video_ref.length > 0
        ? r.breakthrough_video_ref
        : null,
  };
}

/** Phase 2 — the slide delivered during this snippet (BE-mapped). Requires a
 *  numeric index; title/body default to "". Exported so the coach-review parser
 *  reuses the SAME shape (the coach sees the same slide the user does). */
export function mapReadoutSlide(raw: unknown): ReadoutSlide | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const index = num(s.index);
  if (index === null) return null;
  return { index, title: str(s.title), body: str(s.body) };
}

/** Map one complete per-slide transcript entry (BE slide_transcripts). Requires
 *  a numeric index; transcript may be "" (valid — the slide had no speech). */
export function mapReadoutSlideTranscript(
  raw: unknown
): ReadoutSlideTranscript | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const index = num(s.index);
  if (index === null) return null;
  return {
    index,
    transcript: str(s.transcript),
    startOffsetMs: int(s.start_offset_ms),
    durationMs: int(s.duration_ms),
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
  const slides = Array.isArray(r.slides)
    ? r.slides
        .map(mapReadoutSlide)
        .filter((s): s is ReadoutSlide => s !== null)
    : [];
  const slideTranscripts = Array.isArray(r.slide_transcripts)
    ? r.slide_transcripts
        .map(mapReadoutSlideTranscript)
        .filter((s): s is ReadoutSlideTranscript => s !== null)
        .sort((a, b) => a.index - b.index)
    : [];
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
    presentationRef: pickPresentationRef(r, insights),
    slides,
    slideTranscripts,
    // Only false when the BE explicitly says so; absent / anything else → true
    // (render metrics as today).
    voiceMetricsAvailable: r.voice_metrics_available !== false,
    // Only false on an explicitly unpaid arc; absent → true (full/unlocked).
    auditPaid: r.audit_paid !== false,
  };
}

/** Phase 2 — the session deck PDF. The BE may surface it top-level, under
 *  insights_payload, or under session_context; read all three defensively. */
function pickPresentationRef(
  r: Record<string, unknown>,
  insights: Record<string, unknown>
): string | null {
  const candidates = [
    r.presentation_ref,
    insights.presentation_ref,
    obj(r.session_context).presentation_ref,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

/* ----------------------------- slide grouping ----------------------------- */

/** Design B — snippets collapsed onto the slide they were delivered on. */
export interface ReadoutSlideGroup {
  /** slide.index, or null for the trailing "general" (no-slide) group. */
  slideIndex: number | null;
  slide: ReadoutSlide | null;
  snippets: ReadoutSnippet[];
}

/** Group snippets by their slide so the readout shows one slide + all of its
 *  spoken moments stacked chronologically (Design B), instead of one screen per
 *  snippet. Real slides sort by page index; snippets within a group sort by
 *  start offset (defensive — BE already returns capture order). Snippets with no
 *  slide collect into a single trailing null group. Pure for testability. */
export function groupSnippetsBySlide(
  snippets: ReadoutSnippet[]
): ReadoutSlideGroup[] {
  const byKey = new Map<number | null, ReadoutSlideGroup>();
  for (const s of snippets) {
    const key = s.slide ? s.slide.index : null;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.slide && s.slide) existing.slide = s.slide;
      existing.snippets.push(s);
    } else {
      byKey.set(key, { slideIndex: key, slide: s.slide, snippets: [s] });
    }
  }
  const groups = [...byKey.values()];
  groups.sort((a, b) => {
    if (a.slideIndex === null) return 1;
    if (b.slideIndex === null) return -1;
    return a.slideIndex - b.slideIndex;
  });
  for (const g of groups) {
    g.snippets.sort((x, y) => x.startOffsetMs - y.startOffsetMs);
  }
  return groups;
}

/** Is `a` a better "top moment" than `b`? Precedence: lower rank, then higher
 *  powerScore, then higher stickiness, then earlier start. A present value
 *  always beats a null one at each level. */
function snippetBetter(a: ReadoutSnippet, b: ReadoutSnippet): boolean {
  if (a.rank !== b.rank) {
    if (a.rank === null) return false;
    if (b.rank === null) return true;
    return a.rank < b.rank;
  }
  if (a.powerScore !== b.powerScore) {
    if (a.powerScore === null) return false;
    if (b.powerScore === null) return true;
    return a.powerScore > b.powerScore;
  }
  const ac = a.stickiness.composite;
  const bc = b.stickiness.composite;
  if (ac !== bc) {
    if (ac === null) return false;
    if (bc === null) return true;
    return ac > bc;
  }
  return a.startOffsetMs < b.startOffsetMs;
}

/** The single best moment among a slide's snippets — so the readout shows ONE
 *  coach comment per slide, not one per salient snippet. Pure for testability. */
export function pickTopSnippet(
  snippets: ReadoutSnippet[]
): ReadoutSnippet | null {
  if (snippets.length === 0) return null;
  return snippets.reduce((best, s) => (snippetBetter(s, best) ? s : best));
}

/* ------------------------------ back gesture ------------------------------ */

export type ReadoutBackAction =
  | { type: "collapse"; key: string }
  | { type: "page" }
  | { type: "close" };

/** Decide what one Back/swipe-back does inside the readout: collapse the most
 *  recently expanded moment ON THE CURRENT slide, else page to the previous
 *  slide, else (first slide, nothing expanded) close. Pure for testability;
 *  the component applies the action. `expandedOrder` is the open moment keys in
 *  the order they were opened; `currentKeys` are the keys on the visible slide. */
export function decideReadoutBack(
  cursor: number,
  expandedOrder: string[],
  currentKeys: string[]
): ReadoutBackAction {
  const onPage = new Set(currentKeys);
  for (let i = expandedOrder.length - 1; i >= 0; i--) {
    if (onPage.has(expandedOrder[i])) {
      return { type: "collapse", key: expandedOrder[i] };
    }
  }
  if (cursor > 0) return { type: "page" };
  return { type: "close" };
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
      speechRatePct: Math.round((speechRate / 125) * 100),
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
    rank: null,
    powerScore: null,
    coach: null,
    slide: null,
    breakthrough: false,
    breakthroughNote: null,
    breakthroughVideoRef: null,
  });
  return {
    overallMessage: null,
    videoRef: null,
    presentationRef: null,
    slides: [],
    slideTranscripts: [],
    voiceMetricsAvailable: true,
    auditPaid: true,
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
