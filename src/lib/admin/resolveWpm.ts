/**
 * Normalize spoken WPM from admin/session/report payloads.
 * Backend versions vary: words_per_minute, wpm, nested performance_metrics_v2, etc.
 */

export function coerceFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function wpmFromMetricsBlob(obj: unknown): number | null {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return null;
  const r = obj as Record<string, unknown>;
  return (
    coerceFiniteNumber(r.wpm) ??
    coerceFiniteNumber(r.words_per_minute) ??
    coerceFiniteNumber(r.wordsPerMinute) ??
    coerceFiniteNumber(r.pace_wpm) ??
    coerceFiniteNumber(r.paceWpm) ??
    coerceFiniteNumber(r.average_wpm) ??
    coerceFiniteNumber(r.speaking_rate_wpm)
  );
}

/** Student list row from GET /v2/admin/students/:id → sessions[]. */
export function resolveSessionRowWpm(session: Record<string, unknown>): number | null {
  const rp = session.recording_preview as Record<string, unknown> | undefined;
  const sm = session.sniper_metrics as Record<string, unknown> | undefined;
  return (
    coerceFiniteNumber(rp?.words_per_minute) ??
    coerceFiniteNumber(rp?.wpm) ??
    wpmFromMetricsBlob(rp?.performance_metrics_v2) ??
    coerceFiniteNumber(sm?.wpm) ??
    coerceFiniteNumber(session.words_per_minute) ??
    coerceFiniteNumber(session.wpm) ??
    wpmFromMetricsBlob(session.performance_metrics_v2)
  );
}

/** Full session report from admin report endpoint (aligns with homework report extras). */
export function resolveAdminReportWpm(report: Record<string, unknown> | null | undefined): number | null {
  if (!report) return null;
  const rec = report.recording as Record<string, unknown> | undefined;
  return (
    coerceFiniteNumber(report.words_per_minute) ??
    coerceFiniteNumber(report.wpm) ??
    coerceFiniteNumber(rec?.words_per_minute) ??
    coerceFiniteNumber(rec?.wpm) ??
    wpmFromMetricsBlob(report.performance_metrics_v2) ??
    wpmFromMetricsBlob(rec?.performance_metrics_v2) ??
    wpmFromMetricsBlob((report.recording_1 as Record<string, unknown> | undefined)?.performance_metrics_v2)
  );
}
