"use client";

/* -------------------------------------------------------------------------- */
/*  The research screen (founder 2026-09-30, L4 to L9; ML-7): datasets per    */
/*  surface, the label quorum, exclusions, exports, evaluations, promotions,  */
/*  training runs, drift, monitors and the golden set (pair surfaces judged  */
/*  on their own instrument, ML-10). Every panel whose door is closed        */
/*  says so in words rather than showing a zero that reads as a measurement. */
/*  Read-only for the research role; the golden judging is the founder's.    */
/* -------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { founderLearning, type GoldenCounts } from "@/services/api/founderLearning";
import { FounderFrame, Panel, Refusal } from "./FounderFrame";
import GoldenJudging from "./GoldenJudging";

type Raw = Record<string, unknown>;

function obj(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}

function arr(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter((v): v is Raw => Boolean(v) && typeof v === "object") : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function n(value: unknown): string {
  return typeof value === "number" ? new Intl.NumberFormat().format(value) : "—";
}

function Datasets({ datasets }: { datasets: Raw }) {
  const entries = Object.entries(datasets);
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No pair surface reported.</p>;
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {entries.map(([surface, raw]) => {
        const d = obj(raw);
        return (
          <li key={surface} className="rounded-xl border border-border p-3 text-sm">
            <div className="font-medium">{surface}</div>
            <div className="mt-1 tabular-nums text-muted-foreground">{n(d.pairs)} pairs · {n(d.unexported)} unexported · {arr(d.releases).length} releases</div>
            {str(d.consent_note) ? <p className="mt-1 text-xs text-muted-foreground">{str(d.consent_note)}</p> : null}
            {str(d.splits_note) ? <p className="mt-1 text-xs text-muted-foreground">{str(d.splits_note)}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Labels({ labels }: { labels: Raw }) {
  const kappa = typeof labels.kappa === "number" ? labels.kappa.toFixed(2) : null;
  const agreement = typeof labels.two_human_agreement === "number" ? `${Math.round(labels.two_human_agreement * 100)}%` : "—";
  return (
    <dl className="grid gap-3 sm:grid-cols-4">
      <div><dt className="text-[11px] text-muted-foreground">human labels</dt><dd className="text-sm font-semibold tabular-nums">{n(labels.labels)}</dd></div>
      <div><dt className="text-[11px] text-muted-foreground">moments · with two humans</dt><dd className="text-sm font-semibold tabular-nums">{n(labels.moments)} · {n(labels.moments_with_two_humans)}</dd></div>
      <div><dt className="text-[11px] text-muted-foreground">two-human agreement</dt><dd className="text-sm font-semibold tabular-nums">{agreement}</dd></div>
      <div><dt className="text-[11px] text-muted-foreground">Cohen&rsquo;s κ</dt><dd className="text-sm font-semibold tabular-nums">{kappa ?? `— (from ${n(labels.kappa_from)} labels)`}</dd></div>
    </dl>
  );
}

function Evaluations({ rows }: { rows: Raw[] }) {
  if (rows.length === 0) return null;
  const pct = (v: unknown) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Surface</th>
            <th className="px-3 py-2 font-medium">Candidate</th>
            <th className="px-3 py-2 font-medium">Candidate · baseline</th>
            <th className="px-3 py-2 font-medium">Reproduces withdrawn text</th>
            <th className="px-3 py-2 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-2">{str(r.surface) ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-[11px]">{str(r.candidate_model) ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">{pct(r.candidate_mean_f1)} · {pct(r.baseline_mean_f1)}</td>
              <td className="px-3 py-2">{r.regurgitation_ok === false ? "yes" : r.regurgitation_ok === true ? "no" : "—"}</td>
              <td className="px-3 py-2">{r.passed === true ? "passed" : r.passed === false ? "not passed" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrainingRuns({ rows }: { rows: Raw[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="grid gap-1 text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex flex-wrap justify-between gap-2 border-t border-border py-1.5 first:border-t-0">
          <span>{str(r.surface) ?? "—"} · {str(r.started_at)?.slice(0, 10) ?? "—"}</span>
          <span className="text-muted-foreground">
            {str(r.status) ?? "—"} · {n(r.item_count)} pairs
            {str(r.withdrawn_at) ? " · an owner withdrew" : ""}
            {str(r.files_deleted_at) ? " · files deleted" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PromotionHistory({ rows }: { rows: Raw[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="grid gap-1 text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex flex-wrap justify-between gap-2 border-t border-border py-1.5">
          <span>{str(r.surface) ?? "—"} · {str(r.promoted_at)?.slice(0, 10) ?? "—"} · {str(r.promoted_by) ?? "—"}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {str(r.candidate_model) ?? "—"}{str(r.killed_at) ? ` · killed: ${str(r.kill_reason) ?? ""}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Promotions({ rows }: { rows: Raw[] }) {
  return (
    <ul className="grid gap-1 text-sm">
      {rows.map((row) => (
        <li key={String(row.surface)} className="flex flex-wrap justify-between gap-2 border-t border-border py-1.5 first:border-t-0">
          <span>{String(row.surface)}</span>
          <span className="text-muted-foreground">{str(row.model) ?? str(row.note) ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ResearchPanel({ founder }: { founder: boolean }) {
  const [view, setView] = useState<Raw | null>(null);
  const [golden, setGolden] = useState<Record<string, GoldenCounts>>({});
  const [refusal, setRefusal] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [overview, sets] = await Promise.all([founderLearning.overview(), founderLearning.golden()]);
    if (!overview.ok) {
      setRefusal(overview.code);
      return;
    }
    setRefusal(null);
    setView(overview.value);
    if (sets.ok) setGolden(sets.value);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (refusal) {
    return (
      <FounderFrame title="Research" line="read-only · the research role and the founder">
        <Refusal code={refusal} />
      </FounderFrame>
    );
  }
  if (!view) {
    return (
      <FounderFrame title="Research" line="read-only · the research role and the founder">
        <p className="text-sm text-muted-foreground">Reading…</p>
      </FounderFrame>
    );
  }
  const exclusions = obj(view.exclusions);
  const byReason = Object.entries(obj(exclusions.by_reason));
  const exports = obj(view.exports);
  const runs = arr(exports.annotation_runs);
  const releases = arr(exports.pair_exports);
  const weekly = arr(view.weekly);
  const unavailable = Array.isArray(view.unavailable) ? view.unavailable.map(String) : [];
  return (
    <FounderFrame title="Research" line="read-only · the research role and the founder · pseudonyms only">
      <div className="grid gap-4">
        <Panel title="Datasets">
          <Datasets datasets={obj(view.datasets)} />
        </Panel>
        <Panel title="Labels" note="Human labels only; the speaker's own answer is routing, never a label (L3).">
          <Labels labels={obj(view.labels)} />
        </Panel>
        <Panel title="Exclusions" note={str(exclusions.note)}>
          {byReason.length > 0 ? (
            <ul className="text-sm">{byReason.map(([reason, count]) => <li key={reason} className="flex justify-between"><span>{reason}</span><span className="tabular-nums">{n(count)}</span></li>)}</ul>
          ) : null}
        </Panel>
        <Panel title="Exports" note={str(exports.note)}>
          {releases.length > 0 ? (
            <div className="mb-3 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Surface</th>
                    <th className="px-3 py-2 font-medium">Week</th>
                    <th className="px-3 py-2 font-medium">Pairs</th>
                    <th className="px-3 py-2 font-medium">Manifest sha256</th>
                    <th className="px-3 py-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2">{str(r.surface) ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{str(r.week_start) ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{n(r.item_count)}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{(str(r.manifest_sha256) ?? "").slice(0, 16)}</td>
                      <td className="px-3 py-2">{str(r.purged_at) ? "voided · purged" : str(r.voided_at) ? `voided · ${str(r.voided_reason) ?? ""}` : "released"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {runs.length > 0 ? (
            <ul className="text-sm">{runs.map((run, i) => <li key={i} className="flex flex-wrap justify-between gap-2"><span>{str(run.started_at)?.slice(0, 10) ?? "—"} · {str(run.status) ?? "—"}</span><span className="tabular-nums">{n(run.exported_count)}</span></li>)}</ul>
          ) : null}
        </Panel>
        <Panel title="Evaluations" note={str(obj(view.evaluations).note)}>
          <Evaluations rows={arr(obj(view.evaluations).reports)} />
        </Panel>
        <Panel title="Training runs" note={str(obj(view.training).note)}>
          <TrainingRuns rows={arr(obj(view.training).runs)} />
        </Panel>
        <Panel title="Promotions" note="What each contract surface serves today, then the history door 4 writes.">
          <Promotions rows={arr(view.promotions)} />
          <PromotionHistory rows={arr(view.promotion_history)} />
        </Panel>
        <Panel title="Drift" note={str(obj(view.drift).note)} />
        <Panel title="Monitors" note={str(obj(view.monitors).note)} />
        <Panel title="Golden set" note={founder ? "Fifty moments per surface, judged by the founder on the coach's instrument, then sealed with a hash." : "The founder's judgements; sealed sets are read by the evaluation."}>
          <ul className="grid gap-2">
            {Object.entries(golden).map(([surface, counts]) =>
              founder ? (
                <li key={surface}><GoldenJudging surface={surface} counts={counts} onChange={() => void load()} /></li>
              ) : (
                <li key={surface} className="flex justify-between rounded-xl border border-border px-3 py-2 text-sm"><span>{surface}</span><span className="tabular-nums text-muted-foreground">{counts.count} / {counts.setSize}{counts.sealed ? " · sealed" : ""}</span></li>
              ),
            )}
          </ul>
        </Panel>
        <Panel title="Weekly" note={weekly.length === 0 ? "No week stored yet." : null}>
          {weekly.length > 0 ? (
            <ul className="text-sm">{weekly.map((w) => <li key={String(w.week_start)} className="flex justify-between"><span className="tabular-nums">{String(w.week_start)}</span><span className="text-muted-foreground">{Array.isArray(w.ready_cues) && w.ready_cues.length > 0 ? `ready: ${w.ready_cues.join(", ")}` : "no cue ready"}</span></li>)}</ul>
          ) : null}
        </Panel>
        {unavailable.length > 0 ? <p className="text-xs text-muted-foreground">unavailable this read: {unavailable.join(", ")}</p> : null}
      </div>
    </FounderFrame>
  );
}
