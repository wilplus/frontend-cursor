"use client";

import { useCallback, useEffect, useState } from "react";
import type { LearningTrace } from "@/components/admin/learningTrace";
import {
  fmtDate,
  fmtNum,
  fmtPct,
  overrideRate,
} from "@/components/admin/learningTrace";
import {
  BarRows,
  CoefficientsTable,
  ExportRunsTable,
  KnownGapsList,
  LaneCard,
  ModelVersionsTable,
  SectionErrors,
  Sparkline,
  StageFlow,
  StatTile,
} from "@/components/admin/LearningTraceView";

/* -------------------------------------------------------------------------- */
/*  /admin/learning — developer learning-trace (backlog item 11)              */
/*                                                                            */
/*  NOT linked in nav. A bare internal tool whose     */
/*  gate is SERVER-SIDE — credits gates on a BE body password; this page      */
/*  gates on the Supabase JWT the BFF forwards to @require_admin (the trace   */
/*  endpoint is admin-ONLY, not admin-or-coach: BLIND COACH — it shows        */
/*  machine guesses vs coach labels). Non-admins just see the 401/403 note.   */
/*  Developer-facing copy throughout; nothing here is user-facing (AC-9).     */
/* -------------------------------------------------------------------------- */

type LoadState =
  | { phase: "loading" }
  | { phase: "denied"; status: number }
  | { phase: "error"; message: string }
  | { phase: "ready"; trace: LearningTrace };

export default function LearningTracePage() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const res = await fetch("/api/v2/admin/learning/trace", {
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        setState({ phase: "denied", status: res.status });
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setState({
          phase: "error",
          message:
            (data && typeof data.error === "string" && data.error) ||
            `Request failed (HTTP ${res.status}).`,
        });
        return;
      }
      setState({ phase: "ready", trace: data as LearningTrace });
    } catch {
      setState({ phase: "error", message: "Network error. Try again." });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") {
    return (
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h1 className="text-[20px] font-semibold text-neutral-900">Learning trace</h1>
        <p className="mt-4 text-[13px] text-neutral-500">Loading trace…</p>
      </main>
    );
  }

  if (state.phase === "denied") {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-[20px] font-semibold text-neutral-900">Learning trace</h1>
        <p className="mt-3 text-[13px] text-neutral-600">
          {state.status === 401
            ? "Sign in with an admin account to view this page."
            : "Admin access required. This surface is admin-only (BLIND COACH: it exposes shadow-model guesses next to coach labels, so coach accounts are excluded)."}
        </p>
      </main>
    );
  }

  if (state.phase === "error") {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-[20px] font-semibold text-neutral-900">Learning trace</h1>
        <p className="mt-3 text-[13px] text-red-600">{state.message}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-md border border-neutral-300 bg-white px-4 py-2 text-[14px] font-medium text-neutral-800 hover:bg-neutral-50"
        >
          Retry
        </button>
      </main>
    );
  }

  const t = state.trace;
  const shadow = t.lane_shadow ?? null;
  const ann = t.lane_annotations ?? null;
  const lanes = t.pipeline_docs?.lanes ?? [];
  const agreement = shadow?.shadow_agreement ?? null;
  const weeks = shadow?.agreement_over_time ?? [];
  const orate = overrideRate(ann);
  const lastExport = ann?.export_runs?.[0] ?? null;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-neutral-900">Learning trace</h1>
          <p className="mt-1 text-[13px] text-neutral-500">
            How coach labels and admin annotations become models — the two
            learning lanes, their corpora, decision points, and what is
            currently promoted. Developer observability; admin-only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 font-mono text-[11px] text-neutral-400">
        generated {fmtDate(t.generated_at)} · spec: docs/ENGINE-MAP.md §2–4 ·
        docs/LEARNING-TRACE.md
      </p>

      <div className="mt-4">
        <SectionErrors errors={t.errors ?? []} />
      </div>

      {/* ── pipeline stage flows ─────────────────────────────────────── */}
      <section className="mt-6 space-y-3">
        <h2 className="text-[16px] font-semibold text-neutral-900">Pipelines</h2>
        {lanes.map((lane) => (
          // StageFlow renders the arrow-separated stages; orange badge =
          // a decision point (quality gate / human promote / auto-retrain
          // threshold).
          <StageFlow key={lane.id} lane={lane} />
        ))}
      </section>

      {/* ── lane 1: shadow direction classifier ─────────────────────── */}
      <div className="mt-8 space-y-6">
        <LaneCard
          title="Lane 1 — shadow direction classifier"
          subtitle="training_labels ⋈ the 11 acoustic features → logistic regression, shadow-only (never promoted, never surfaced)"
        >
          <div className="flex flex-wrap gap-3">
            <StatTile
              label="corpus (training_labels)"
              value={fmtNum(shadow?.training_labels?.total ?? null)}
            />
            <StatTile
              label="shadow agreement"
              value={fmtPct(agreement?.agreement_overall ?? null)}
              sub={
                agreement?.sample_n
                  ? `n=${agreement.sample_n} · in-distribution`
                  : "no labeled predictions yet"
              }
            />
            <StatTile
              label="latest model"
              value={shadow?.model_versions?.[0]?.status ?? "—"}
              sub={shadow?.model_versions?.[0]?.version ?? undefined}
            />
            <StatTile
              label="auto-retrain"
              value={`≥${shadow?.auto_retrain?.min_total ?? 50} / +${shadow?.auto_retrain?.new_delta ?? 25}`}
              sub="total floor / new-label delta"
            />
          </div>

          {weeks && weeks.length > 0 ? (
            <div className="flex items-center gap-4">
              <Sparkline points={weeks} />
              <p className="text-[11px] text-neutral-500">
                weekly predicted-vs-coach agreement (dashed line = 50%);{" "}
                {weeks[weeks.length - 1].week}: {fmtPct(weeks[weeks.length - 1].agreement)}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <BarRows data={shadow?.training_labels?.by_class} title="labels by class" />
            <BarRows
              data={shadow?.training_labels?.by_selection_source}
              title="labels by selection source"
            />
          </div>

          <div>
            <p className="text-[12px] font-medium text-neutral-600">
              Coefficients — how each acoustic feature pulls the model
              (answers &quot;how do annotations shape its read of acoustics&quot;)
            </p>
            <div className="mt-1.5">
              <CoefficientsTable coefficients={shadow?.coefficients ?? null} />
            </div>
          </div>

          <div>
            <p className="text-[12px] font-medium text-neutral-600">Model versions</p>
            <div className="mt-1.5">
              <ModelVersionsTable rows={shadow?.model_versions ?? []} />
            </div>
          </div>
        </LaneCard>

        {/* ── lane 2: annotation → writer models ──────────────────────── */}
        <LaneCard
          title="Lane 2 — annotations → writer models"
          subtitle="admin_annotation_events (AI draft vs coach final) → JSONL exports → SFT/DPO → manually promoted copilot model"
        >
          <div className="flex flex-wrap gap-3">
            <StatTile
              label="annotation events"
              value={fmtNum(ann?.annotation_events?.total ?? null)}
            />
            <StatTile
              label="override rate"
              value={orate === null ? "—" : fmtPct(orate)}
              sub="overridden / (approved + overridden), hash-derived"
            />
            <StatTile
              label="last export"
              value={lastExport?.status ?? "—"}
              sub={lastExport ? fmtDate(lastExport.started_at) : "no runs yet"}
            />
            <StatTile
              label="copilot model"
              value={ann?.copilot_model?.value ?? "stock (no promoted fine-tune)"}
              sub={
                ann?.copilot_model
                  ? `promoted ${fmtDate(ann.copilot_model.updated_at)}`
                  : "runtime_config openai_copilot_model absent"
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <BarRows
              data={ann?.annotation_events?.by_section_type}
              title="events by section_type"
            />
            <BarRows
              data={ann?.annotation_events?.by_reason_chip}
              title="events by reason chip"
            />
          </div>

          <div>
            <p className="text-[12px] font-medium text-neutral-600">
              Export runs (last 10)
            </p>
            <div className="mt-1.5">
              <ExportRunsTable rows={ann?.export_runs ?? []} />
            </div>
          </div>
        </LaneCard>

        {/* Lane 3 (acoustic stress baseline) is GONE — the founder pivoted
            stress recognition into the peer-review validation loop
            (2026-08-03). The lane's corpus, promote path and runtime_config
            key are being deleted BE-side; see
            docs/HANDOFF-BE-2026-08-03-stress-lane-deletion-and-peer-review.md.
            The trace's `lane_acoustic` section is ignored if still served. */}
      </div>

      {/* ── known gaps ───────────────────────────────────────────────── */}
      <section className="mt-8">
        <h2 className="text-[16px] font-semibold text-neutral-900">Known gaps</h2>
        <div className="mt-3">
          <KnownGapsList gaps={t.known_gaps ?? []} />
        </div>
      </section>
    </main>
  );
}
