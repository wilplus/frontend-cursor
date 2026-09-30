/* -------------------------------------------------------------------------- */
/*  The pace panel's arithmetic (founder 2026-09-30, C9; ML-4). Pure.          */
/*                                                                            */
/*  Every number here is about the machine: a count of pairs, of tries, of    */
/*  named moments, and the weeks to a bar at a rate. The backend measures the  */
/*  rate from its weekly snapshots; the slider lets the founder ask "and at    */
/*  N a week?" without the machine guessing. Founder-only page (AC-9 holds    */
/*  for everyone else).                                                       */
/* -------------------------------------------------------------------------- */

export interface PaceRow {
  jar: string;
  current: number | null;
  bar: number;
  observedRate: number | null;
  weeksToBar: number | null;
  /** Shadow cues only: the second bar, caught rate ≥ 0.8. */
  caughtRate: number | null;
  caughtBar: number | null;
  ready: boolean;
}

export interface LedgerWeek {
  weekStart: string;
  readyCues: string[];
  migrationDrafts: Record<string, { file: string; manifest_line: string; sql: string }>;
  exported: { surface: string; exported: number; why: string | null }[];
  updatedAt: string | null;
}

const JAR_LABELS: Record<string, string> = {
  "pairs.praise_line": "Praise lines (pairs)",
  "pairs.clearer_version": "Clearer versions (pairs)",
  "pairs.exercise_script": "Exercise scripts (pairs)",
  "exercise_jar.counted": "Exercise tries (the jar)",
};

export function jarLabel(jar: string): string {
  if (JAR_LABELS[jar]) return JAR_LABELS[jar];
  if (jar.startsWith("shadow_cues.")) return `Cue “${jar.slice("shadow_cues.".length)}” named by a coach`;
  return jar;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mapPaceRow(raw: unknown): PaceRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.jar !== "string") return null;
  return {
    jar: r.jar,
    current: num(r.current),
    bar: num(r.bar) ?? 0,
    observedRate: num(r.observed_rate),
    weeksToBar: num(r.weeks_to_bar),
    caughtRate: num(r.caught_rate),
    caughtBar: num(r.caught_bar),
    ready: r.ready === true,
  };
}

export function mapLedgerWeek(raw: unknown): LedgerWeek | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.week_start !== "string") return null;
  const exported = Array.isArray(r.exported) ? r.exported : [];
  return {
    weekStart: r.week_start,
    readyCues: Array.isArray(r.ready_cues) ? r.ready_cues.filter((c): c is string => typeof c === "string") : [],
    migrationDrafts: (r.migration_drafts && typeof r.migration_drafts === "object"
      ? r.migration_drafts
      : {}) as LedgerWeek["migrationDrafts"],
    exported: exported
      .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
      .map((e) => ({
        surface: String(e.surface ?? ""),
        exported: num(e.exported) ?? 0,
        why: typeof e.why === "string" ? e.why : null,
      })),
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : null,
  };
}

/** Whole weeks to the bar at `rate` a week; 0 at or past the bar; null
 *  when the rate is not positive or the count is unknown. */
export function weeksAt(current: number | null, bar: number, rate: number | null): number | null {
  if (current === null) return null;
  if (current >= bar) return 0;
  if (rate === null || rate <= 0) return null;
  return Math.ceil((bar - current) / rate);
}

/** The share of the bar reached, 0 to 1, for the meter. */
export function fill(current: number | null, bar: number): number {
  if (current === null || bar <= 0) return 0;
  return Math.max(0, Math.min(1, current / bar));
}

/** What the founder reads under a jar: the observed pace in words. */
export function paceLine(row: PaceRow): string {
  if (row.current === null) return "count unavailable this week";
  if (row.current >= row.bar) return "at the bar";
  if (row.observedRate === null) return "no pace yet: fewer than two weekly readings";
  if (row.observedRate <= 0) return `not moving (${formatRate(row.observedRate)} a week over the last readings)`;
  const weeks = row.weeksToBar ?? weeksAt(row.current, row.bar, row.observedRate);
  return `${formatRate(row.observedRate)} a week → about ${weeks} ${weeks === 1 ? "week" : "weeks"} to the bar`;
}

export function formatRate(rate: number): string {
  const rounded = Math.round(rate * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A sensible slider ceiling for "and at N a week?": at least ten, at most
 *  what would clear the bar in one week, rounded up to a clean number. */
export function sliderMax(row: PaceRow): number {
  const remaining = Math.max(row.bar - (row.current ?? 0), 10);
  const magnitude = 10 ** Math.floor(Math.log10(remaining));
  return Math.max(10, Math.ceil(remaining / magnitude) * magnitude);
}

/** The gap view (founder 2026-09-30, B8): which pattern needs an exercise
 *  filmed, and how many coach requests wait on it. Rode the retired
 *  /cms/gaps page; lives on the pace panel now so nothing is lost. */
export interface GapPattern {
  errorId: string;
  label: string;
  status: string;
  coverage: string;
  spotted: number | null;
  openCoachRequests: number | null;
  mainExercises: string[];
  secondaryExercises: string[];
}

export interface GapView {
  days: number;
  patterns: GapPattern[];
  nothingSpottedOpenRequests: number | null;
  unavailable: string[];
}

export function mapGapView(raw: unknown): GapView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const list = Array.isArray(r.patterns) ? r.patterns : [];
  return {
    days: num(r.days) ?? 30,
    patterns: list
      .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object")
      .map((p) => ({
        errorId: String(p.error_id ?? ""),
        label: String(p.label ?? p.error_id ?? ""),
        status: String(p.status ?? ""),
        coverage: String(p.coverage ?? ""),
        spotted: num(p.spotted),
        openCoachRequests: num(p.open_coach_requests),
        mainExercises: Array.isArray(p.main_exercises) ? p.main_exercises.map(String) : [],
        secondaryExercises: Array.isArray(p.secondary_exercises) ? p.secondary_exercises.map(String) : [],
      })),
    nothingSpottedOpenRequests: num(r.nothing_spotted_open_requests),
    unavailable: Array.isArray(r.unavailable) ? r.unavailable.map(String) : [],
  };
}

/** A count, or "unknown" when its source could not be read: never a zero that
 *  reads as a measurement. */
export function gapCount(value: number | null, source: string, unavailable: string[]): string {
  if (unavailable.includes(source) || value === null) return "unknown";
  return String(value);
}

const COVERAGE_WORDS: Record<string, string> = {
  no_exercise: "no exercise",
  trial_only: "trial only",
  covered: "covered",
  being_tested: "being tested",
  named_only: "named only",
};

export function coverageWord(coverage: string): string {
  return COVERAGE_WORDS[coverage] ?? coverage.replace(/_/g, " ");
}
