"use client";

import { useEffect, useState } from "react";
import { Loader2, X, FileAudio } from "lucide-react";
import { fetchReadouts, type ReadoutSummaryRow } from "@/services/api/readouts";

/* -------------------------------------------------------------------------- */
/*  HistoryOverlay — your recordings, dated (§6c)                              */
/*                                                                            */
/*  A dedicated surface (like Strong Sides), NOT date headers in the live chat. */
/*  Reads /v2/user/readouts — which is 1-per-session — so each recording is one  */
/*  dated group (1 group = 1 session). Coach comments fold into the original     */
/*  group in place: tapping a row re-opens that session's Readout, which carries  */
/*  the coach layer post-publish. Because this reads the readouts list (not the   */
/*  Lounge thread), legacy double-entry threads can't produce two history          */
/*  buckets — no grouping adapter needed.                                        */
/* -------------------------------------------------------------------------- */

function dateLabel(iso: string): string {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function stateLabel(state: string): string {
  if (state === "review_pending") return "With your coach";
  if (state === "readout_ready") return "Sent";
  return "Insights ready";
}

export default function HistoryOverlay({
  onClose,
  onOpenSession,
}: {
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [rows, setRows] = useState<ReadoutSummaryRow[]>([]);

  useEffect(() => {
    let active = true;
    void fetchReadouts().then((r) => {
      if (!active) return;
      setRows(r);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  // Group consecutive rows (newest-first) under their date heading. The date is
  // a separator, not the grouping key — each row is its own session group (§6c).
  const groups: { date: string; rows: ReadoutSummaryRow[] }[] = [];
  for (const row of rows) {
    const label = dateLabel(row.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.date === label) last.rows.push(row);
    else groups.push({ date: label, rows: [row] });
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[13px] font-semibold text-foreground">
          Your recordings
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-6">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="max-w-sm text-[15px] text-muted-foreground">
            No recordings yet — your sessions collect here once you record and
            send one.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.date}>
                <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  {g.date}
                </p>
                <ul className="flex flex-col gap-2">
                  {g.rows.map((r) => (
                    <li key={r.sessionId}>
                      <button
                        type="button"
                        onClick={() => onOpenSession(r.sessionId)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50"
                      >
                        <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-[15px] text-foreground">
                          {r.topic || "Recording"}
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          {stateLabel(r.state)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
