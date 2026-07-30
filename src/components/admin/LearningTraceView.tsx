"use client";

/**
 * Presentational components for /admin/learning — the developer
 * learning-trace (backlog item 11). Developer-facing tone throughout; this
 * surface is admin-only and NEVER user/coach-visible (AC-9 / BLIND COACH).
 *
 * No chart lib on purpose: styled divs + tiny inline SVG (single-series
 * sparkline, single-hue bar rows). Data marks use one blue; orange is
 * reserved for decision-point badges (always with a text label, never
 * color-alone). Text stays in neutral ink, never the series color.
 */

import type {
  AgreementWeek,
  CoefficientRow,
  Coefficients,
  ExportRun,
  KnownGap,
  ModelVersionRow,
  PipelineLane,
  TraceError,
} from "./learningTrace";
import { fmtDate, fmtNum, fmtPct } from "./learningTrace";

const SERIES_BLUE = "#2a78d6"; // validated vs light surface (dataviz palette)

/* ── primitives ─────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="min-w-[130px] flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2.5">
      <p className="text-[12px] text-neutral-500">{label}</p>
      <p className="mt-0.5 text-[20px] font-semibold tabular-nums text-neutral-900">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-[11px] text-neutral-500">{sub}</p> : null}
    </div>
  );
}

export function DecisionBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
      <span aria-hidden>◆</span>
      {label}
    </span>
  );
}

/** Single-series sparkline (agreement over time). Native <title> tooltips
 *  per point; the adjacent table row of numbers is the accessible fallback. */
export function Sparkline({
  points,
  width = 220,
  height = 48,
}: {
  points: AgreementWeek[];
  width?: number;
  height?: number;
}) {
  if (!points.length) return null;
  const pad = 6;
  const xs = (i: number) =>
    points.length === 1
      ? width / 2
      : pad + (i * (width - 2 * pad)) / (points.length - 1);
  const ys = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    return height - pad - clamped * (height - 2 * pad);
  };
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p.agreement).toFixed(1)}`)
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Shadow agreement by week"
      className="shrink-0"
    >
      {/* recessive 50% guide */}
      <line
        x1={pad}
        x2={width - pad}
        y1={ys(0.5)}
        y2={ys(0.5)}
        stroke="#e5e5e5"
        strokeDasharray="3 3"
      />
      <path d={path} fill="none" stroke={SERIES_BLUE} strokeWidth={2} strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.week} cx={xs(i)} cy={ys(p.agreement)} r={2.5} fill={SERIES_BLUE}>
          <title>{`${p.week}: ${fmtPct(p.agreement)} (n=${p.n})`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Horizontal single-hue bar rows for a {label: count} breakdown. */
export function BarRows({
  data,
  title,
  max = 8,
}: {
  data: Record<string, number> | undefined | null;
  title: string;
  max?: number;
}) {
  const entries = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    return (
      <div>
        <p className="text-[12px] font-medium text-neutral-600">{title}</p>
        <p className="mt-1 text-[12px] text-neutral-400">no rows yet</p>
      </div>
    );
  }
  const shown = entries.slice(0, max);
  const rest = entries.slice(max).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) shown.push(["(other)", rest]);
  const top = Math.max(...shown.map(([, v]) => v), 1);
  return (
    <div>
      <p className="text-[12px] font-medium text-neutral-600">{title}</p>
      <div className="mt-1.5 space-y-1">
        {shown.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2" title={`${k}: ${v}`}>
            <span className="w-40 truncate text-right text-[12px] text-neutral-600">
              {k}
            </span>
            <span className="h-3 flex-1 rounded-sm bg-neutral-100">
              <span
                className="block h-3 rounded-sm"
                style={{
                  width: `${Math.max(2, (v / top) * 100)}%`,
                  backgroundColor: SERIES_BLUE,
                }}
              />
            </span>
            <span className="w-12 text-[12px] tabular-nums text-neutral-700">
              {fmtNum(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── pipeline stage flow ─────────────────────────────────────────────── */

export function StageFlow({ lane }: { lane: PipelineLane }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <h3 className="text-[14px] font-semibold text-neutral-900">{lane.title}</h3>
      {lane.corpus ? (
        <p className="mt-0.5 font-mono text-[11px] text-neutral-500">
          corpus: {lane.corpus}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-y-2">
        {lane.stages.map((s, i) => (
          <span key={`${lane.id}-${i}`} className="flex items-center">
            {i > 0 ? (
              <span aria-hidden className="mx-1.5 text-neutral-300">
                →
              </span>
            ) : null}
            <span
              className={
                "inline-flex flex-col rounded-md border px-2 py-1 " +
                (s.decision_point
                  ? "border-orange-300 bg-orange-50"
                  : "border-neutral-200 bg-neutral-50")
              }
              title={s.file || undefined}
            >
              <span className="text-[12px] text-neutral-800">{s.stage}</span>
              {s.decision_point ? <DecisionBadge label="decision point" /> : null}
              {s.file ? (
                <span className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-neutral-400">
                  {s.file}
                </span>
              ) : null}
            </span>
          </span>
        ))}
      </div>
      {lane.fence ? (
        <p className="mt-3 text-[11px] text-neutral-500">
          <span className="font-semibold text-neutral-600">fence:</span> {lane.fence}
        </p>
      ) : null}
    </div>
  );
}

/* ── tables ─────────────────────────────────────────────────────────── */

const TH = "px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-neutral-500";
const TD = "px-2 py-1.5 text-[12px] text-neutral-800";

/** Coefficients sorted by |weight| — how each of the 11 acoustic features
 *  pulls the shadow model. Sign lives in the number (+/−), magnitude in the
 *  bar, so no diverging palette is needed. */
export function CoefficientsTable({ coefficients }: { coefficients: Coefficients }) {
  if (!coefficients?.per_feature?.length) {
    return (
      <p className="text-[12px] text-neutral-400">
        No loadable model artifact — metrics-only view (coefficients appear once a
        joblib artifact is reachable).
      </p>
    );
  }
  const rows: CoefficientRow[] = [...coefficients.per_feature].sort(
    (a, b) => b.weight_abs_max - a.weight_abs_max
  );
  const top = Math.max(...rows.map((r) => r.weight_abs_max), 1e-9);
  const classes = coefficients.classes ?? [];
  const weightCols =
    classes.length === 2 ? [classes[1]] : classes.length ? classes : ["weight"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className={TH}>feature</th>
            {weightCols.map((c) => (
              <th key={c} className={TH}>
                w → {c}
              </th>
            ))}
            <th className={TH}>|w|</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.feature} className="border-b border-neutral-100">
              <td className={`${TD} font-mono text-[11px]`}>{r.feature}</td>
              {weightCols.map((c) => {
                const w = r.weights[c] ?? Object.values(r.weights)[0] ?? 0;
                return (
                  <td key={c} className={`${TD} tabular-nums`}>
                    {w > 0 ? "+" : ""}
                    {w.toFixed(3)}
                  </td>
                );
              })}
              <td className={`${TD} w-40`}>
                <span className="block h-2.5 rounded-sm bg-neutral-100">
                  <span
                    className="block h-2.5 rounded-sm"
                    style={{
                      width: `${Math.max(2, (r.weight_abs_max / top) * 100)}%`,
                      backgroundColor: SERIES_BLUE,
                    }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {coefficients.note ? (
        <p className="mt-1.5 text-[11px] text-neutral-400">{coefficients.note}</p>
      ) : null}
    </div>
  );
}

export function ModelVersionsTable({ rows }: { rows: ModelVersionRow[] }) {
  if (!rows.length)
    return <p className="text-[12px] text-neutral-400">no model versions yet</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className={TH}>version</th>
            <th className={TH}>status</th>
            <th className={TH}>corpus</th>
            <th className={TH}>accuracy</th>
            <th className={TH}>f1 macro</th>
            <th className={TH}>created</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = (r.metrics ?? {}) as Record<string, unknown>;
            const acc = typeof m.accuracy === "number" ? m.accuracy.toFixed(3) : "—";
            const f1 = typeof m.f1_macro === "number" ? m.f1_macro.toFixed(3) : "—";
            return (
              <tr key={r.version ?? Math.random()} className="border-b border-neutral-100">
                <td className={`${TD} font-mono text-[11px]`}>{r.version ?? "—"}</td>
                <td className={TD}>
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
                    {r.status ?? "—"}
                  </span>
                </td>
                <td className={`${TD} tabular-nums`}>{fmtNum(r.corpus_size ?? null)}</td>
                <td className={`${TD} tabular-nums`}>{acc}</td>
                <td className={`${TD} tabular-nums`}>{f1}</td>
                <td className={`${TD} tabular-nums`}>{fmtDate(r.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ExportRunsTable({ rows }: { rows: ExportRun[] }) {
  if (!rows.length)
    return <p className="text-[12px] text-neutral-400">no export runs yet</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className={TH}>started</th>
            <th className={TH}>status</th>
            <th className={TH}>exported</th>
            <th className={TH}>failed</th>
            <th className={TH}>by</th>
            <th className={TH}>sink</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id ?? r.started_at} className="border-b border-neutral-100">
              <td className={`${TD} tabular-nums`}>{fmtDate(r.started_at)}</td>
              <td className={TD}>
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-[11px] " +
                    (r.status === "success"
                      ? "bg-neutral-100 text-neutral-700"
                      : "bg-orange-50 text-orange-700")
                  }
                >
                  {r.status ?? "—"}
                </span>
              </td>
              <td className={`${TD} tabular-nums`}>{fmtNum(r.exported_count ?? null)}</td>
              <td className={`${TD} tabular-nums`}>{fmtNum(r.failed_count ?? null)}</td>
              <td className={`${TD} font-mono text-[11px]`}>{r.created_by ?? "—"}</td>
              <td className={`${TD} max-w-[200px] truncate font-mono text-[11px]`}>
                {r.export_uri ?? r.error_text ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── known gaps + errors ────────────────────────────────────────────── */

export function KnownGapsList({ gaps }: { gaps: KnownGap[] }) {
  if (!gaps.length) return null;
  return (
    <ul className="space-y-2">
      {gaps.map((g) => (
        <li key={g.id} className="rounded-md border border-neutral-200 bg-white p-3">
          <p className="font-mono text-[11px] text-neutral-500">{g.id}</p>
          <p className="mt-0.5 text-[13px] text-neutral-800">{g.summary}</p>
          {g.file ? (
            <p className="mt-0.5 font-mono text-[11px] text-neutral-400">{g.file}</p>
          ) : null}
          {g.status ? (
            <p className="mt-0.5 text-[11px] text-neutral-500">status: {g.status}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function SectionErrors({ errors }: { errors: TraceError[] }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-md border border-orange-300 bg-orange-50 p-3">
      <p className="text-[12px] font-medium text-orange-700">
        {errors.length} section{errors.length > 1 ? "s" : ""} failed to load
        (rendered as blanks below)
      </p>
      <ul className="mt-1 space-y-0.5">
        {errors.map((e) => (
          <li key={e.section} className="font-mono text-[11px] text-orange-700">
            {e.section}: {e.error}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── lane card shell ────────────────────────────────────────────────── */

export function LaneCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
      <h2 className="text-[16px] font-semibold text-neutral-900">{title}</h2>
      {subtitle ? (
        <p className="mt-0.5 text-[12px] text-neutral-500">{subtitle}</p>
      ) : null}
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}
