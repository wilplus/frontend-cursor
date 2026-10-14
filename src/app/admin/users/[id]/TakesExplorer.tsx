"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  TakesExplorer — every Take of one person with all its acoustic data        */
/*  (founder 2026-10-14). Admin only: these numbers never reach a speaker.     */
/*  Sort by any column, filter by project, kind, dates and a range on any      */
/*  measure, and open a Take to see each piece with every stored measure.      */
/* -------------------------------------------------------------------------- */

interface TakeRow {
  id: string;
  created_at: string | null;
  project: string;
  take_index: number | null;
  status: string | null;
  kind: string | null;
  duration_s: number | null;
  pieces: number;
  take: Record<string, number | null>;
  piece_means: Record<string, number | null>;
}

interface Piece {
  id: string;
  start_ms: number | null;
  duration_ms: number | null;
  type: string | null;
  transcript: string;
  values: Record<string, number | null>;
  metrics: Record<string, unknown>;
}

interface Baseline {
  features: Record<string, { mean?: number; sd?: number; n?: number }> | null;
  n_sessions: number | null;
  computed_at: string | null;
}

type Col = { key: string; label: string; get: (t: TakeRow) => number | string | null };

const COLS: Col[] = [
  { key: "created_at", label: "Date", get: (t) => t.created_at },
  { key: "project", label: "Project", get: (t) => t.project },
  { key: "take_index", label: "Take", get: (t) => t.take_index },
  { key: "kind", label: "Kind", get: (t) => t.kind },
  { key: "duration_s", label: "Length (s)", get: (t) => t.duration_s },
  { key: "pieces", label: "Pieces", get: (t) => t.pieces },
  { key: "wpm", label: "WPM", get: (t) => t.take.wpm },
  { key: "fillers", label: "Fillers", get: (t) => t.take.fillers },
  { key: "pause_ms", label: "Pause ms", get: (t) => t.take.pause_ms },
  { key: "dynamic_db", label: "Dynamic dB", get: (t) => t.take.dynamic_db },
  { key: "pitch_center", label: "Pitch center", get: (t) => t.take.pitch_center },
  { key: "energy", label: "Energy", get: (t) => t.take.energy },
  { key: "kpi_score", label: "KPI", get: (t) => t.take.kpi_score },
  { key: "f0_mean", label: "F0 mean", get: (t) => t.piece_means.f0_mean },
  { key: "f0_sd", label: "F0 SD", get: (t) => t.piece_means.f0_sd },
  { key: "f0_slope", label: "F0 slope", get: (t) => t.piece_means.f0_slope },
  { key: "pause_count", label: "Pauses / piece", get: (t) => t.piece_means.pause_count },
  { key: "pause_ratio", label: "Pause ratio", get: (t) => t.piece_means.pause_ratio },
  { key: "pause_regularity", label: "Pause regularity", get: (t) => t.piece_means.pause_regularity },
  { key: "voiced_ratio", label: "Voiced ratio", get: (t) => t.piece_means.voiced_ratio },
  { key: "emphasis_per_min", label: "Emphasis / min", get: (t) => t.piece_means.emphasis_per_min },
  { key: "energy_ratio", label: "Energy ratio", get: (t) => t.piece_means.energy_ratio },
  { key: "status", label: "Status", get: (t) => t.status },
];
const NUMERIC = COLS.filter((c) => !["created_at", "project", "kind", "status"].includes(c.key));

const fmt = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === "" ? "—"
    : typeof v === "number" ? (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(2)) : String(v);
const day = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—");

export default function TakesExplorer({ id }: { id: string }) {
  const [rows, setRows] = useState<TakeRow[] | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: "created_at", desc: true });
  const [f, setF] = useState({ project: "", kind: "", from: "", to: "", metric: "wpm", min: "", max: "" });
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v2/admin/people/${encodeURIComponent(id)}/takes`, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) return setError(b.error || `Could not load Takes (${r.status}).`);
        setRows(b.takes || []);
        setBaseline(b.baseline || null);
      })
      .catch(() => setError("Could not reach the server."));
  }, [id]);

  const projects = useMemo(() => [...new Set((rows || []).map((r) => r.project).filter(Boolean))].sort(), [rows]);
  const kinds = useMemo(() => [...new Set((rows || []).map((r) => r.kind).filter(Boolean) as string[])].sort(), [rows]);

  const shown = useMemo(() => {
    const metric = COLS.find((c) => c.key === f.metric)!;
    const min = f.min === "" ? null : Number(f.min);
    const max = f.max === "" ? null : Number(f.max);
    const list = (rows || []).filter((r) => {
      if (f.project && r.project !== f.project) return false;
      if (f.kind && r.kind !== f.kind) return false;
      const d = (r.created_at || "").slice(0, 10);
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
      const v = metric.get(r);
      if ((min !== null || max !== null) && typeof v !== "number") return false;
      if (min !== null && (v as number) < min) return false;
      if (max !== null && (v as number) > max) return false;
      return true;
    });
    const col = COLS.find((c) => c.key === sort.key)!;
    return [...list].sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const cmp = x < y ? -1 : 1;
      return sort.desc ? -cmp : cmp;
    });
  }, [rows, f, sort]);

  const field = "min-w-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-foreground";
  const H2 = "mb-2 text-xs font-semibold uppercase tracking-[0.07em] text-muted-foreground";

  return (
    <section>
      <h2 className={H2}>Takes and acoustic data</h2>
      <div className="grid gap-3 rounded-2xl border border-border px-4 py-4">
        {error ? <p className="text-sm text-destructive">{error}</p> : !rows ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <select aria-label="Project" className={field} value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}>
                <option value="">All projects</option>
                {projects.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select aria-label="Kind" className={field} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option value="">All kinds</option>
                {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input aria-label="From" type="date" className={field} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
              <input aria-label="To" type="date" className={field} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
              <select aria-label="Measure" className={field} value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>
                {NUMERIC.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <input aria-label="Min" type="number" placeholder="min" className={`${field} w-20`} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} />
              <input aria-label="Max" type="number" placeholder="max" className={`${field} w-20`} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} />
              <span className="ml-auto text-xs text-muted-foreground">{shown.length} of {rows.length} Takes</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    {COLS.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-2 py-1.5 font-medium">
                        <button type="button" onClick={() => setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : true })}>
                          {c.label}{sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((t) => (
                    <Fragment key={t.id}>
                      <tr onClick={() => setOpen(open === t.id ? null : t.id)}
                        className={`cursor-pointer border-b border-border hover:bg-muted ${open === t.id ? "bg-muted" : ""}`}>
                        {COLS.map((c) => (
                          <td key={c.key} className="whitespace-nowrap px-2 py-1.5">
                            {c.key === "created_at" ? day(t.created_at) : fmt(c.get(t))}
                          </td>
                        ))}
                      </tr>
                      {open === t.id && (
                        <tr><td colSpan={COLS.length} className="bg-muted/40 px-2 py-3"><PiecesTable id={id} sessionId={t.id} /></td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {shown.length === 0 && <p className="py-3 text-sm text-muted-foreground">No Takes match.</p>}
            </div>

            {baseline?.features && (
              <p className="text-xs text-muted-foreground">
                Baseline ({baseline.n_sessions ?? "?"} Takes, {day(baseline.computed_at)}):{" "}
                {Object.entries(baseline.features).map(([k, v]) => `${k} ${fmt(v.mean ?? null)} ± ${fmt(v.sd ?? null)}`).join(" · ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Click a Take to see each piece with every stored measure. F0 to energy ratio are averages of the pieces.</p>
          </>
        )}
      </div>
    </section>
  );
}

function PiecesTable({ id, sessionId }: { id: string; sessionId: string }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v2/admin/people/${encodeURIComponent(id)}/takes/${encodeURIComponent(sessionId)}`, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json().catch(() => ({}));
        if (!r.ok) return setError(b.error || "Could not load the pieces.");
        setPieces(b.pieces || []);
      })
      .catch(() => setError("Could not reach the server."));
  }, [id, sessionId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!pieces) return <p className="text-sm text-muted-foreground">Loading pieces…</p>;
  if (!pieces.length) return <p className="text-sm text-muted-foreground">No pieces stored for this Take.</p>;

  const keys = [...new Set(pieces.flatMap((p) => Object.keys(p.metrics)))]
    .filter((k) => typeof pieces.find((p) => p.metrics[k] !== undefined)?.metrics[k] !== "object").sort();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-xs tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="px-2 py-1 font-medium">Start (s)</th>
            <th className="px-2 py-1 font-medium">Length (s)</th>
            <th className="px-2 py-1 font-medium">Fillers</th>
            {keys.map((k) => <th key={k} className="whitespace-nowrap px-2 py-1 font-medium">{k}</th>)}
            <th className="px-2 py-1 font-medium">Words</th>
          </tr>
        </thead>
        <tbody>
          {pieces.map((p) => (
            <tr key={p.id} className="border-b border-border align-top">
              <td className="px-2 py-1">{fmt(p.start_ms === null ? null : p.start_ms / 1000)}</td>
              <td className="px-2 py-1">{fmt(p.duration_ms === null ? null : p.duration_ms / 1000)}</td>
              <td className="px-2 py-1">{fmt(p.values.fillers)}</td>
              {keys.map((k) => <td key={k} className="whitespace-nowrap px-2 py-1">{fmt(p.metrics[k] as number | null)}</td>)}
              <td className="max-w-[28rem] px-2 py-1 text-muted-foreground">{p.transcript}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
