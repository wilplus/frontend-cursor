"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PipelineAdminError,
  fetchPipelineHealth,
  fetchPipelineJobs,
  sweepStaleJobs,
  type JobStatus,
  type PipelineHealth,
  type PipelineJob,
} from "@/services/api/pipelineAdmin";

/* -------------------------------------------------------------------------- */
/*  /admin/pipeline — the processing queue, for an operator.                   */
/*                                                                            */
/*  NOT linked in nav; a bare internal tool, same posture as /admin/learning.  */
/*  The gate is SERVER-SIDE: the BFF forwards the Supabase JWT and the backend */
/*  enforces @require_admin. Non-admins see the denied note and nothing else.  */
/*                                                                            */
/*  AC-9. Plumbing counters about JOBS — status, stage, attempts, timings —    */
/*  never reads on a speaker, and never rendered on a student surface. Two     */
/*  things would break that and are therefore banned: showing any per-user     */
/*  quality signal here, and leaking queue state into user-facing copy         */
/*  ("4 ahead of you" is product copy needing founder sign-off).               */
/*                                                                            */
/*  The verdict is the headline because it is the only part that implies an    */
/*  action: more workers shrink the WAIT, never the RUN.                       */
/* -------------------------------------------------------------------------- */

const STATUSES: (JobStatus | "all")[] = [
  "all",
  "pending",
  "processing",
  "failed",
  "completed",
];

const VERDICT: Record<string, { label: string; className: string; hint: string }> =
  {
    healthy: {
      label: "Healthy",
      className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      hint: "Nothing pending — every take starts immediately.",
    },
    busy: {
      label: "Busy",
      className: "bg-amber-50 text-amber-800 border-amber-200",
      hint: "Work is queued, but waits are short next to a take's own time.",
    },
    saturated: {
      label: "Saturated",
      className: "bg-red-50 text-red-800 border-red-200",
      hint: "People wait about as long as the work itself takes — add slots.",
    },
    unknown: {
      label: "Unknown",
      className: "bg-neutral-100 text-neutral-700 border-neutral-300",
      hint: "The queue could not be read. This is not the same as healthy.",
    },
  };

function secs(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v < 90) return `${Math.round(v)}s`;
  return `${(v / 60).toFixed(1)}m`;
}

function ago(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const d = Math.max(0, (Date.now() - t) / 1000);
  if (d < 90) return `${Math.round(d)}s ago`;
  if (d < 5400) return `${Math.round(d / 60)}m ago`;
  return `${Math.round(d / 3600)}h ago`;
}

function Tile({
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

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "failed"
      ? "bg-red-50 text-red-700 border-red-200"
      : status === "processing"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : status === "pending"
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-neutral-50 text-neutral-600 border-neutral-200";
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${tone}`}
    >
      {status}
    </span>
  );
}

type Phase =
  | { phase: "loading" }
  | { phase: "denied"; status: number }
  | { phase: "error"; message: string }
  | { phase: "ready" };

export default function PipelineAdminPage() {
  const [phase, setPhase] = useState<Phase>({ phase: "loading" });
  const [health, setHealth] = useState<PipelineHealth | null>(null);
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [sweeping, setSweeping] = useState(false);
  const [sweepNote, setSweepNote] = useState<string | null>(null);

  const load = useCallback(async (status: JobStatus | "all") => {
    setPhase({ phase: "loading" });
    try {
      // Both in one round trip: a panel that shows depth from one moment and
      // a job list from another invites the reader to reconcile two states
      // that were never true together.
      const [h, page] = await Promise.all([
        fetchPipelineHealth(),
        fetchPipelineJobs(status === "all" ? {} : { status }),
      ]);
      setHealth(h);
      setJobs(page.jobs);
      setPhase({ phase: "ready" });
    } catch (err) {
      if (err instanceof PipelineAdminError && err.denied) {
        setPhase({ phase: "denied", status: err.status });
        return;
      }
      setPhase({
        phase: "error",
        message:
          err instanceof Error ? err.message : "Request failed. Try again.",
      });
    }
  }, []);

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  const onSweep = useCallback(async () => {
    setSweeping(true);
    setSweepNote(null);
    try {
      const r = await sweepStaleJobs();
      // Report the real counts, including zero. "Swept" alone would read as
      // "fixed" on a queue where nothing was actually recoverable.
      setSweepNote(
        r.requeued === 0 && r.failed === 0
          ? "Nothing to recover — no stale jobs."
          : `Requeued ${r.requeued}, failed ${r.failed} (attempt cap reached).`
      );
      await load(filter);
    } catch (err) {
      setSweepNote(
        err instanceof Error ? err.message : "Sweep failed. See server logs."
      );
    } finally {
      setSweeping(false);
    }
  }, [filter, load]);

  if (phase.phase === "denied") {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <h1 className="text-[20px] font-semibold text-neutral-900">
          Pipeline queue
        </h1>
        <p className="mt-3 text-[13px] text-neutral-600">
          {phase.status === 401
            ? "Sign in with an admin account to view this page."
            : "Admin access required. This surface is operational plumbing — admin-only."}
        </p>
      </main>
    );
  }

  const v = VERDICT[health?.saturation ?? "unknown"] ?? VERDICT.unknown;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold text-neutral-900">
            Pipeline queue
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-neutral-500">
            Queue depth, wait and run times, and recovery for jobs a dead
            worker left behind. Operational plumbing; admin-only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(filter)}
          className="shrink-0 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Refresh
        </button>
      </div>

      {phase.phase === "error" ? (
        <p className="mt-4 text-[13px] text-red-600">{phase.message}</p>
      ) : null}

      {health ? (
        <>
          <section className="mt-6">
            <div
              className={`rounded-md border px-4 py-3 ${v.className}`}
              role="status"
            >
              <p className="text-[14px] font-semibold">{v.label}</p>
              <p className="mt-0.5 text-[12px] opacity-90">
                {health.recommendation || v.hint}
              </p>
            </div>
          </section>

          <section className="mt-4 flex flex-wrap gap-2">
            <Tile label="Pending" value={String(health.queue.pending)} />
            <Tile label="Processing" value={String(health.queue.processing)} />
            <Tile
              label="Oldest wait"
              value={secs(health.queue.oldest_pending_seconds)}
              sub="longest anyone is waiting"
            />
            <Tile
              label="Failures"
              value={String(health.failures.recent)}
              sub={`last ${health.failure_window_hours}h`}
            />
          </section>

          <section className="mt-3 flex flex-wrap gap-2">
            <Tile
              label="Wait p50 / p95"
              value={`${secs(health.latency.wait_p50_s)} / ${secs(health.latency.wait_p95_s)}`}
              sub="enqueued → started (more workers shrink this)"
            />
            <Tile
              label="Run p50 / p95"
              value={`${secs(health.latency.run_p50_s)} / ${secs(health.latency.run_p95_s)}`}
              sub="started → finished (workers do NOT shrink this)"
            />
            <Tile
              label="Sample"
              value={String(health.latency.sample)}
              sub="recent finished jobs"
            />
          </section>

          {health.failures.last_error ? (
            <p className="mt-3 break-words rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[11px] text-neutral-600">
              last error: {health.failures.last_error}
            </p>
          ) : null}

          <section className="mt-6 rounded-md border border-neutral-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-neutral-800">
                  Sweep stale jobs
                </p>
                <p className="mt-0.5 max-w-xl text-[12px] text-neutral-500">
                  Requeues jobs whose worker died mid-run, and terminally fails
                  the ones past their attempt cap. Safe to press repeatedly —
                  recovery is CAS-guarded, and a quiet sweep is a cheap read.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void onSweep()}
                disabled={sweeping}
                className="shrink-0 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                {sweeping ? "Sweeping…" : "Sweep"}
              </button>
            </div>
            {sweepNote ? (
              <p className="mt-2 text-[12px] text-neutral-700">{sweepNote}</p>
            ) : null}
          </section>
        </>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-[14px] font-semibold text-neutral-900">
            Recent jobs
          </h2>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded border px-2 py-1 text-[12px] ${
                filter === s
                  ? "border-neutral-800 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {phase.phase === "loading" ? (
          <p className="mt-4 text-[13px] text-neutral-500">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="mt-4 text-[13px] text-neutral-500">
            No jobs{filter === "all" ? "" : ` with status “${filter}”`}.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Stage</th>
                  <th className="py-2 pr-3 font-medium">Attempts</th>
                  <th className="py-2 pr-3 font-medium">Enqueued</th>
                  <th className="py-2 pr-3 font-medium">Started</th>
                  <th className="py-2 pr-3 font-medium">Finished</th>
                  <th className="py-2 pr-3 font-medium">Job</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr
                    key={j.id}
                    className="border-b border-neutral-100 align-top text-[12px] text-neutral-700"
                  >
                    <td className="py-2 pr-3">
                      <StatusPill status={String(j.status)} />
                      {j.error ? (
                        <p className="mt-1 max-w-[220px] break-words font-mono text-[10px] text-red-600">
                          {j.error}
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      {j.stage ?? "—"}
                      {typeof j.percent === "number" && j.percent > 0 ? (
                        <span className="ml-1 tabular-nums text-neutral-400">
                          {j.percent}%
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {j.attempts ?? 0}/{j.max_attempts ?? 3}
                    </td>
                    <td className="py-2 pr-3">{ago(j.enqueued_at)}</td>
                    <td className="py-2 pr-3">{ago(j.started_at)}</td>
                    <td className="py-2 pr-3">{ago(j.finished_at)}</td>
                    <td className="py-2 pr-3 font-mono text-[10px] text-neutral-400">
                      {j.id.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
