"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { adminApi, type AdminSessionReportResponse } from "@/lib/api/admin-client";
import { Button } from "@/components/ui/button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { toast } from "sonner";
import ProgressOverSessionsChart from "@/components/homework/ProgressOverSessionsChart";

function formatFillerBreakdown(breakdown: Record<string, number> | undefined): string {
  if (!breakdown || typeof breakdown !== "object") return "";
  return Object.entries(breakdown)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([word, n]) => `${word}: ${n}`)
    .join(", ");
}

type SessionWithPreview = {
  id: string;
  created_at?: string;
  report_preview?: { report_text_preview?: string };
  recording_id?: string;
  coach_grade?: number | null;
  status?: string;
};

interface ReportDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  studentEmail: string | null;
  session: SessionWithPreview | null;
  /** Called after coach grade is saved so parent can refresh profile (e.g. load()). */
  onGradeSaved?: () => void;
}

export default function ReportDetailModal({
  open,
  onOpenChange,
  userId,
  studentEmail,
  session,
  onGradeSaved,
}: ReportDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AdminSessionReportResponse | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [coachGrade, setCoachGrade] = useState<number | null>(null);
  const [savingGrade, setSavingGrade] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !session) {
      setReport(null);
      setError(null);
      setPlaybackUrl(null);
      setCoachGrade(null);
      return;
    }
    setLoading(true);
    setError(null);
    setPlaybackUrl(null);
    adminApi
      .getStudentSessionReport(userId, session.id)
      .then((data) => {
        setReport(data);
        setError(null);
        setCoachGrade(
          data.coach_grade != null ? data.coach_grade : session.coach_grade ?? null
        );
        if (data.final_recording?.audio_url) {
          setPlaybackUrl(data.final_recording.audio_url);
        }
      })
      .catch((e) => {
        setReport(null);
        setError(e instanceof Error ? e.message : "Failed to load report");
      })
      .finally(() => setLoading(false));
  }, [open, userId, session?.id]);

  // When report API fails or doesn't return audio, try admin playback URL using session.recording_id
  useEffect(() => {
    if (!open || loading || playbackUrl) return;
    const recordingId = session?.recording_id;
    if (!recordingId) return;
    adminApi
      .getRecordingPlaybackUrl(recordingId)
      .then((r) => r.audio_url && setPlaybackUrl(r.audio_url))
      .catch(() => {});
  }, [open, loading, playbackUrl, session?.recording_id]);

  // Sync coach grade from session when report hasn't loaded yet
  useEffect(() => {
    if (report == null && session?.coach_grade != null) {
      setCoachGrade(session.coach_grade);
    }
  }, [report, session?.coach_grade]);

  const handleSaveGrade = async () => {
    if (!session) return;
    setSavingGrade(true);
    try {
      await adminApi.patchSession(userId, session.id, { coach_grade: coachGrade });
      setReport((prev) => (prev ? { ...prev, coach_grade: coachGrade } : null));
      toast.success("Grade saved.");
      onGradeSaved?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save grade";
      toast.error(msg);
    } finally {
      setSavingGrade(false);
    }
  };

  if (!open) return null;

  // Same data shape as student report: prefer report API, fallback to session preview
  const reportText =
    (report?.report_text ?? (session?.report_preview?.report_text_preview ?? "").trim()) || "";
  const audioUrl =
    playbackUrl ??
    report?.final_recording?.audio_url ??
    report?.recording?.audio_url ??
    null;
  const transcriptionText = (
    report?.recording?.transcription_text ?? report?.transcript ?? ""
  ).trim();
  const fillerTotal =
    report?.recording?.filler_words_count?.total ?? report?.filler_word_count ?? null;
  const fillerBreakdown = report?.recording?.filler_words_count?.breakdown;
  const strength = (report?.strength_metric ?? "").trim();
  const pace = (report?.pace_metric ?? "").trim();
  const coachInsight = (report?.coach_insight ?? "").trim();
  const scores = report?.scores;
  const dateLabel = session?.created_at
    ? new Date(session.created_at).toLocaleDateString(undefined, {
        dateStyle: "medium",
      })
    : "—";

  const overlay = (
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
              Full report API unavailable. Showing available preview data below.
            </p>
          )}

          {!loading && (
            <>
              {/* 1. Progress chart */}
              {(() => {
                const lastFive = report?.performance_history?.length ? report.performance_history.slice(-5) : [];
                const chartData = lastFive.length > 0
                  ? lastFive.map((p, i) => ({ sessionLabel: `S${i + 1}`, date: p.date, score: p.score }))
                  : scores?.overall != null
                    ? [{ sessionLabel: "S1", date: session?.created_at ?? new Date().toISOString(), score: Math.round(scores.overall) }]
                    : [];
                return chartData.length > 0 ? <ProgressOverSessionsChart data={chartData} /> : null;
              })()}

              {/* 2. Playback */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Your recording</p>
                {audioUrl ? (
                  <audio controls src={audioUrl} className="w-full max-w-md rounded-lg border border-border" />
                ) : (
                  <p className="text-sm text-muted-foreground">Recording playback not available.</p>
                )}
              </div>

              {/* 3. Filler words */}
              {fillerTotal != null && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Filler words</p>
                  <p className="text-sm text-foreground">
                    {fillerTotal} filler word{fillerTotal !== 1 ? "s" : ""} detected
                    {formatFillerBreakdown(fillerBreakdown) ? ` (${formatFillerBreakdown(fillerBreakdown)})` : ""}.
                  </p>
                </div>
              )}


              {session?.status === "completed" && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Grade this recording (1–10)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCoachGrade(null)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                      coachGrade === null
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    Not graded
                  </button>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCoachGrade(n)}
                      className={`min-w-[2.25rem] rounded-lg border-2 px-2 py-1.5 text-sm font-medium transition-colors ${
                        coachGrade === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveGrade}
                    disabled={savingGrade}
                  >
                    {savingGrade ? "Saving…" : "Save grade"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                      {coachGrade != null ? `Current: ${coachGrade}/10` : "Not graded"}
                    </span>
                </div>
              </div>
              )}
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

  if (typeof document !== "undefined" && document.body) {
    return createPortal(overlay, document.body);
  }
  return overlay;
}
