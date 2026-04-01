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
            We couldn&apos;t process this recording, so a report can&apos;t be generated for this session.
          </p>
          <Button onClick={onLeaveReport} disabled={leavingReport || resetting} className="w-full rounded-xl h-12 font-semibold">
            {leavingReport || resetting ? "Sending…" : "Start New Practice"}
          </Button>
        </Card>
      </div>
    );
  }

  // Prefer score_for_display (canonical) over scores.overall which can be 0 on fallback completions
  const canonicalOverall = normalizePercentScore(reportData?.score_for_display);
  // A score of 0 means "not computed yet" — only treat positive values as a real final score.
  const scoreReady = canonicalOverall != null && canonicalOverall > 0;
  const insightReady = (reportData?.coach_insight ?? "").trim().length > 0;

  // While score hasn't arrived yet and coach insight isn't ready, consider the report still processing.
  // Once insight is present we stop spinning even if score stays 0 (edge case: AI returned no score).
  const reportProcessingIncomplete =
    reportData != null && !reportNotReady && !scoreReady && !insightReady;

  const waitingForFullReport =
    reportNotReady || reportProcessingIncomplete || (reportData == null && reportError == null);

  // Only use backend scores when overall > 0 — skip the 0-filled placeholder object
  const displayScores =
    (reportData?.scores && reportData.scores.overall > 0
      ? reportData.scores
      : null) ??
    (performanceScoreEnd != null
      ? { warmup: undefined, final: undefined, overall: Math.round(performanceScoreEnd * 100) }
      : sniperSnapshot != null
        ? { warmup: undefined, final: undefined, overall: Math.round(sniperSnapshot.performanceScore) }
        : undefined);

  // Treat 0 as null so the fallback chain (sniperSnapshot) is used instead of showing 0%
  const canonicalFinalScore = scoreReady ? canonicalOverall : null;
  const reportCtaLabel = (reportData?.report_cta ?? "").trim() || "Finish the lesson and sign out";

  const currentPerformanceScore1 =
    typeof reportData?.performance_score_1 === "number"
      ? Math.round(
          reportData.performance_score_1 <= 1
            ? reportData.performance_score_1 * 100
            : reportData.performance_score_1
        )
      : undefined;

  const performanceHistory = reportData?.performance_history ?? [];
  const lastFiveHistory = performanceHistory.length > 0 ? performanceHistory.slice(-5) : [];
  const chartFromHistory = lastFiveHistory.map((p, i) => ({
    sessionLabel: `S${i + 1}`,
    date: p.date,
    score: p.score,
  }));

  const provisionalChartData =
    chartFromHistory.length > 0
      ? chartFromHistory
      : currentPerformanceScore1 != null
        ? [{ sessionLabel: "S1", date: new Date().toISOString(), score: currentPerformanceScore1 }]
        : displayScores?.overall != null
          ? [{ sessionLabel: "S1", date: new Date().toISOString(), score: displayScores.overall }]
          : [];

  const progressChartData = (() => {
    if (waitingForFullReport || canonicalFinalScore == null) return provisionalChartData;
    if (chartFromHistory.length > 0) {
      const updated = [...chartFromHistory];
      const last = updated[updated.length - 1];
      if (last) updated[updated.length - 1] = { ...last, score: canonicalFinalScore };
      return updated;
    }
    return [{ sessionLabel: "S1", date: new Date().toISOString(), score: canonicalFinalScore }];
  })();

  const initialPerformanceResult = currentPerformanceScore1 ?? displayScores?.overall;
  const finalPerformanceResult = canonicalFinalScore ?? currentPerformanceScore1 ?? displayScores?.overall;
  const performanceResult = waitingForFullReport ? initialPerformanceResult : finalPerformanceResult;

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
      {waitingForFullReport && performanceResult != null ? (
        <div className="flex justify-center -mt-1">
          {loadingLottieData ? (
            <div className="w-10 h-10 opacity-70">
              <Lottie animationData={loadingLottieData} loop />
            </div>
          ) : (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/60 border-t-transparent" />
          )}
        </div>
      ) : null}
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

        {performanceResult != null ? (
          <p className="text-sm text-muted-foreground text-center">
            {waitingForFullReport ? "Initial performance score" : "Final performance score"}:{" "}
            <span className="font-semibold text-foreground">{performanceResult}%</span>
          </p>
        ) : null}

        {progressChartData.length > 0 && (
          <ProgressOverSessionsChart data={progressChartData} />
        )}

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
          ) : waitingForFullReport ? (
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
