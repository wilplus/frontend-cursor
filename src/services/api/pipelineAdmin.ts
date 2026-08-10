/**
 * Typed client for the pipeline admin panel (/admin/pipeline).
 *
 * Every call goes through the BFF passthrough at /api/v2/admin/pipeline/*,
 * which forwards the Supabase JWT and lets the BACKEND be the gate
 * (@require_admin). No secret is involved anywhere on this path — see
 * src/app/api/v2/admin/pipeline/proxy.ts for why that is deliberate.
 *
 * AC-9: plumbing counters about JOBS, never reads on a speaker. Nothing in
 * these types is a score, a rank, or anything about how someone spoke.
 */

/** Saturation verdict. `unknown` is a real answer — the queue could not be
 * read — and must never be flattened into `healthy`. */
export type Saturation = "healthy" | "busy" | "saturated" | "unknown";

export type PipelineHealth = {
  ok: boolean;
  saturation: Saturation;
  recommendation: string;
  failure_window_hours: number;
  queue: {
    pending: number;
    processing: number;
    oldest_pending_seconds: number | null;
  };
  latency: {
    sample: number;
    wait_p50_s: number | null;
    wait_p95_s: number | null;
    run_p50_s: number | null;
    run_p95_s: number | null;
  };
  failures: { recent: number; last_error: string | null };
};

export type JobStatus = "pending" | "processing" | "completed" | "failed";

/** Deliberately narrow: this mirrors the backend's fixed projection, which
 * excludes `payload` and `result`. Widening this type would be the first
 * step of widening that projection. */
export type PipelineJob = {
  id: string;
  kind: string | null;
  status: JobStatus | string;
  stage: string | null;
  percent: number | null;
  message: string | null;
  error: string | null;
  attempts: number | null;
  max_attempts: number | null;
  user_id: string | null;
  session_id: string | null;
  enqueued_at: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type PipelineJobsPage = {
  ok: boolean;
  jobs: PipelineJob[];
  count: number;
  /** Cursor for the next page, or null when this is the last one. Never infer
   * "done" from a short page — a page can be short because the queue drained. */
  next_before: string | null;
};

export type SweepResult = { ok: boolean; requeued: number; failed: number };

/** 401/403 are modelled as a value, not thrown: the page renders a different
 * surface for "you are not an admin" than for "the request failed". */
export class PipelineAdminError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly denied: boolean
  ) {
    super(message);
    this.name = "PipelineAdminError";
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store", ...init });
  } catch {
    throw new PipelineAdminError("Network error. Try again.", 0, false);
  }
  const denied = res.status === 401 || res.status === 403;
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok || !data) {
    throw new PipelineAdminError(
      (data && typeof data.error === "string" && data.error) ||
        `Request failed (HTTP ${res.status}).`,
      res.status,
      denied
    );
  }
  return data;
}

export function fetchPipelineHealth(): Promise<PipelineHealth> {
  return call<PipelineHealth>("/api/v2/admin/pipeline/health");
}

export function fetchPipelineJobs(opts?: {
  status?: JobStatus;
  limit?: number;
  before?: string;
}): Promise<PipelineJobsPage> {
  const qs = new URLSearchParams();
  if (opts?.status) qs.set("status", opts.status);
  if (opts?.limit) qs.set("limit", String(opts.limit));
  if (opts?.before) qs.set("before", opts.before);
  const suffix = qs.toString() ? `?${qs}` : "";
  return call<PipelineJobsPage>(`/api/v2/admin/pipeline/jobs${suffix}`);
}

export function sweepStaleJobs(): Promise<SweepResult> {
  return call<SweepResult>("/api/v2/admin/pipeline/sweep", { method: "POST" });
}
