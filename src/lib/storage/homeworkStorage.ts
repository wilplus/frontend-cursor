/**
 * sessionStorage helpers for the homework flow.
 * Extracted from HomeworkFlowCard.tsx.
 */
import type { HomeworkReportResponse } from "@/lib/api/types-homework";

export const FINAL_REPORT_STORAGE_KEY = "homeworkReport";
export const FORCE_STEP0_WAITING_STORAGE_KEY = "homeworkForceStep0Waiting";
export const FORCE_STEP0_WAITING_TTL_MS = 30 * 60 * 1000;

export type PersistedFinalReportState = {
  sessionId: string;
  reportData: HomeworkReportResponse | null;
  performanceScoreEnd: number | null;
  reportText: string;
  localTranscript: string;
  coachMessageAfterHomework: string | null;
  tutorFeedbackDeadlineMs: number | null;
};

export type PersistedForcedStep0WaitingState = {
  createdAt: number;
  assignmentFingerprint: string | null;
};

export function readPersistedFinalReportState(): PersistedFinalReportState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FINAL_REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedFinalReportState>;
    if (!parsed || typeof parsed.sessionId !== "string" || !parsed.sessionId.trim()) {
      return null;
    }
    return {
      sessionId: parsed.sessionId.trim(),
      reportData: parsed.reportData ?? null,
      performanceScoreEnd: typeof parsed.performanceScoreEnd === "number" ? parsed.performanceScoreEnd : null,
      reportText: typeof parsed.reportText === "string" ? parsed.reportText : "",
      localTranscript: typeof parsed.localTranscript === "string" ? parsed.localTranscript : "",
      coachMessageAfterHomework:
        typeof parsed.coachMessageAfterHomework === "string" && parsed.coachMessageAfterHomework.trim()
          ? parsed.coachMessageAfterHomework
          : null,
      tutorFeedbackDeadlineMs:
        typeof parsed.tutorFeedbackDeadlineMs === "number" && Number.isFinite(parsed.tutorFeedbackDeadlineMs)
          ? parsed.tutorFeedbackDeadlineMs
          : null,
    };
  } catch {
    return null;
  }
}

export function persistFinalReportState(state: PersistedFinalReportState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(FINAL_REPORT_STORAGE_KEY, JSON.stringify(state));
}

export function clearPersistedFinalReportState() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(FINAL_REPORT_STORAGE_KEY);
}

export function readForcedStep0WaitingState(): PersistedForcedStep0WaitingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FORCE_STEP0_WAITING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      createdAt?: number;
      assignmentFingerprint?: unknown;
    };
    if (typeof parsed?.createdAt !== "number" || !Number.isFinite(parsed.createdAt)) {
      window.sessionStorage.removeItem(FORCE_STEP0_WAITING_STORAGE_KEY);
      return null;
    }
    if (Date.now() - parsed.createdAt > FORCE_STEP0_WAITING_TTL_MS) {
      window.sessionStorage.removeItem(FORCE_STEP0_WAITING_STORAGE_KEY);
      return null;
    }
    return {
      createdAt: parsed.createdAt,
      assignmentFingerprint:
        typeof parsed.assignmentFingerprint === "string" ? parsed.assignmentFingerprint : null,
    };
  } catch {
    window.sessionStorage.removeItem(FORCE_STEP0_WAITING_STORAGE_KEY);
    return null;
  }
}

export function persistForcedStep0WaitingState(assignmentFingerprint: string | null) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    FORCE_STEP0_WAITING_STORAGE_KEY,
    JSON.stringify({ createdAt: Date.now(), assignmentFingerprint })
  );
}

export function clearForcedStep0WaitingState() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(FORCE_STEP0_WAITING_STORAGE_KEY);
}
