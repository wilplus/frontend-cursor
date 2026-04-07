"use client";

import type { AdminSessionReportResponse } from "@/lib/api/admin-client";
import type { HomeworkReportResponse } from "@/lib/api/types-homework";

export type CompactReportPreview = {
  score: number | null;
  playbackUrl: string | null;
  transcriptExcerpt: string;
  fillerTotal: number | null;
  fillerBreakdownText: string;
  aiInsight: string;
  coachGrade: number | null;
  coachMessage: string;
};

function firstSentenceOrExcerpt(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  const first = match?.[1]?.trim() ?? trimmed;
  return first.length > 140 ? `${first.slice(0, 137).trim()}...` : first;
}

function formatFillerBreakdown(breakdown: Record<string, number> | null | undefined): string {
  if (!breakdown || typeof breakdown !== "object") return "";
  return Object.entries(breakdown)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([word, n]) => `${word} ${n}`)
    .join(", ");
}

function normalizePercentScore(v: number | null | undefined): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v <= 1 ? v * 100 : v);
}

export function toCompactReportPreview(
  report: HomeworkReportResponse | AdminSessionReportResponse | null | undefined
): CompactReportPreview | null {
  if (!report) return null;

  const score =
    normalizePercentScore((report as HomeworkReportResponse).score_for_display) ??
    normalizePercentScore(report.scores?.overall);

  const playbackUrl =
    report.final_recording?.audio_url ??
    report.recording?.audio_url ??
    (report as HomeworkReportResponse).recording_1?.audio_url ??
    null;

  const transcriptText = (
    report.recording?.transcription_text ??
    (report as HomeworkReportResponse).transcription_text ??
    report.transcript ??
    ""
  ).trim();

  const backendBreakdown =
    report.recording?.filler_words_count?.breakdown ??
    (report as HomeworkReportResponse & { filler_words_breakdown?: Record<string, number> | null })
      .filler_words_breakdown ??
    null;

  const backendTotalRaw =
    report.recording?.filler_words_count?.total ??
    report.filler_word_count ??
    (report as HomeworkReportResponse & { filler_words_total?: number | null }).filler_words_total ??
    null;

  const computedTotalFromBreakdown = backendBreakdown
    ? Object.values(backendBreakdown).reduce((sum, v) => sum + (Number.isFinite(v) ? Number(v) : 0), 0)
    : 0;

  const fillerTotal =
    typeof backendTotalRaw === "number"
      ? backendTotalRaw === 0 && computedTotalFromBreakdown > 0
        ? computedTotalFromBreakdown
        : backendTotalRaw
      : computedTotalFromBreakdown > 0
        ? computedTotalFromBreakdown
        : null;

  const aiInsight = (report.coach_insight ?? "").trim();
  const coachGrade =
    (report as HomeworkReportResponse).report_grade ??
    (report as AdminSessionReportResponse).report_grade ??
    (report as HomeworkReportResponse & { grade?: number | null }).grade ??
    null;
  const coachMessage = (
    (report as HomeworkReportResponse).coach_message ??
    (report as AdminSessionReportResponse).coach_message ??
    (report as HomeworkReportResponse & { coach_grade_message?: string | null }).coach_grade_message ??
    (report as HomeworkReportResponse & { coach_feedback_message?: string | null }).coach_feedback_message ??
    (report as HomeworkReportResponse & { grade_message?: string | null }).grade_message ??
    ""
  ).trim();

  return {
    score,
    playbackUrl,
    transcriptExcerpt: firstSentenceOrExcerpt(transcriptText),
    fillerTotal,
    fillerBreakdownText: formatFillerBreakdown(backendBreakdown),
    aiInsight,
    coachGrade,
    coachMessage,
  };
}
