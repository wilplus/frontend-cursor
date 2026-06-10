"use client";

import { useEffect, useState } from "react";
import { Loader2, X, FileAudio, ThumbsUp, AlertTriangle } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { fetchReadouts, type ReadoutSummaryRow } from "@/services/api/readouts";
import { fetchLibrary, type LibraryEntry } from "@/services/api/library";
import { useBackDismiss } from "./useBackDismiss";

/* -------------------------------------------------------------------------- */
/*  AuditOverlay — the unified, re-openable audit / history view (C-1)         */
/*                                                                            */
/*  One page for the user's whole journey: every recording (dated, re-openable  */
/*  → opens that session's read; the overlay stays mounted underneath so closing */
/*  the read returns here) + every coach-tagged moment, strong AND to-work-on,   */
/*  each with its playable clip + the coach's note. Composes /readouts +         */
/*  /library (S3) — no new BE. The audit ARTIFACT itself (the emailed summary)   */
/*  is assembled + sent coach-side (BE-3); this is the user's in-app browse of   */
/*  the same material.                                                          */
/* -------------------------------------------------------------------------- */

function dateLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AuditOverlay({
  onClose,
  onOpenSession,
}: {
  onClose: () => void;
  /** Re-open a session's read. The overlay stays open underneath, so closing
   *  the read returns the user here ("always come back to it", C-1). */
  onOpenSession: (sessionId: string) => void;
}) {
  // D-3 — back-gesture / Back dismisses this overlay instead of routing away.
  useBackDismiss(onClose);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [readouts, setReadouts] = useState<ReadoutSummaryRow[]>([]);
  const [moments, setMoments] = useState<LibraryEntry[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchReadouts(), fetchLibrary()]).then(([r, m]) => {
      if (!active) return;
      setReadouts(r);
      setMoments(m);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  // Order: strong then to-work-on (mirrors the snippet-walk order in D-1's
  // insights view, but here strong leads — a browse, not a coached sequence).
  const strong = moments.filter((m) => m.tag === "strong");
  const toWorkOn = moments.filter((m) => m.tag === "to_work_on");

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[13px] font-semibold text-foreground">
          Your audit
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close audit"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 overflow-y-auto px-4 py-6">
        {status === "loading" ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : readouts.length === 0 && moments.length === 0 ? (
          <p className="max-w-sm text-[15px] text-muted-foreground">
            Your audit fills in as you record and your coach sends reads. Your
            sessions and the moments worth revisiting collect here.
          </p>
        ) : (
          <>
            {readouts.length > 0 ? (
              <section>
                <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  Your recordings
                </p>
                <ul className="flex flex-col gap-2">
                  {readouts.map((r) => (
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
                          {dateLabel(r.createdAt)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {strong.length > 0 ? (
              <MomentsSection
                title="Strong sides"
                tone="strong"
                entries={strong}
              />
            ) : null}
            {toWorkOn.length > 0 ? (
              <MomentsSection
                title="Moments to work on"
                tone="to_work_on"
                entries={toWorkOn}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function MomentsSection({
  title,
  tone,
  entries,
}: {
  title: string;
  tone: "strong" | "to_work_on";
  entries: LibraryEntry[];
}) {
  return (
    <section>
      <div
        className={`mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide ${
          tone === "strong" ? "text-primary" : "text-foreground"
        }`}
      >
        {tone === "strong" ? (
          <ThumbsUp className="h-4 w-4" aria-hidden />
        ) : (
          <AlertTriangle className="h-4 w-4" aria-hidden />
        )}
        {title}
      </div>
      <ul className="flex flex-col gap-3">
        {entries.map((e) => (
          <li
            key={e.id}
            className="rounded-2xl border border-border bg-card p-4"
          >
            {e.snippet?.audioRef ? (
              <MediaPlayer
                src={e.snippet.audioRef}
                startOffsetMs={e.snippet.startOffsetMs}
                durationMs={e.snippet.durationMs}
              />
            ) : null}
            {e.snippet?.transcript ? (
              <blockquote className="mt-2 border-l-2 border-border pl-3 text-[14px] leading-relaxed text-foreground">
                {e.snippet.transcript}
              </blockquote>
            ) : null}
            {e.note ? (
              <p className="mt-2 text-[15px] leading-relaxed text-foreground">
                {e.note}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
