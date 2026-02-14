"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { adminApi, type AdminSessionReportResponse } from "@/lib/api/admin-client";
import { Button } from "@/components/ui/button";

type SessionWithPreview = {
  id: string;
  created_at?: string;
  report_preview?: { report_text_preview?: string };
  recording_id?: string;
};

interface ReportDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  studentEmail: string | null;
  session: SessionWithPreview | null;
}

export default function ReportDetailModal({
  open,
  onOpenChange,
  userId,
  studentEmail,
  session,
}: ReportDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AdminSessionReportResponse | null>(null);

  useEffect(() => {
    if (!open || !session) {
      setReport(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    adminApi
      .getStudentSessionReport(userId, session.id)
      .then((data) => {
        setReport(data);
        setError(null);
      })
      .catch((e) => {
        setReport(null);
        setError(e instanceof Error ? e.message : "Failed to load report");
      })
      .finally(() => setLoading(false));
  }, [open, userId, session?.id]);

  if (!open) return null;

  const reportText =
    report?.report_text ??
    (session?.report_preview?.report_text_preview || "").trim() ||
    "";
  const audioUrl = report?.final_recording?.audio_url ?? null;
  const scores = report?.scores;
  const dateLabel = session?.created_at
    ? new Date(session.created_at).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-detail-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 id="report-detail-title" className="text-lg font-semibold">
            Report — {dateLabel}
            {studentEmail && (
              <span className="ml-2 font-normal text-muted-foreground">
                {studentEmail}
              </span>
            )}
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
          {loading && (
            <p className="text-sm text-muted-foreground">Loading report…</p>
          )}
          {error && !loading && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              {error}
              {reportText && " Showing preview below."}
            </p>
          )}

          {!loading && (
            <>
              {/* Recording */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Final recording
                </p>
                {audioUrl ? (
                  <audio
                    controls
                    src={audioUrl}
                    className="w-full max-w-md rounded-lg border border-border"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Recording playback not available.
                  </p>
                )}
              </div>

              {/* Scores */}
              {scores && (
                <div className="flex flex-wrap gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                  <span>
                    <span className="text-muted-foreground">Warm-up:</span>{" "}
                    {scores.warmup != null ? Math.round(scores.warmup * 100) : "—"}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Final:</span>{" "}
                    {scores.final != null ? Math.round(scores.final * 100) : "—"}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Overall:</span>{" "}
                    {scores.overall != null ? Math.round(scores.overall * 100) : "—"}
                  </span>
                </div>
              )}

              {/* Full report text */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Report
                </p>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                    {reportText || "No report text available."}
                  </p>
                </div>
              </div>
            </>
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
}
