"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { homeworkApi } from "@/lib/api/homework-client";
import type { HomeworkReportResponse } from "@/lib/api/types-homework";
import { Button } from "@/components/ui/button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

function formatFillerBreakdown(breakdown: Record<string, number> | undefined): string {
  if (!breakdown || typeof breakdown !== "object") return "";
  return Object.entries(breakdown)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([word, n]) => `${word}: ${n}`)
    .join(", ");
}

interface HomeworkReportsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, modal shows this report only (list is on the page). */
  sessionId: string | null;
}

export default function HomeworkReportsModal({ open, onOpenChange, sessionId }: HomeworkReportsModalProps) {
  const [report, setReport] = useState<HomeworkReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !sessionId) {
      setReport(null);
      setReportError(null);
      return;
    }
    setReportLoading(true);
    setReportError(null);
    homeworkApi
      .getReport(sessionId)
      .then((data) => {
        setReport(data);
        setReportError(null);
      })
      .catch((e) => {
        setReport(null);
        setReportError(e instanceof Error ? e.message : "Failed to load report");
      })
      .finally(() => setReportLoading(false));
  }, [open, sessionId]);

  if (!open) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="homework-reports-modal-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 id="homework-reports-modal-title" className="text-lg font-semibold">
            Report
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {reportLoading && (
            <p className="text-sm text-muted-foreground">Loading report…</p>
          )}
          {reportError && !reportLoading && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              {reportError}
            </p>
          )}
          {report && !reportLoading && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Your recording</p>
                    {(report.final_recording?.audio_url ?? report.recording?.audio_url ?? report.recording_1?.audio_url) ? (
                      <audio
                        controls
                        src={
                          report.final_recording?.audio_url ??
                          report.recording?.audio_url ??
                          report.recording_1?.audio_url ??
                          ""
                        }
                        className="w-full max-w-md rounded-lg border border-border"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Recording playback not available.</p>
                    )}
                  </div>
                  {(report.recording?.transcription_text ?? report.transcript) && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Transcript</p>
                      <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-[40vh] overflow-y-auto">
                        <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                          {(report.recording?.transcription_text ?? report.transcript ?? "").trim()}
                        </p>
                      </div>
                    </div>
                  )}
                  {(report.recording?.filler_words_count?.total ?? report.filler_word_count) != null && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Filler words</p>
                      <p className="text-sm text-foreground">
                        {(report.recording?.filler_words_count?.total ?? report.filler_word_count ?? 0)} filler word
                        {(report.recording?.filler_words_count?.total ?? report.filler_word_count) !== 1 ? "s" : ""} detected
                        {formatFillerBreakdown(report.recording?.filler_words_count?.breakdown)
                          ? ` (${formatFillerBreakdown(report.recording?.filler_words_count?.breakdown)})`
                          : ""}
                        .
                      </p>
                    </div>
                  )}
                  {(report.report_text ?? "").trim() && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Report</p>
                      <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-[50vh] overflow-y-auto">
                        <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed break-words">
                          {report.report_text}
                        </p>
                      </div>
                    </div>
                  )}
                  {report.scores && (
                    <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                      <span>
                        <span className="text-muted-foreground">Warm-up:</span>{" "}
                        {report.scores.warmup != null ? Math.round(report.scores.warmup * 100) : "—"}
                      </span>
                      <span>
                        <span className="text-muted-foreground">Final:</span>{" "}
                        {report.scores.final != null ? Math.round(report.scores.final * 100) : "—"}
                      </span>
                      <span>
                        <span className="text-muted-foreground">Overall:</span>{" "}
                        {report.scores.overall != null ? Math.round(report.scores.overall * 100) : "—"}
                      </span>
                    </div>
                  )}
                </div>
              )}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(overlay, document.body);
  }
  return overlay;
}
