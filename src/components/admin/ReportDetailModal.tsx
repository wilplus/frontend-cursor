"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  adminApi,
  type AdminSessionReportResponse,
  type RecordingReview,
} from "@/lib/api/admin-client";
import { Button } from "@/components/ui/button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { toast } from "sonner";
import ProgressOverSessionsChart from "@/components/homework/ProgressOverSessionsChart";
import { resolveAdminReportWpm } from "@/lib/admin/resolveWpm";

const DEFAULT_RUBRIC_VERSION = "v1";

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
  report_grade?: number | null;
  coach_message?: string | null;
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

type ReviewOverallQuality = RecordingReview["overall_quality"];

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
  const [audioPlaybackError, setAudioPlaybackError] = useState(false);
  const [coachGrade, setCoachGrade] = useState<number | null>(null);
  const [coachMessage, setCoachMessage] = useState("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [reviewOverallQuality, setReviewOverallQuality] = useState<ReviewOverallQuality | null>(null);
  const [reviewConfidenceScore, setReviewConfidenceScore] = useState<number | null>(null);
  const [reviewCoachStyleScore, setReviewCoachStyleScore] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewRubricVersion, setReviewRubricVersion] = useState(DEFAULT_RUBRIC_VERSION);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [savingReview, setSavingReview] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !session) {
      setReport(null);
      setError(null);
      setPlaybackUrl(null);
      setAudioPlaybackError(false);
      setCoachGrade(null);
      setCoachMessage("");
      setReviewOverallQuality(null);
      setReviewConfidenceScore(null);
      setReviewCoachStyleScore(null);
      setReviewNotes("");
      setReviewRubricVersion(DEFAULT_RUBRIC_VERSION);
      setReviewError(null);
      setReviewLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setPlaybackUrl(null);
    setAudioPlaybackError(false);
    adminApi
      .getStudentSessionReport(userId, session.id)
      .then((data) => {
        setReport(data);
        setError(null);
        setCoachGrade(
          data.report_grade != null ? data.report_grade : session.report_grade ?? null
        );
        setCoachMessage((data.coach_message ?? session.coach_message ?? "").trim());
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

  useEffect(() => {
    if (!open || !session) return;
    setReviewLoading(true);
    setReviewError(null);
    setReviewOverallQuality(null);
    setReviewConfidenceScore(null);
    setReviewCoachStyleScore(null);
    setReviewNotes("");
    setReviewRubricVersion(DEFAULT_RUBRIC_VERSION);
    adminApi
      .getSessionReview(userId, session.id)
      .then(({ review }) => {
        if (!review) return;
        setReviewOverallQuality(review.overall_quality);
        setReviewConfidenceScore(review.confidence_score);
        setReviewCoachStyleScore(review.coach_style_score);
        setReviewNotes((review.notes ?? "").trim());
        setReviewRubricVersion(review.rubric_version || DEFAULT_RUBRIC_VERSION);
      })
      .catch((e) => {
        setReviewError(e instanceof Error ? e.message : "Failed to load ML review");
      })
      .finally(() => setReviewLoading(false));
  }, [open, userId, session?.id]);

  useEffect(() => {
    if (!open || !session || !report) return;
    if ((report.coach_insight ?? "").trim()) return;

    let attempts = 0;
    const maxAttempts = 6;
    const intervalMs = 8000;
    const id = setInterval(() => {
      attempts += 1;
      adminApi
        .getStudentSessionReport(userId, session.id)
        .then((data) => {
          setReport(data);
          if ((data.coach_insight ?? "").trim()) {
            clearInterval(id);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (attempts >= maxAttempts) clearInterval(id);
        });
    }, intervalMs);

    return () => clearInterval(id);
  }, [open, report, session, userId]);

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
    if (report == null && session?.report_grade != null) {
      setCoachGrade(session.report_grade);
    }
    if (report == null && session?.coach_message != null) {
      setCoachMessage((session.coach_message ?? "").trim());
    }
  }, [report, session?.report_grade, session?.coach_message]);

  const handleSaveGrade = async () => {
    if (!session) return;
    setSavingGrade(true);
    try {
      const normalizedCoachMessage = coachMessage.trim();
      await adminApi.patchSession(userId, session.id, {
        report_grade: coachGrade,
        coach_message: normalizedCoachMessage || null,
      });
      setReport((prev) =>
        prev
          ? { ...prev, report_grade: coachGrade, coach_message: normalizedCoachMessage || null }
          : null
      );
      toast.success("Grade saved.");
      onGradeSaved?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save grade";
      toast.error(msg);
    } finally {
      setSavingGrade(false);
    }
  };

  const handleSaveReview = async () => {
    if (!session) return;
    if (!reviewOverallQuality || reviewConfidenceScore == null || reviewCoachStyleScore == null) {
      toast.error("Select overall quality, confidence score, and coach-style score before saving.");
      return;
    }
    setSavingReview(true);
    setReviewError(null);
    try {
      const { review } = await adminApi.patchSessionReview(userId, session.id, {
        recording_id: session.recording_id ?? null,
        overall_quality: reviewOverallQuality,
        confidence_score: reviewConfidenceScore,
        coach_style_score: reviewCoachStyleScore,
        notes: reviewNotes.trim() || null,
        rubric_version: reviewRubricVersion || DEFAULT_RUBRIC_VERSION,
      });
      setReviewOverallQuality(review.overall_quality);
      setReviewConfidenceScore(review.confidence_score);
      setReviewCoachStyleScore(review.coach_style_score);
      setReviewNotes((review.notes ?? "").trim());
      setReviewRubricVersion(review.rubric_version || DEFAULT_RUBRIC_VERSION);
      toast.success("ML review saved.");
      onGradeSaved?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save ML review";
      setReviewError(msg);
      toast.error(msg);
    } finally {
      setSavingReview(false);
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
  const maybePerformanceScore1 = (report as { performance_score_1?: number | null } | null)?.performance_score_1;
  const currentPerformanceScore1 =
    typeof maybePerformanceScore1 === "number"
      ? Math.round(maybePerformanceScore1 <= 1 ? maybePerformanceScore1 * 100 : maybePerformanceScore1)
      : undefined;
  const performanceResult = currentPerformanceScore1 ?? scores?.overall ?? null;
  const wordsPerMinute = resolveAdminReportWpm(report as Record<string, unknown> | null | undefined);
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
              {performanceResult != null ? (
                <p className="text-sm text-muted-foreground text-center">
                  Performance result: <span className="font-semibold text-foreground">{Math.round(performanceResult)}%</span>
                </p>
              ) : null}
              {wordsPerMinute != null ? (
                <p className="text-sm text-muted-foreground text-center">
                  Speaking rate:{" "}
                  <span className="font-semibold text-foreground">{Math.round(wordsPerMinute)} WPM</span>
                </p>
              ) : pace ? (
                <p className="text-sm text-muted-foreground text-center">
                  Pace: <span className="font-semibold text-foreground">{pace}</span>
                </p>
              ) : null}
              {/* 1. Progress chart */}
              {(() => {
                const lastFive = report?.performance_history?.length ? report.performance_history.slice(-5) : [];
                const chartData = lastFive.length > 0
                  ? lastFive.map((p, i) => ({ sessionLabel: `S${i + 1}`, date: p.date, score: p.score }))
                  : performanceResult != null
                    ? [{ sessionLabel: "S1", date: session?.created_at ?? new Date().toISOString(), score: Math.round(performanceResult) }]
                    : [];
                return chartData.length > 0 ? <ProgressOverSessionsChart data={chartData} /> : null;
              })()}

              {/* 2. Playback */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Playback</p>
                {audioUrl && !audioPlaybackError ? (
                  <audio
                    controls
                    src={audioUrl}
                    className="w-full max-w-md rounded-lg border border-border"
                    onError={() => setAudioPlaybackError(true)}
                  />
                ) : audioPlaybackError ? (
                  <p className="text-sm text-muted-foreground">Playback failed. The audio may be unavailable.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Playback not available for this session yet.</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Transcript</p>
                {transcriptionText ? (
                  <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-48 overflow-y-auto">
                    <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{transcriptionText}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Transcript not available for this session yet.</p>
                )}
              </div>

              <div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Filler words</p>
                  {fillerTotal != null ? (
                    <p className="text-sm text-foreground">
                      {fillerTotal} filler word{fillerTotal !== 1 ? "s" : ""} detected
                      {formatFillerBreakdown(fillerBreakdown) ? ` (${formatFillerBreakdown(fillerBreakdown)})` : ""}.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Filler word analysis is not available yet.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">AI Coach Insight</p>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  {coachInsight ? (
                    <p className="text-sm text-foreground leading-relaxed">{coachInsight}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Coach insight is being prepared.</p>
                  )}
                </div>
              </div>


              {session?.status === "completed" && (
              <div className="space-y-4">
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
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Message to student (shown in report)
                    </label>
                    <textarea
                      rows={3}
                      value={coachMessage}
                      onChange={(e) => setCoachMessage(e.target.value)}
                      placeholder="Great pacing improvement. Keep your pauses smooth."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">ML review</p>
                      <p className="text-xs text-muted-foreground">
                        Internal labels only. These notes are not shown to the student.
                      </p>
                    </div>
                    <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                      Rubric {reviewRubricVersion}
                    </span>
                  </div>
                  {reviewLoading ? (
                    <p className="text-sm text-muted-foreground">Loading ML review…</p>
                  ) : null}
                  {reviewError ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      {reviewError}
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-muted-foreground">
                      Overall quality
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(["good", "bad", "unclear"] as const).map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setReviewOverallQuality(value)}
                          className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                            reviewOverallQuality === value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:border-primary/50"
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-muted-foreground">
                      Confidence score (1–5)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setReviewConfidenceScore(n)}
                          className={`min-w-[2.25rem] rounded-lg border-2 px-2 py-1.5 text-sm font-medium transition-colors ${
                            reviewConfidenceScore === n
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:border-primary/50"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-muted-foreground">
                      Coach-style score (1–10)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setReviewCoachStyleScore(n)}
                          className={`min-w-[2.25rem] rounded-lg border-2 px-2 py-1.5 text-sm font-medium transition-colors ${
                            reviewCoachStyleScore === n
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background hover:border-primary/50"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Internal notes
                    </label>
                    <textarea
                      rows={4}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Why was this good, bad, or unclear?"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveReview}
                      disabled={
                        savingReview ||
                        reviewLoading ||
                        !reviewOverallQuality ||
                        reviewConfidenceScore == null ||
                        reviewCoachStyleScore == null
                      }
                    >
                      {savingReview ? "Saving…" : "Save ML review"}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Used for internal labeling and future ML training.
                    </span>
                  </div>
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
