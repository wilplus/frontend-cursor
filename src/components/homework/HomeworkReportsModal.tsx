"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { homeworkApi } from "@/lib/api/homework-client";
import type { HomeworkReportResponse } from "@/lib/api/types-homework";
import { Button } from "@/components/ui/button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import ProgressOverSessionsChart from "@/components/homework/ProgressOverSessionsChart";

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
  const [fallbackAudioUrl, setFallbackAudioUrl] = useState<string | null>(null);
  const [audioPlaybackError, setAudioPlaybackError] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || !sessionId) {
      setReport(null);
      setReportError(null);
      setFallbackAudioUrl(null);
      setAudioPlaybackError(false);
      return;
    }
    setReportLoading(true);
    setReportError(null);
    setFallbackAudioUrl(null);
    setAudioPlaybackError(false);
    homeworkApi
      .getReport(sessionId)
      .then((data) => {
        setReport(data);
        setReportError(null);
        // If the report came back without a playable URL, fetch a fresh one via the recording endpoint.
        const reportAudioUrl = data.final_recording?.audio_url ?? data.recording?.audio_url ?? data.recording_1?.audio_url;
        const recordingId = data.final_recording?.id ?? data.recording_1?.id;
        if (!reportAudioUrl && recordingId) {
          homeworkApi.getRecordingPlaybackUrl(recordingId).then((r) => {
            if (r.audio_url) setFallbackAudioUrl(r.audio_url);
          }).catch(() => {});
        }
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
          {report && !reportLoading && (() => {
            const audioUrl = report.final_recording?.audio_url ?? report.recording?.audio_url ?? report.recording_1?.audio_url ?? fallbackAudioUrl;
            const displayScores = report.scores;
            const currentPerformanceScore1 =
              typeof report.performance_score_1 === "number"
                ? Math.round(report.performance_score_1 <= 1 ? report.performance_score_1 * 100 : report.performance_score_1)
                : undefined;
            const performanceResult = currentPerformanceScore1 ?? displayScores?.overall;
            const transcriptionText = (
              report.recording?.transcription_text ??
              report.transcription_text ??
              report.transcript ??
              ""
            ).trim();
            const backendBreakdown =
              report.recording?.filler_words_count?.breakdown ??
              (report as { filler_words_breakdown?: Record<string, number> | null }).filler_words_breakdown ??
              null;
            const backendTotalRaw =
              report.recording?.filler_words_count?.total ??
              report.filler_word_count ??
              (report as { filler_words_total?: number | null }).filler_words_total ??
              null;
            const computedTotalFromBreakdown = backendBreakdown
              ? Object.values(backendBreakdown).reduce((sum, v) => sum + (Number.isFinite(v) ? Number(v) : 0), 0)
              : 0;
            const fillerTotal =
              typeof backendTotalRaw === "number"
                ? (backendTotalRaw === 0 && computedTotalFromBreakdown > 0 ? computedTotalFromBreakdown : backendTotalRaw)
                : (computedTotalFromBreakdown > 0 ? computedTotalFromBreakdown : null);
            const fillerBreakdown = backendBreakdown ?? undefined;
            const coachInsight = (report.coach_insight ?? "").trim();
            const lastFive = report.performance_history?.length ? report.performance_history.slice(-5) : [];
            const chartData = lastFive.length > 0
              ? lastFive.map((p, i) => ({ sessionLabel: `S${i + 1}`, date: p.date, score: p.score }))
              : performanceResult != null
                ? [{ sessionLabel: "S1", date: new Date().toISOString(), score: Math.round(performanceResult) }]
                : [];
            return (
              <div className="space-y-4">
                {performanceResult != null ? (
                  <p className="text-sm text-muted-foreground text-center">
                    Performance result: <span className="font-semibold text-foreground">{performanceResult}%</span>
                  </p>
                ) : null}
                {chartData.length > 0 && <ProgressOverSessionsChart data={chartData} />}
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
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">AI Coach Insight</p>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    {coachInsight ? (
                      <p className="text-sm text-foreground leading-relaxed">{coachInsight}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">AI Coach Insight is still loading…</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
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
