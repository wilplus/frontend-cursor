"use client";

import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/* -------------------------------------------------------------------------- */
/*  Operator queue for project deletions (P1, decisions log N8).              */
/*                                                                            */
/*  A user's ⋯ → Delete is a request. An operator confirms it here within 7   */
/*  days; after that the owner can no longer cancel. Confirming deletes       */
/*  nothing by itself: the purge runs only when an operator runs              */
/*  scripts/run_phase1_data_purge.py with the purge request id this page      */
/*  shows. Operator-only wording; no user sees this page.                     */
/* -------------------------------------------------------------------------- */

export interface ProjectDeletionRow {
  request_id: string;
  project_id: string;
  project_name: string;
  state: "pending" | "confirmed" | string;
  requested_at: string | null;
  due_at: string | null;
  confirmed_at: string | null;
  acquisition_principal_id: string;
}

interface QueueResponse {
  requests?: ProjectDeletionRow[];
  error?: string;
}

interface ConfirmResponse {
  purge_request_id?: string;
  error?: string;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

export function ProjectDeletionQueue() {
  const [rows, setRows] = useState<ProjectDeletionRow[]>([]);
  const [purgeIds, setPurgeIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>("load");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy("load");
    setError(null);
    try {
      const response = await fetch("/api/v2/admin/project-deletions", {
        cache: "no-store",
      });
      const body = await readJson<QueueResponse>(response);
      if (!response.ok) {
        setError(body.error ?? `Could not load requests (${response.status}).`);
        return;
      }
      setRows(Array.isArray(body.requests) ? body.requests : []);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirm = async (row: ProjectDeletionRow) => {
    const name = row.project_name || "this project";
    if (
      !window.confirm(
        `Confirm deletion of ${name}? The owner can no longer cancel it.`
      )
    ) {
      return;
    }
    setBusy(row.request_id);
    setError(null);
    try {
      const response = await fetch(
        `/api/v2/admin/project-deletions/${encodeURIComponent(row.request_id)}/confirm`,
        { method: "POST", cache: "no-store" }
      );
      const body = await readJson<ConfirmResponse>(response);
      if (!response.ok) {
        setError(body.error ?? `Could not confirm (${response.status}).`);
        return;
      }
      setPurgeIds((current) => ({
        ...current,
        [row.request_id]: body.purge_request_id ?? "",
      }));
      setRows((current) =>
        current.map((item) =>
          item.request_id === row.request_id
            ? { ...item, state: "confirmed" }
            : item
        )
      );
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link
        href="/admin/ceo"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to CEO
      </Link>

      <div className="mt-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Project deletions
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          Open requests, oldest due first. Confirming ends the owner&apos;s
          chance to cancel; the purge itself runs from the purge script with
          the purge request id shown after confirming.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-destructive/[0.12] px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-2xl border border-foreground/12">
        {rows.length ? (
          <div className="divide-y divide-foreground/10">
            {rows.map((row) => (
              <article
                key={row.request_id}
                className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-medium">
                    {row.project_name || "Unnamed project"}
                  </h2>
                  <p className="mt-0.5 truncate font-mono text-xs text-foreground/50">
                    {row.project_id}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 text-xs text-foreground/60">
                  <dt>Requested</dt>
                  <dd>{formatDate(row.requested_at)}</dd>
                  <dt>Due</dt>
                  <dd>{formatDate(row.due_at)}</dd>
                </dl>
                <div className="flex flex-col items-start gap-1 sm:items-end">
                  {row.state === "pending" ? (
                    <button
                      type="button"
                      onClick={() => void confirm(row)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Confirm deletion
                    </button>
                  ) : (
                    <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs">
                      Confirmed
                    </span>
                  )}
                  {purgeIds[row.request_id] ? (
                    <code className="text-xs text-foreground/60">
                      purge {purgeIds[row.request_id]}
                    </code>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="p-6 text-sm text-foreground/60">
            {busy === "load" ? "Loading…" : "No open deletion requests."}
          </p>
        )}
      </section>
    </main>
  );
}
