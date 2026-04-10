"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Lottie from "lottie-react";
import ProgressOverSessionsChart from "@/components/homework/ProgressOverSessionsChart";
import CoachMessageBanner from "@/components/homework/shared/CoachMessageBanner";
import type { HomeworkReportResponse } from "@/lib/api/types-homework";
import type { LiveCoachSnapshot } from "@/lib/sniper/types";
import { normalizePercentScore, formatFillerBreakdown } from "@/lib/api/homework-utils";

interface Step3ReportScreenProps {
  sessionId: string | null;
  reportData: HomeworkReportResponse | null;
  reportLoading: boolean;
  reportError: string | null;
  reportNotReady: boolean;
  recordingProcessingFailed: boolean;
  performanceScoreEnd: number | null;
  sniperSnapshot: LiveCoachSnapshot | null;
  localTranscript: string;
  leavingReport: boolean;
  resetting: boolean;
  loadingLottieData: object | null;
  audioPlaybackError: boolean;
  coachMessage: string | null;
  tutorFeedbackDeadlineMs: number | null;
  onAudioPlaybackError: () => void;
  onRetryReport: () => void;
  onLeaveReport: () => void;
  onDoHomeworkAgain: () => void;
}

export default function Step3ReportScreen({
  reportData,
  reportLoading,
  reportError,
  reportNotReady,
  recordingProcessingFailed,
  performanceScoreEnd,
  sniperSnapshot,
  localTranscript,
  leavingReport,
  resetting,
  loadingLottieData,
  audioPlaybackError,
  coachMessage,
  onAudioPlaybackError,
  onRetryReport,
  onLeaveReport,
  onDoHomeworkAgain,
}: Step3ReportScreenProps) {
  if (recordingProcessingFailed) {
    return (
      <div className="mx-auto -mt-4 max-w-2xl space-y-4 animate-fade-in sm:-mt-6">
        <h3 className="text-center text-xl font-semibold">Your report</h3>
        <Card className="border-0 bg-transparent p-6 space-y-4 shadow-none">
          <p className="text-sm text-foreground">
            We couldn&apos;t process this recording. Please record again.
          </p>
          <Button onClick={onLeaveReport} disabled={leavingReport || resetting} className="w-full rounded-xl h-12 font-semibold">
            {leavingReport || resetting ? "Sending…" : "Start New Practice"}
          </Button>
        </Card>
      </div>
    );
  }

  // Canonical score source for all primary report UI (backend field names vary).
  const canonicalOverall =
    normalizePercentScore(reportData?.score_for_display) ??
    normalizePercentScore((reportData as { scoreForDisplay?: unknown } | null)?.scoreForDisplay) ??
    normalizePercentScore(reportData?.scores?.overall) ??
    normalizePercentScore(reportData?.scores?.final) ??
    normalizePercentScore(reportData?.score) ??
    normalizePercentScore(reportData?.performance_score_1) ??
    normalizePercentScore(performanceScoreEnd);
  const scoreReady = canonicalOverall != null;

  /** Full-screen loader only while we are actively fetching or the API asked us to retry later. */
  const showUnifiedLoading = reportLoading || reportNotReady;

  const canonicalFinalScore = scoreReady ? canonicalOverall : null;
  const reportCtaLabel = (reportData?.report_cta ?? "").trim() || "Finish the lesson and sign out";

  const performanceHistory = reportData?.performance_history ?? [];
  const lastFiveHistory = performanceHistory.filter(
    (p) => typeof p.score === "number" && Number.isFinite(p.score)
  ).slice(-5);
  const chartFromHistory = lastFiveHistory.map((p, i) => ({
    sessionLabel: `S${i + 1}`,
    date: p.date,
    score: p.score,
  }));

  // Chart: only render once we have backend-confirmed history or a final score.
  // Never show a provisional sniperSnapshot point — it causes jarring jumps.
  const progressChartData = (() => {
    if (chartFromHistory.length === 0 && canonicalFinalScore == null) return [];
    if (canonicalFinalScore != null && chartFromHistory.length > 0) {
      const updated = [...chartFromHistory];
      const last = updated[updated.length - 1];
      if (last) updated[updated.length - 1] = { ...last, score: canonicalFinalScore };
      return updated;
    }
    if (canonicalFinalScore != null) {
      return [{ sessionLabel: "S1", date: new Date().toISOString(), score: canonicalFinalScore }];
    }
    return chartFromHistory; // history already has real backend scores
  })();

  // Only show a score number once we have a backend-computed value.
  // sniperSnapshot is an unreliable real-time estimate — never show it as a headline number.
  const confirmedScore = canonicalFinalScore ?? null;

  const playbackUrl =
    reportData?.final_recording?.audio_url ??
    reportData?.recording?.audio_url ??
    reportData?.recording_1?.audio_url;

  const transcriptionText = (
    localTranscript ||
    reportData?.recording?.transcription_text ||
    reportData?.transcription_text ||
    reportData?.transcript ||
    ""
  ).trim();

  const backendBreakdown =
    reportData?.recording?.filler_words_count?.breakdown ??
    (reportData as { filler_words_breakdown?: Record<string, number> | null } | null)
      ?.filler_words_breakdown ??
    null;
  const backendTotalRaw =
    reportData?.recording?.filler_words_count?.total ??
    reportData?.filler_word_count ??
    (reportData as { filler_words_total?: number | null } | null)?.filler_words_total ??
    null;
  const computedTotalFromBreakdown = backendBreakdown
    ? Object.values(backendBreakdown).reduce(
        (sum, v) => sum + (Number.isFinite(v) ? Number(v) : 0),
        0
      )
    : 0;
  const fillerTotal =
    typeof backendTotalRaw === "number"
      ? backendTotalRaw === 0 && computedTotalFromBreakdown > 0
        ? computedTotalFromBreakdown
        : backendTotalRaw
      : computedTotalFromBreakdown > 0
        ? computedTotalFromBreakdown
        : null;
  const fillerBreakdown = backendBreakdown ?? undefined;

  const coachInsight = (reportData?.coach_insight ?? "").trim();
  const coachGrade =
    reportData?.report_grade ??
    (reportData as { grade?: number | null } | null)?.grade ??
    null;
  const coachGradeMessage = (
    reportData?.report_comment ??
    reportData?.coach_message ??
    (reportData as { coach_grade_message?: string | null } | null)?.coach_grade_message ??
    (reportData as { coach_feedback_message?: string | null } | null)?.coach_feedback_message ??
    (reportData as { grade_message?: string | null } | null)?.grade_message ??
    ""
  ).trim();
  const hasCoachFeedback = coachGrade != null || coachGradeMessage.length > 0;

  return (
    <div className="mx-auto -mt-4 max-w-2xl space-y-4 animate-fade-in sm:-mt-6">
      <h3 className="text-center text-xl font-semibold">Your report</h3>
      <CoachMessageBanner message={coachMessage} />
      <Card className="border-0 bg-transparent p-6 space-y-4 shadow-none">
        {reportError != null && reportData == null ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-3">
            <p className="text-sm text-foreground">We couldn&apos;t load full report details yet.</p>
            <p className="text-sm text-destructive">{reportError}</p>
            <Button
              onClick={onRetryReport}
              disabled={reportLoading}
              className="w-full rounded-xl h-11 font-semibold"
            >
              {reportLoading ? "Loading…" : "Try again"}
            </Button>
          </div>
        ) : null}

        {/* Unified loading block: single loader for both report prep + score analysis */}
        {showUnifiedLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <div className="h-12 w-12 opacity-80">
              {loadingLottieData ? (
                <Lottie animationData={loadingLottieData} loop />
              ) : (
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary/60 border-t-transparent" />
              )}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              We are baking your fresh lesson report 🤓
            </p>
          </div>
        ) : null}

        {/* Score headline — only show when backend confirms a number */}
        <div className="min-h-[32px] text-center">
          {!showUnifiedLoading ? (
            <p className="text-sm text-muted-foreground">
              Performance score:{" "}
              <span className="font-semibold text-foreground">
                {confirmedScore != null ? `${confirmedScore}%` : "—"}
              </span>
            </p>
          ) : null}
        </div>
        <div>
          {progressChartData.length > 0 && (
            <ProgressOverSessionsChart data={progressChartData} />
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Playback</p>
          {playbackUrl && !audioPlaybackError ? (
            <audio
              controls
              src={playbackUrl}
              className="w-full max-w-md"
              onError={onAudioPlaybackError}
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
          ) : reportLoading || reportNotReady ? (
            <p className="text-sm text-muted-foreground italic">Generating transcript…</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Transcript not available for this session.</p>
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
              <p className="text-sm text-muted-foreground">Coach insight is being prepared.</p>
            )}
          </div>
        </div>

        {hasCoachFeedback ? (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Coach feedback</p>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              {coachGrade != null ? (
                <p className="text-sm font-semibold text-foreground">
                  Grade: {coachGrade}/10
                </p>
              ) : null}
              {coachGradeMessage ? (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {coachGradeMessage}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <Button
          onClick={onLeaveReport}
          disabled={leavingReport || resetting}
          className="mt-2 w-full rounded-xl h-12 font-semibold"
        >
          {leavingReport ? "Signing out…" : reportCtaLabel}
        </Button>
        <div className="flex justify-center mt-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={leavingReport || resetting}
            onClick={onDoHomeworkAgain}
            className="text-muted-foreground hover:text-foreground"
          >
            {resetting ? "Resetting…" : "Do your homework again"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
