"use client";

type SniperMetrics = {
  wpm?: number | null;
  pause_ms?: number | null;
  dynamic_db?: number | null;
  emphasis_per_min?: number | null;
  energy_ratio?: number | null;
  pitch_center_st?: number | null;
  pitch_frame_count?: number | null;
};

type Session = {
  created_at: string;
  sniper_metrics?: SniperMetrics | null;
  recording_preview?: { words_per_minute?: number | null } | null;
};

type Props = {
  sessions: Session[];
};

function fmt(v: number | null | undefined, decimals: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(decimals);
}

type MetricCard = {
  label: string;
  value: string;
  hint?: string;
};

export default function LatestSessionMetrics({ sessions }: Props) {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Most recent session with sniper_metrics
  const latestSniper = sorted.find((s) => s.sniper_metrics != null);
  // Most recent session with WPM fallback (recording_preview)
  const latestWpmFallback = sorted.find((s) => s.recording_preview?.words_per_minute != null);

  const sm = latestSniper?.sniper_metrics ?? null;
  const sessionDate = latestSniper
    ? new Date(latestSniper.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const wpm =
    sm?.wpm != null
      ? fmt(sm.wpm, 0)
      : latestWpmFallback?.recording_preview?.words_per_minute != null
        ? fmt(latestWpmFallback.recording_preview.words_per_minute, 0)
        : "—";

  const cards: MetricCard[] = [
    { label: "WPM", value: wpm },
    { label: "Avg pause (ms)", value: fmt(sm?.pause_ms, 0) },
    { label: "Dynamic range (dB)", value: fmt(sm?.dynamic_db, 1) },
    { label: "Emphasis / min", value: fmt(sm?.emphasis_per_min, 2) },
    { label: "Energy ratio", value: fmt(sm?.energy_ratio, 3) },
    {
      label: "Pitch center (st)",
      value: fmt(sm?.pitch_center_st, 1),
      hint:
        sm?.pitch_frame_count != null
          ? `${sm.pitch_frame_count} frames`
          : undefined,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {sessionDate ? `From session on ${sessionDate}` : "No sniper session recorded yet — metrics will appear after the first completed session."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, hint }) => (
          <div key={label} className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${value === "—" ? "text-muted-foreground" : ""}`}>
              {value}
            </p>
            {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
