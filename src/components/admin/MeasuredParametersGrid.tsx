"use client";

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScalar(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Math.abs(v) >= 1e6 || (Math.abs(v) > 0 && Math.abs(v) < 1e-4)) return v.toExponential(2);
    return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

type Props = {
  /** Raw `measured_metrics` from student profile (backend JSON). */
  measured_metrics: unknown;
};

/**
 * Card grid for admin student profile — mirrors the “Measured parameters” pattern;
 * prefers `latest` when the payload is an object with that key.
 */
export default function MeasuredParametersGrid({ measured_metrics }: Props) {
  if (measured_metrics == null) {
    return (
      <p className="text-sm text-muted-foreground">
        No measured parameters yet. They appear when the backend attaches <code className="text-xs">measured_metrics</code> to
        this student.
      </p>
    );
  }

  if (typeof measured_metrics !== "object" || Array.isArray(measured_metrics)) {
    return <p className="text-sm text-muted-foreground">Measured parameters are in an unexpected format.</p>;
  }

  const obj = measured_metrics as Record<string, unknown>;
  const latestRaw = obj.latest;
  const latest =
    latestRaw != null && typeof latestRaw === "object" && !Array.isArray(latestRaw)
      ? (latestRaw as Record<string, unknown>)
      : null;

  const metaChips: { label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === "latest") continue;
    if (v == null) continue;
    const t = typeof v;
    if (t === "object") continue;
    if (t !== "string" && t !== "number" && t !== "boolean") continue;
    metaChips.push({ label: humanizeKey(k), value: formatScalar(v) });
  }

  const metricEntries = latest
    ? Object.entries(latest).filter(([, v]) => v != null)
    : Object.entries(obj).filter(([k, v]) => {
        if (k === "latest") return false;
        if (v == null) return false;
        const t = typeof v;
        return t === "string" || t === "number" || t === "boolean";
      });

  if (metricEntries.length === 0 && metaChips.length === 0) {
    return <p className="text-sm text-muted-foreground">Measured metrics payload is empty.</p>;
  }

  return (
    <div className="space-y-4">
      {metaChips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {metaChips.map(({ label, value }) => (
            <span key={label} className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
              {label}: <span className="font-medium text-foreground">{value}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metricEntries.map(([key, val]) => (
          <div key={key} className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground leading-tight">{humanizeKey(key)}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums break-all">{formatScalar(val)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
