/* -------------------------------------------------------------------------- */
/*  The exercise learning jar on the founder's pace panel (founder 2026-09-30, */
/*  B8: "gaps and jar become ledger rows on the founder's pace panel"; C9:     */
/*  the ledger holds the jar and the per-exercise counts; E9: the bar of 300   */
/*  attempts and 30 per exercise stays, with a descriptive view). Pure.       */
/*                                                                            */
/*  Two reads, kept apart on purpose, as they were on the retired /cms/jar    */
/*  page (decisions 5 and 7, 2026-09-29):                                     */
/*                                                                            */
/*    the jar         COUNTS ONLY: how close the data is to its bar, per      */
/*                    exercise, and why renders were left out. Read from the  */
/*                    ledger's `exercise_jar` (services/exercise_learning_    */
/*                    readiness.readiness, already on GET /v2/admin/learning/ */
/*                    ledger). This mapper reads no outcome.                  */
/*    the evaluation  sealed until the bar is met, then two piles that never  */
/*                    mix (machine picks only; with coach picks). Read from  */
/*                    the ledger route's top-level `jar_evaluation`           */
/*                    (services/exercise_evaluation.evaluate_jar). Absent     */
/*                    until the backend serves it, and then nothing renders. */
/*                                                                            */
/*  Every number is about the machine and its exercises, never a person, and */
/*  the page is the founder's alone (AC-9 for everyone else). A source the   */
/*  backend could not read is unknown, never zero.                           */
/* -------------------------------------------------------------------------- */

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function rate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/* ── the jar: counts only ───────────────────────────────────────────────── */

export type JarSource = "exposures" | "assignments" | "match_traces" | "practices" | "attempts";
const JAR_SOURCES: readonly string[] = ["exposures", "assignments", "match_traces", "practices", "attempts"];

/** Why a render was left out, in the order the backend's checks run
 *  (services/exercise_learning_readiness.EXCLUSIONS). */
export const JAR_EXCLUSIONS = [
  "untraced", "fallback", "no_targeted_problem", "rules_changed", "repeat",
  "below_minimum_probability", "no_attempt", "no_valid_attempt",
] as const;
export type JarExclusion = (typeof JAR_EXCLUSIONS)[number];

export interface JarExercise {
  exerciseId: string;
  /** Confirmed renders of this exercise. */
  exposures: number;
  /** Renders that entered the cohort (first exposure per targeted problem). */
  cohort: number;
  /** Cohort renders with a valid endpoint attempt: what counts toward 30. */
  counted: number;
  /** The per-exercise bar. */
  needed: number;
}

export interface ExerciseJar {
  bar: { minCounted: number; minPerExercise: number };
  exposures: number;
  cohort: number;
  counted: number;
  /** counted / cohort, or null while the cohort is empty. */
  attemptRate: number | null;
  /** Every reason the backend reported, known or not, in its order. */
  excluded: { reason: string; renders: number }[];
  /** How the counted practices were chosen (top, exploration, a singleton, a coach). */
  countedBySelectionMode: Record<string, number>;
  exercises: JarExercise[];
  ready: boolean;
  whyNot: string | null;
  unavailable: JarSource[];
  versions: { labelSpec: string; readiness: string; signalRules: string; noiseGate: string };
}

function mapCounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(record(raw))) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = Math.max(0, value);
  }
  return out;
}

function mapJarExercise(raw: unknown): JarExercise | null {
  const r = record(raw);
  if (typeof r.exercise_id !== "string" || !r.exercise_id) return null;
  return {
    exerciseId: r.exercise_id,
    exposures: count(r.exposures),
    cohort: count(r.cohort),
    counted: count(r.counted),
    needed: count(r.needed) || 30,
  };
}

/** The known reasons first in the backend's order, then any new one it adds;
 *  only reasons with a render behind them. */
function mapExcluded(raw: unknown): ExerciseJar["excluded"] {
  const counts = mapCounts(raw);
  const known = JAR_EXCLUSIONS.filter((reason) => (counts[reason] ?? 0) > 0);
  const other = Object.keys(counts).filter(
    (reason) => !(JAR_EXCLUSIONS as readonly string[]).includes(reason) && counts[reason] > 0,
  );
  return [...known, ...other].map((reason) => ({ reason, renders: counts[reason] }));
}

/** `ledger.exercise_jar`, or null when the ledger carries none (an older
 *  backend, or a ledger that could not read it: then `unavailable` says so). */
export function mapExerciseJar(raw: unknown): ExerciseJar | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  if (!("counted" in d) && !Array.isArray(d.exercises)) return null;
  const bar = record(d.bar);
  return {
    bar: { minCounted: count(bar.min_counted) || 300, minPerExercise: count(bar.min_per_exercise) || 30 },
    exposures: count(d.exposures),
    cohort: count(d.cohort),
    counted: count(d.counted),
    attemptRate: rate(d.attempt_rate),
    excluded: mapExcluded(d.excluded),
    countedBySelectionMode: mapCounts(d.counted_by_selection_mode),
    exercises: (Array.isArray(d.exercises) ? d.exercises : [])
      .map(mapJarExercise)
      .filter((e): e is JarExercise => e !== null),
    ready: d.ready === true,
    whyNot: text(d.why_not) || null,
    unavailable: (Array.isArray(d.unavailable) ? d.unavailable : [])
      .filter((v): v is JarSource => typeof v === "string" && JAR_SOURCES.includes(v)),
    versions: {
      labelSpec: text(d.label_spec_version),
      readiness: text(d.readiness_version),
      signalRules: text(d.signal_rules_version),
      noiseGate: text(d.noise_gate_version),
    },
  };
}

/** A count, or null when the source behind it could not be read: the panel
 *  then says unknown, never a zero that reads as a measurement. */
export function jarCount(value: number, source: JarSource, unavailable: readonly JarSource[]): number | null {
  return unavailable.includes(source) ? null : value;
}

/* ── the evaluation: sealed until the bar, then two piles ───────────────── */

export type JarPile = "machine_only" | "with_coach_picks";
export const JAR_PILES: readonly JarPile[] = ["machine_only", "with_coach_picks"];

export interface JarScoreRow {
  exerciseId: string;
  counted: number;
  helped: number;
  /** helped / counted, or null with nothing counted. */
  helpedRate: number | null;
}

export interface JarScoreboard {
  counted: number;
  helped: number;
  helpedRate: number | null;
  exercises: JarScoreRow[];
  bySelectionMode: Record<string, { counted: number; helped: number; helpedRate: number | null }>;
}

export interface JarFairTest {
  meetsBar: boolean;
  whyNot: string[];
  /** Exam-group exposures the candidate was graded on. */
  holdout: { exposures: number; speakers: number; candidateAgrees: number };
  candidate: { attemptRate: number | null; successRate: number | null };
  baseline: { attemptRate: number | null; successRate: number | null };
  successGain: number | null;
  successGainInterval95: [number, number] | null;
  attemptRateChange: number | null;
}

export interface JarPreference {
  exerciseId: string;
  counted: number;
  helped: number;
  helpedRate: number | null;
  /** Above the per-exercise bar of study-group labels: the rate is used. */
  trusted: boolean;
}

export interface JarPileEvaluation {
  scoreboard: JarScoreboard;
  candidate: { version: string; learnedFrom: { labels: number; speakers: number }; preferences: JarPreference[] };
  fairTest: JarFairTest;
}

export interface JarEvaluation {
  sealed: boolean;
  whyNot: string | null;
  /** Always true from the backend; read fail-closed. */
  requiresFounderApproval: boolean;
  /** Always false from the backend: nothing here promotes. */
  promotes: boolean;
  versions: { evaluation: string; candidate: string; fairTest: string; scorekeeper: string };
  /** Present only when unsealed. */
  piles: Record<JarPile, JarPileEvaluation> | null;
  coachPickLabels: number;
}

function mapRates(raw: unknown): { attemptRate: number | null; successRate: number | null } {
  const r = record(raw);
  return { attemptRate: rate(r.attempt_rate), successRate: rate(r.success_rate) };
}

function mapScoreRow(raw: unknown): JarScoreRow | null {
  const x = record(raw);
  if (typeof x.exercise_id !== "string" || !x.exercise_id) return null;
  return { exerciseId: x.exercise_id, counted: count(x.counted), helped: count(x.helped), helpedRate: rate(x.helped_rate) };
}

function mapScoreboard(raw: unknown): JarScoreboard {
  const r = record(raw);
  const modes: JarScoreboard["bySelectionMode"] = {};
  for (const [mode, value] of Object.entries(record(r.by_selection_mode))) {
    const v = record(value);
    modes[mode] = { counted: count(v.counted), helped: count(v.helped), helpedRate: rate(v.helped_rate) };
  }
  return {
    counted: count(r.counted),
    helped: count(r.helped),
    helpedRate: rate(r.helped_rate),
    exercises: (Array.isArray(r.exercises) ? r.exercises : [])
      .map(mapScoreRow)
      .filter((row): row is JarScoreRow => row !== null),
    bySelectionMode: modes,
  };
}

function mapInterval(raw: unknown): [number, number] | null {
  return Array.isArray(raw) && raw.length === 2 && raw.every((v) => typeof v === "number" && Number.isFinite(v))
    ? [raw[0] as number, raw[1] as number]
    : null;
}

function mapFairTest(raw: unknown): JarFairTest {
  const r = record(raw);
  const h = record(r.holdout);
  return {
    meetsBar: r.meets_bar === true,
    whyNot: (Array.isArray(r.why_not) ? r.why_not : []).filter((v): v is string => typeof v === "string"),
    holdout: { exposures: count(h.exposures), speakers: count(h.speakers), candidateAgrees: count(h.candidate_agrees) },
    candidate: mapRates(r.candidate),
    baseline: mapRates(r.baseline),
    successGain: rate(r.success_gain),
    successGainInterval95: mapInterval(r.success_gain_interval_95),
    attemptRateChange: rate(r.attempt_rate_change),
  };
}

function mapPreference(raw: unknown): JarPreference | null {
  const row = mapScoreRow(raw);
  return row ? { ...row, trusted: record(raw).trusted === true } : null;
}

function mapPile(raw: unknown): JarPileEvaluation {
  const r = record(raw);
  const c = record(r.candidate);
  const learned = record(c.learned_from);
  return {
    scoreboard: mapScoreboard(r.scoreboard),
    candidate: {
      version: text(c.version),
      learnedFrom: { labels: count(learned.labels), speakers: count(learned.speakers) },
      preferences: (Array.isArray(c.preferences) ? c.preferences : [])
        .map(mapPreference)
        .filter((row): row is JarPreference => row !== null),
    },
    fairTest: mapFairTest(r.fair_test),
  };
}

/** The ledger route's `jar_evaluation`, or null while the backend serves
 *  none. Fail closed: anything but an explicit `sealed: false` is sealed. */
export function mapJarEvaluation(raw: unknown): JarEvaluation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  const sealed = d.sealed !== false;
  return {
    sealed,
    whyNot: text(d.why_not) || null,
    requiresFounderApproval: d.requires_founder_approval !== false,
    promotes: d.promotes === true,
    versions: {
      evaluation: text(d.evaluation_version),
      candidate: text(d.candidate_version),
      fairTest: text(d.fair_test_version),
      scorekeeper: text(d.scorekeeper_version),
    },
    piles: sealed ? null : { machine_only: mapPile(d.machine_only), with_coach_picks: mapPile(d.with_coach_picks) },
    coachPickLabels: count(d.coach_pick_labels),
  };
}
