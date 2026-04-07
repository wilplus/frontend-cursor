"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthReady } from "@/hooks/useAuthReady";
import { homeworkApi, type HomeworkApiError, type SelfRatingResponse } from "@/lib/api/homework-client";
import type {
  HomeworkSessionStatus,
  HomeworkReportResponse,
  HomeworkResponse,
} from "@/lib/api/types-homework";
import {
  deriveHomeworkStep,
  getStatusToHomeworkResponse,
  toPublicStatus,
  type Step as StepType,
  type PublicHomeworkStatus,
} from "@/lib/api/types-homework";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { LiveCoachSnapshot, UserSniperProfile } from "@/lib/sniper/types";
import type { CompactReportPreview } from "@/lib/reports/compact-preview";
import { toCompactReportPreview } from "@/lib/reports/compact-preview";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useRecordingContext } from "@/components/dashboard/DashboardShell";

// Utility imports (previously inlined)
import {
  DEFAULT_TASK_PROMPT,
  resolveTaskText,
} from "@/lib/api/homework-utils";
import {
  isNoWarmupError,
  isInvalidSessionStateError,
  isRecordingProcessingFailedError,
  isReportNotReadyError,
  isSessionGoneError,
} from "@/lib/api/homework-errors";
import {
  FINAL_REPORT_STORAGE_KEY as _FINAL_REPORT_STORAGE_KEY,
  FORCE_STEP0_WAITING_STORAGE_KEY as _FORCE_STEP0_WAITING_STORAGE_KEY,
  FORCE_STEP0_WAITING_TTL_MS as _FORCE_STEP0_WAITING_TTL_MS,
  type PersistedFinalReportState,
  readPersistedFinalReportState,
  persistFinalReportState,
  clearPersistedFinalReportState,
  readForcedStep0WaitingState,
  persistForcedStep0WaitingState,
  clearForcedStep0WaitingState,
} from "@/lib/storage/homeworkStorage";
import {
  getSniperProfileFromReport,
  getSniperProfileFromStatusPayload,
} from "@/lib/sniper/homework-sniper";

// Step screen components
import Step0Screen from "@/components/homework/step0/Step0Screen";
import Step1RecordingScreen from "@/components/homework/step1/Step1RecordingScreen";
import Step2SelfRatingScreen from "@/components/homework/step2/Step2SelfRatingScreen";
import Step3ReportScreen from "@/components/homework/step3/Step3ReportScreen";

type Step = StepType;

// One auto-start per page load (avoids double request in React Strict Mode). Reset when user finishes and goes to dashboard so next visit starts fresh.
let autoStartAttempted = false;
function resetAutoStartAttempted() {
  autoStartAttempted = false;
}

const STEP0_REPORTS_PAGE_SIZE = 5;
const REVIEW_PENDING_DEFAULT_MESSAGE =
  "Your homework has been sent and is now being reviewed.";

function isHomeworkReadyForStep0(statusRes: HomeworkSessionStatus | null | undefined): boolean {
  if (!statusRes) return false;
  if (statusRes.has_active_session === true) return false;
  if (statusRes.review_pending === true) return false;
  return true;
}

function maxStep(a: Step, b: Step): Step {
  return Math.max(a, b) as Step;
}

export default function HomeworkFlowCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authReady = useAuthReady();
  const { setRecordingActive, setShowNavbar } = useRecordingContext();
  const [step, setStep] = useState<Step>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [reportText, setReportText] = useState("");
  const [performanceScoreEnd, setPerformanceScoreEnd] = useState<number | null>(null);
  const [reportData, setReportData] = useState<HomeworkReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [localTranscript, setLocalTranscript] = useState("");
  const localTranscriptRef = useRef("");
  const [reportNotReady, setReportNotReady] = useState(false);
  const [reportRetryCount, setReportRetryCount] = useState(0);
  const reportNotReadyBackoffAttemptRef = useRef(0);
  /** Bumped when entering step 3 or changing session there so GET /report refetches (avoids stale sessionStorage / first response). */
  const [reportMountNonce, setReportMountNonce] = useState(0);
  const prevStepForReportNonceRef = useRef<Step>(0);
  const prevSessionIdForReportNonceRef = useRef<string | null>(null);
  const [audioPlaybackError, setAudioPlaybackError] = useState(false);
  const [loadingLottieData, setLoadingLottieData] = useState<object | null>(null);
  const [leavingReport, setLeavingReport] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingRecording, setUploadingRecording] = useState<1 | 2 | null>(null);
  const [noWarmupConfigured, setNoWarmupConfigured] = useState(false);
  const [statusUnknown, setStatusUnknown] = useState(false);
  const [resetting, setResetting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const metricSubmitInProgress = useRef(false);
  const uploadRecording1InProgressRef = useRef(false);
  const [tutorFeedbackDeadlineMs, setTutorFeedbackDeadlineMs] = useState<number | null>(null);
  const [tutorFeedbackMessage, setTutorFeedbackMessage] = useState<string | null>(null);
  const [reviewPending, setReviewPending] = useState(false);
  const [mainScreenMessage, setMainScreenMessage] = useState<string | null>(null);
  const [step0TutorVideoUrl, setStep0TutorVideoUrl] = useState<string | null>(null);
  const [step0TutorVideoDescription, setStep0TutorVideoDescription] = useState<string | null>(null);
  const [coachMessageAfterHomework, setCoachMessageAfterHomework] = useState<string | null>(null);
  const [assignedExercises, setAssignedExercises] = useState<Array<{ id: string; title: string; video_url?: string | null; description?: string | null }>>([]);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [sniperSnapshot, setSniperSnapshot] = useState<LiveCoachSnapshot | null>(null);
  const sniperSnapshotRef = useRef<LiveCoachSnapshot | null>(null);
  const [sniperProfile, setSniperProfile] = useState<UserSniperProfile | null>(null);
  const forcedStep0WaitingRef = useRef(false);
  const leavingReportRef = useRef(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [showInsufficientCreditsModal, setShowInsufficientCreditsModal] = useState(false);
  const [studentSpeechRatingSubmitted, setStudentSpeechRatingSubmitted] = useState(false);
  const [savingStudentRating, setSavingStudentRating] = useState(false);
  const [recordingProcessingFailed, setRecordingProcessingFailed] = useState(false);
  const [pendingRetrySelfRating, setPendingRetrySelfRating] = useState<
    { sessionId: string; rating: number } | { sessionId: string; skipped: true } | null
  >(null);
  const lastSelfRatingPayloadRef = useRef<
    { sessionId: string; rating: number } | { sessionId: string; skipped: true } | null
  >(null);
  const hasSetPendingRetryFrom409Ref = useRef(false);
  const [countdownTick, setCountdownTick] = useState(0);
  void countdownTick;
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  const [reportModalSessionId, setReportModalSessionId] = useState<string | null>(null);
  const [step0Sessions, setStep0Sessions] = useState<Array<{ id: string; created_at?: string; completed_at?: string; status?: string; report_grade?: number | null; recording_id?: string; report_id?: string; report_delivered?: boolean | null; student_completion_email_sent_at?: string | null; report_preview?: { report_text_preview?: string } }>>([]);
  const [step0SessionsLoading, setStep0SessionsLoading] = useState(false);
  const [showReportsList, setShowReportsList] = useState(false);
  const [visibleReportsCount, setVisibleReportsCount] = useState(STEP0_REPORTS_PAGE_SIZE);
  const [step0ReportPreviews, setStep0ReportPreviews] = useState<Record<string, CompactReportPreview | null>>({});
  const [step0ReportPreviewLoading, setStep0ReportPreviewLoading] = useState<Record<string, boolean>>({});
  const [pollReportsAfterFinish, setPollReportsAfterFinish] = useState(false);
  const reportDeepLinkHandledRef = useRef(false);
  const completionPostedSessionsRef = useRef<Set<string>>(new Set());
  const stepRef = useRef(step);
  stepRef.current = step;
  const persistedFinalReportRef = useRef<PersistedFinalReportState | null>(
    typeof window === "undefined" ? null : readPersistedFinalReportState()
  );

  useEffect(() => {
    if (!readForcedStep0WaitingState()) return;
    forcedStep0WaitingRef.current = true;
    if (stepRef.current !== 0) return;
    setReviewPending(true);
    setMainScreenMessage((prev) => prev ?? REVIEW_PENDING_DEFAULT_MESSAGE);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const refreshSniperProfile = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch("/api/user/sniper-profile", signal ? { signal } : undefined);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to load sniper profile");
      const data = await response.json().catch(() => null);
      if (data && typeof data.user_id === "string") {
        setSniperProfile(data);
        return data;
      }
      return null;
    },
    []
  );

  const syncDashboardStateFromStatus = useCallback(
    (statusRes: HomeworkSessionStatus | null | undefined) => {
      if (forcedStep0WaitingRef.current && isHomeworkReadyForStep0(statusRes)) {
        forcedStep0WaitingRef.current = false;
        clearForcedStep0WaitingState();
      }
      const deadlineIso = statusRes?.tutor_feedback_deadline;
      if (deadlineIso && typeof deadlineIso === "string") {
        const ms = new Date(deadlineIso).getTime();
        setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
      } else {
        setTutorFeedbackDeadlineMs(null);
      }

      const feedbackMessage = statusRes?.tutor_feedback_message;
      setTutorFeedbackMessage(
        typeof feedbackMessage === "string" && feedbackMessage.trim()
          ? feedbackMessage.trim()
          : null
      );

      const backendReviewPending = statusRes?.review_pending === true;
      const shouldForceWaiting = forcedStep0WaitingRef.current && !isHomeworkReadyForStep0(statusRes);
      setReviewPending(backendReviewPending || shouldForceWaiting);
      const waitingMessage = statusRes?.main_screen_message;
      setMainScreenMessage(
        typeof waitingMessage === "string" && waitingMessage.trim()
          ? waitingMessage.trim()
          : shouldForceWaiting
            ? REVIEW_PENDING_DEFAULT_MESSAGE
            : null
      );

      const tutorVideoUrl = statusRes?.tutor_video_url ?? statusRes?.session?.tutor_video_url ?? null;
      setStep0TutorVideoUrl(
        typeof tutorVideoUrl === "string" && tutorVideoUrl.trim() ? tutorVideoUrl.trim() : null
      );
      const tutorVideoDescription =
        statusRes?.tutor_video_description ?? statusRes?.session?.tutor_video_description ?? null;
      setStep0TutorVideoDescription(
        typeof tutorVideoDescription === "string" && tutorVideoDescription.trim()
          ? tutorVideoDescription.trim()
          : null
      );

      if (Array.isArray(statusRes?.assigned_exercises)) {
        setAssignedExercises(statusRes!.assigned_exercises!);
      } else {
        setAssignedExercises([]);
      }

      setSniperProfile((prev) => getSniperProfileFromStatusPayload(statusRes, prev) ?? prev);
      if (statusRes?.credits != null) {
        setCredits(statusRes.credits);
      }
    },
    []
  );

  const restorePersistedFinalReport = useCallback((persisted: PersistedFinalReportState | null): boolean => {
    if (!persisted?.sessionId) return false;
    setSessionId(persisted.sessionId);
    setReportData(persisted.reportData);
    setPerformanceScoreEnd(persisted.performanceScoreEnd);
    setReportText(persisted.reportText);
    setLocalTranscript(persisted.localTranscript);
    localTranscriptRef.current = persisted.localTranscript;
    setCoachMessageAfterHomework(persisted.coachMessageAfterHomework);
    setReportError(null);
    setReportNotReady(false);
    setRecordingProcessingFailed(false);
    if (persisted.tutorFeedbackDeadlineMs && persisted.tutorFeedbackDeadlineMs > Date.now()) {
      setTutorFeedbackDeadlineMs(persisted.tutorFeedbackDeadlineMs);
    }
    setStep(3);
    return true;
  }, []);

  const clearSessionCommunication = useCallback(() => {
    forcedStep0WaitingRef.current = false;
    clearForcedStep0WaitingState();
    leavingReportRef.current = false;
    setCoachMessageAfterHomework(null);
    setTutorFeedbackDeadlineMs(null);
    setTutorFeedbackMessage(null);
    setReviewPending(false);
    setMainScreenMessage(null);
    setStep0TutorVideoUrl(null);
    setStep0TutorVideoDescription(null);
  }, []);

  const activateForcedStep0Waiting = useCallback(() => {
    forcedStep0WaitingRef.current = true;
    persistForcedStep0WaitingState();
    setPollReportsAfterFinish(true);
    setSessionId(null);
    setTask("");
    setReportText("");
    setPerformanceScoreEnd(null);
    setReportData(null);
    setCoachMessageAfterHomework(null);
    setShowReportsList(false);
    setReportsModalOpen(false);
    setReportModalSessionId(null);
    setVideoModalUrl(null);
    setReportError(null);
    setReportNotReady(false);
    setReportLoading(false);
    setStep0TutorVideoUrl(null);
    setStep0TutorVideoDescription(null);
    setReviewPending(true);
    setMainScreenMessage(REVIEW_PENDING_DEFAULT_MESSAGE);
    setStep(0);
  }, []);

  useEffect(() => {
    if (!authReady || step !== 0) return;
    homeworkApi.getStatus().then((statusRes) => {
      syncDashboardStateFromStatus(statusRes);
      if (pollReportsAfterFinish && !statusRes?.review_pending) {
        setReviewPending(true);
        setMainScreenMessage((prev) => prev ?? REVIEW_PENDING_DEFAULT_MESSAGE);
      }
    }).catch((err) => {
      setTutorFeedbackDeadlineMs(null);
      setTutorFeedbackMessage(null);
      if (!pollReportsAfterFinish && !forcedStep0WaitingRef.current) {
        setReviewPending(false);
        setMainScreenMessage(null);
      }
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[HomeworkFlow] Step 0 status refetch failed (timer may not show):", err);
      }
    });
  }, [authReady, step, syncDashboardStateFromStatus, pollReportsAfterFinish]);

  const fetchStep0Reports = useCallback(() => {
    if (step0SessionsLoading) return;
    setStep0SessionsLoading(true);
    homeworkApi
      .getSessions()
      .then((data) => {
        const deliveredSessions = [...(data.sessions ?? [])];
        deliveredSessions.sort(
          (a, b) =>
            (b.completed_at || b.created_at || "").localeCompare(a.completed_at || a.created_at || "")
        );
        setStep0Sessions(deliveredSessions);
      })
      .catch((e) => {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[HomeworkFlow] reports list fetch failed", e);
        }
      })
      .finally(() => setStep0SessionsLoading(false));
  }, [step0SessionsLoading]);

  useEffect(() => {
    if (step !== 0 || !pollReportsAfterFinish) return;
    let attempts = 0;
    const maxAttempts = 10;
    const tick = () => {
      attempts += 1;
      fetchStep0Reports();
      homeworkApi
        .getStatus()
        .then((statusRes) => {
          syncDashboardStateFromStatus(statusRes);
        })
        .catch(() => {});
      if (attempts >= maxAttempts) setPollReportsAfterFinish(false);
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [step, pollReportsAfterFinish, fetchStep0Reports, syncDashboardStateFromStatus]);

  useEffect(() => {
    if (step !== 0 || !reviewPending) return;
    const pullLatestStep0Status = () => {
      homeworkApi
        .getStatus()
        .then((statusRes) => {
          syncDashboardStateFromStatus(statusRes);
        })
        .catch(() => {});
    };

    pullLatestStep0Status();
    const id = setInterval(pullLatestStep0Status, 3_000);
    return () => clearInterval(id);
  }, [step, reviewPending, syncDashboardStateFromStatus]);

  useEffect(() => {
    if (step !== 0 || !reviewPending) return;

    const pullLatestStep0Status = () => {
      homeworkApi
        .getStatus()
        .then((statusRes) => {
          syncDashboardStateFromStatus(statusRes);
        })
        .catch(() => {});
    };

    const onVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      pullLatestStep0Status();
    };

    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, [step, reviewPending, syncDashboardStateFromStatus]);

  useEffect(() => {
    if (step !== 0 || !showReportsList) return;
    const id = setInterval(() => {
      setStep0ReportPreviews((prev) => {
        const next = { ...prev };
        let changed = false;
        step0Sessions.forEach((session) => {
          if (next[session.id] === null) {
            delete next[session.id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      fetchStep0Reports();
    }, 8000);
    return () => clearInterval(id);
  }, [step, showReportsList, fetchStep0Reports, step0Sessions]);

  useEffect(() => {
    if (step !== 0 || !showReportsList || step0Sessions.length === 0) return;
    step0Sessions.slice(0, visibleReportsCount).forEach((session) => {
      if (step0ReportPreviews[session.id] !== undefined || step0ReportPreviewLoading[session.id]) return;
      setStep0ReportPreviewLoading((prev) => ({ ...prev, [session.id]: true }));
      homeworkApi
        .getReport(session.id)
        .then((report) => {
          setStep0ReportPreviews((prev) => ({ ...prev, [session.id]: toCompactReportPreview(report) }));
        })
        .catch(() => {
          setStep0ReportPreviews((prev) => ({ ...prev, [session.id]: null }));
        })
        .finally(() => {
          setStep0ReportPreviewLoading((prev) => ({ ...prev, [session.id]: false }));
        });
    });
  }, [step, showReportsList, step0Sessions, step0ReportPreviews, step0ReportPreviewLoading, visibleReportsCount]);

  useEffect(() => {
    if (pollReportsAfterFinish && step0Sessions.length > 0) {
      setPollReportsAfterFinish(false);
    }
  }, [pollReportsAfterFinish, step0Sessions.length]);

  useEffect(() => {
    if (!showReportsList) return;
    setVisibleReportsCount(STEP0_REPORTS_PAGE_SIZE);
  }, [showReportsList]);

  useEffect(() => {
    if (reportDeepLinkHandledRef.current) return;
    const shouldShowReports = searchParams.get("showReports");
    const targetSessionId = searchParams.get("openReportSessionId");
    const homeworkState = searchParams.get("homeworkState");
    if (shouldShowReports !== "1" && !targetSessionId && homeworkState !== "waiting") return;

    reportDeepLinkHandledRef.current = true;

    if (homeworkState === "waiting") {
      clearPersistedFinalReportState();
      persistedFinalReportRef.current = null;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      activateForcedStep0Waiting();

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("homeworkState");
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `/dashboard?${nextQuery}` : "/dashboard");
      return;
    }

    setShowReportsList(true);
    fetchStep0Reports();

    if (targetSessionId && targetSessionId.trim()) {
      setReportModalSessionId(targetSessionId.trim());
      setReportsModalOpen(true);
    }
  }, [activateForcedStep0Waiting, fetchStep0Reports, router, searchParams]);

  useEffect(() => {
    if (tutorFeedbackDeadlineMs == null) return;
    const id = setInterval(() => {
      if (Date.now() >= tutorFeedbackDeadlineMs) {
        setTutorFeedbackDeadlineMs(null);
      } else {
        setCountdownTick((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [tutorFeedbackDeadlineMs]);

  const TUTOR_DEADLINE_POLL_INTERVAL_MS = 45_000;
  useEffect(() => {
    if (!authReady || step !== 0 || tutorFeedbackDeadlineMs == null) return;
    const id = setInterval(() => {
      homeworkApi.getStatus().then((statusRes) => {
        syncDashboardStateFromStatus(statusRes);
      }).catch(() => {});
    }, TUTOR_DEADLINE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authReady, step, syncDashboardStateFromStatus, tutorFeedbackDeadlineMs]);

  useEffect(() => {
    setShowNavbar(step === 0 || step === 2 || step === 3);
  }, [step, setShowNavbar]);

  useEffect(() => {
    if (step !== 1) setRecordingActive(false);
  }, [step, setRecordingActive]);

  const applyStatusToState = (res: HomeworkResponse) => {
    const status: PublicHomeworkStatus = res.status ?? "none";
    if (status === "none") {
      setStep(0);
    }
    setStatusUnknown(false);
    setError(null);

    if (res.session_id != null) setSessionId(res.session_id);
    if (status === "none") {
      setSessionId(null);
      setTask("");
      setReportText("");
      setPerformanceScoreEnd(null);
      setReportData(null);
      setReviewPending(res.review_pending === true);
      setMainScreenMessage(
        typeof res.main_screen_message === "string" && res.main_screen_message.trim()
          ? res.main_screen_message.trim()
          : null
      );
      if ("tutor_video_url" in res) {
        const videoUrl = res.tutor_video_url;
        setStep0TutorVideoUrl(typeof videoUrl === "string" && videoUrl.trim() ? videoUrl.trim() : null);
      }
      if ("tutor_video_description" in res) {
        const desc = res.tutor_video_description;
        setStep0TutorVideoDescription(typeof desc === "string" && desc.trim() ? desc.trim() : null);
      }
      setCoachMessageAfterHomework(null);
      setPendingRetrySelfRating(null);
      hasSetPendingRetryFrom409Ref.current = false;
      setRecordingProcessingFailed(false);
      setLocalTranscript("");
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      return;
    }

    setReviewPending(false);
    setMainScreenMessage(null);
    if ("task" in res && res.task !== undefined) {
      setTask(resolveTaskText(res.task));
    }
    // Only store score when it's a real positive value — 0 is a placeholder before scoring completes
    if ("score" in res && res.score != null && (res.score as number) > 0) setPerformanceScoreEnd(res.score as number);
    if ("report_text" in res && res.report_text !== undefined) setReportText(res.report_text ?? "");
    if ("tutor_feedback_deadline" in res) {
      const deadlineIso = res.tutor_feedback_deadline;
      if (deadlineIso && typeof deadlineIso === "string") {
        const ms = new Date(deadlineIso).getTime();
        setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
      } else {
        setTutorFeedbackDeadlineMs(null);
      }
    } else {
      setTutorFeedbackDeadlineMs(null);
    }
    if ("tutor_feedback_message" in res) {
      const msg = res.tutor_feedback_message;
      setTutorFeedbackMessage(typeof msg === "string" && msg.trim() ? msg.trim() : null);
    }
    if ("tutor_video_url" in res) {
      const videoUrl = res.tutor_video_url;
      setStep0TutorVideoUrl(typeof videoUrl === "string" && videoUrl.trim() ? videoUrl.trim() : null);
    }
    if ("tutor_video_description" in res) {
      const desc = res.tutor_video_description;
      setStep0TutorVideoDescription(typeof desc === "string" && desc.trim() ? desc.trim() : null);
      setCoachMessageAfterHomework(typeof desc === "string" && desc.trim() ? desc.trim() : null);
    }
    if (Array.isArray(res.assigned_exercises)) {
      setAssignedExercises(res.assigned_exercises);
    }
    setSniperProfile((prev) => getSniperProfileFromStatusPayload(res, prev) ?? prev);
  };

  const applyBackendStep0Status = useCallback(
    (statusRes: HomeworkSessionStatus | null | undefined) => {
      applyStatusToState(getStatusToHomeworkResponse(statusRes ?? { status: "none" }));
      syncDashboardStateFromStatus(statusRes);
    },
    [syncDashboardStateFromStatus]
  );

  const handleStart = async () => {
    if (credits !== null && credits < 5) {
      setShowInsufficientCreditsModal(true);
      return;
    }
    setLoading(true);
    setError(null);
    setStatusUnknown(false);
    try {
      const startRes = await homeworkApi.start();
      const taskFromStart =
        startRes.task ??
        (startRes as { warm_up_task?: { text?: string } }).warm_up_task?.text ??
        (startRes as { warm_up_task_text?: string }).warm_up_task_text ??
        "";
      applyStatusToState({
        status: "recording_1_required",
        session_id: startRes.session_id,
        task: taskFromStart || null,
      });
      setStep(1);
    } catch (e) {
      if (isNoWarmupError(e)) {
        setNoWarmupConfigured(true);
        setError(null);
        applyStatusToState({ status: "none" });
        return;
      }
      const apiErr = e as HomeworkApiError;
      if (apiErr.code === "INSUFFICIENT_CREDITS") {
        setShowInsufficientCreditsModal(true);
        return;
      }
      if (apiErr.code === "SESSION_START_BLOCKED") {
        try {
          const statusRes = await homeworkApi.getStatus();
          applyBackendStep0Status(statusRes);
          setError(null);
        } catch {
          setReviewPending(true);
          setMainScreenMessage((prev) => prev ?? REVIEW_PENDING_DEFAULT_MESSAGE);
        }
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to start practice";
      const isBackendUnavailable = msg.includes("not available yet") || msg.includes("404");
      if (isBackendUnavailable) {
        applyStatusToState({ status: "recording_1_required", session_id: "mock-session" });
        setTask("");
        setError(null);
        setStatusUnknown(false);
        setStep(1);
      } else {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveReport = async () => {
    setLeavingReport(true);
    leavingReportRef.current = true;
    setError(null);
    clearForcedStep0WaitingState();
    clearPersistedFinalReportState();
    persistedFinalReportRef.current = null;
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("homeworkJustFinishedRecording2");
    }
    try {
      await createClient().auth.signOut();
    } catch {
      // Ignore sign-out failures and still force navigation to login.
    }
    leavingReportRef.current = false;
    setLeavingReport(false);
    router.push("/logged-out");
  };

  const handleStartOver = async () => {
    if (resetting) return;
    const comingFromReport = step === 3;
    if (!comingFromReport) {
      resetAutoStartAttempted();
    }
    setResetting(true);
    setSniperSnapshot(null);
    sniperSnapshotRef.current = null;
    setStudentSpeechRatingSubmitted(false);
    setSavingStudentRating(false);
    try {
      clearPersistedFinalReportState();
      persistedFinalReportRef.current = null;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      const shouldAbandonActiveSession = step !== 3;
      const shouldPollReports = step === 3;
      if (shouldAbandonActiveSession && sessionId && sessionId !== "mock-session") {
        try {
          await homeworkApi.abandonSession(sessionId);
        } catch (e) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[HomeworkFlow] abandonSession failed on reset", e);
          }
        }
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      metricSubmitInProgress.current = false;
      uploadRecording1InProgressRef.current = false;
      applyStatusToState({ status: "none" });
      setReportLoading(false);
      setReportError(null);
      setError(null);
      setNoWarmupConfigured(false);
      setStatusUnknown(false);
      setLoading(false);
      setUploadingRecording(null);
      if (shouldPollReports) {
        activateForcedStep0Waiting();
      }
      homeworkApi.getStatus().then((statusRes) => {
        syncDashboardStateFromStatus(statusRes);
        if (comingFromReport && !statusRes?.review_pending) {
          setReviewPending(true);
          setMainScreenMessage((prev) => prev ?? REVIEW_PENDING_DEFAULT_MESSAGE);
        }
      }).catch((err) => {
        setTutorFeedbackDeadlineMs(null);
        setTutorFeedbackMessage(null);
        if (!comingFromReport) {
          setReviewPending(false);
          setMainScreenMessage(null);
        }
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[HomeworkFlow] Status refetch after Send to coach failed:", err);
        }
      });
    } finally {
      setResetting(false);
    }
  };

  const handleAbandon = async () => {
    const shouldReturnToForcedWaiting = forcedStep0WaitingRef.current;
    if (!sessionId || sessionId === "mock-session") {
      handleStartOver();
      return;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    uploadRecording1InProgressRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const result = await homeworkApi.abandonSession(sessionId);
      if (result.message?.toLowerCase().includes("not found") || result.message?.toLowerCase().includes("already cleared")) {
        toast.success("Session was already cleared. You can start a new session.");
      } else {
        toast.success("Session abandoned. You can start a new session.");
      }
    } catch (e) {
      if (isSessionGoneError(e)) {
        toast.success("Session was already cleared. You can start a new session.");
      } else {
        toast.success("Session cleared. You can start a new session.");
        setError(null);
      }
    }
    metricSubmitInProgress.current = false;
    uploadRecording1InProgressRef.current = false;
    clearSessionCommunication();
    clearPersistedFinalReportState();
    persistedFinalReportRef.current = null;
    applyStatusToState({ status: "none" });
    if (shouldReturnToForcedWaiting) {
      activateForcedStep0Waiting();
    }
    setLoading(false);
  };

  const startOverFromScratch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    metricSubmitInProgress.current = false;
    uploadRecording1InProgressRef.current = false;
    clearSessionCommunication();
    clearPersistedFinalReportState();
    persistedFinalReportRef.current = null;
    applyStatusToState({ status: "none" });
  };

  // Cold load: restore the visible step from backend session state.
  useEffect(() => {
    if (!authReady || step !== 0 || autoStartAttempted) return;
    autoStartAttempted = true;
    setLoading(true);
    let cancelled = false;
    homeworkApi
      .getStatus()
      .then((statusRes) => {
        if (cancelled) return;
        if (forcedStep0WaitingRef.current) {
          syncDashboardStateFromStatus(statusRes);
          return;
        }
        if (!statusRes || statusRes.has_active_session === false) {
          if (restorePersistedFinalReport(persistedFinalReportRef.current)) {
            syncDashboardStateFromStatus(statusRes);
            return;
          }
          applyStatusToState(getStatusToHomeworkResponse(statusRes ?? { status: "none" }));
          syncDashboardStateFromStatus(statusRes);
          return;
        }
        applyStatusToState(getStatusToHomeworkResponse(statusRes));
        setStep(deriveHomeworkStep(statusRes));
        syncDashboardStateFromStatus(statusRes);
      })
      .catch((e) => {
        if (cancelled) return;
        if (isNoWarmupError(e)) {
          setNoWarmupConfigured(true);
          setError(null);
          applyStatusToState({ status: "none" });
        } else {
          setError("Could not load session. Click Start Your Practice to begin.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [authReady, step, syncDashboardStateFromStatus]);

  // Tab refocus: refresh the active homework state and pull any coach-controlled step unlocks.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (stepRef.current === 3) return;
      if (stepRef.current === 0) {
        homeworkApi.getStatus().then((statusRes) => {
          syncDashboardStateFromStatus(statusRes);
        }).catch(() => {});
        return;
      }
      homeworkApi.getStatus().then((res) => {
        if (!res) return;
        applyStatusToState(getStatusToHomeworkResponse(res));
        setStep((prev) => maxStep(prev, deriveHomeworkStep(res)));
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [syncDashboardStateFromStatus]);

  useEffect(() => {
    if (step !== 3 || !sessionId || sessionId === "mock-session") return;
    const nextState: PersistedFinalReportState = {
      sessionId,
      reportData,
      performanceScoreEnd,
      reportText,
      localTranscript,
      coachMessageAfterHomework,
      tutorFeedbackDeadlineMs,
    };
    persistFinalReportState(nextState);
    persistedFinalReportRef.current = nextState;
  }, [
    coachMessageAfterHomework,
    localTranscript,
    performanceScoreEnd,
    reportData,
    reportText,
    sessionId,
    step,
    tutorFeedbackDeadlineMs,
  ]);

  useEffect(() => {
    if (step !== 3 || !sessionId || sessionId === "mock-session") {
      if (step !== 3) {
        prevStepForReportNonceRef.current = step;
        prevSessionIdForReportNonceRef.current = null;
      }
      return;
    }
    const enteredStep3 = prevStepForReportNonceRef.current !== 3;
    const sessionChanged = prevSessionIdForReportNonceRef.current !== sessionId;
    prevStepForReportNonceRef.current = step;
    prevSessionIdForReportNonceRef.current = sessionId;
    if (enteredStep3 || sessionChanged) {
      setReportMountNonce((n) => n + 1);
    }
  }, [step, sessionId]);

  // Fetch report when on step 3 with a real session
  useEffect(() => {
    if (step !== 3 || !sessionId || sessionId === "mock-session") return;
    setReportLoading(true);
    setReportError(null);
    setReportNotReady(false);
    setAudioPlaybackError(false);
    homeworkApi
      .getReport(sessionId)
      .then((data) => {
        setReportData(data);
        setSniperProfile((prev) => getSniperProfileFromReport(data, prev) ?? prev);
        setReportError(null);
        setReportNotReady(false);
        reportNotReadyBackoffAttemptRef.current = 0;
        setPendingRetrySelfRating(null);
        hasSetPendingRetryFrom409Ref.current = false;
        const deadlineIso = (data as { tutor_feedback_deadline?: string | null }).tutor_feedback_deadline;
        if (deadlineIso && typeof deadlineIso === "string") {
          const ms = new Date(deadlineIso).getTime();
          if (Number.isFinite(ms) && ms > Date.now()) setTutorFeedbackDeadlineMs(ms);
        }
      })
      .catch((e) => {
        if (isSessionGoneError(e)) {
          toast.info("Your session is gone. You can start a new lesson.");
          startOverFromScratch();
          return;
        }
        if (isReportNotReadyError(e)) {
          setReportNotReady(true);
          setReportError(null);
          setReportData(null);
          const payload = lastSelfRatingPayloadRef.current;
          if (payload && payload.sessionId === sessionId && !hasSetPendingRetryFrom409Ref.current) {
            hasSetPendingRetryFrom409Ref.current = true;
            setPendingRetrySelfRating(payload);
          }
          return;
        }
        const msg = e instanceof Error ? e.message : "Failed to load report";
        setReportError(msg);
        setReportData(null);
      })
      .finally(() => setReportLoading(false));
  }, [reportMountNonce, reportRetryCount, sessionId, step]);

  // Load Lottie animation for report loading / generating states
  useEffect(() => {
    if (step !== 3 || loadingLottieData != null) return;
    fetch("/animations/loading.json")
      .then((r) => r.json())
      .then(setLoadingLottieData)
      .catch(() => {});
  }, [step, loadingLottieData]);

  // When report is still being generated, poll automatically.
  useEffect(() => {
    if (!reportNotReady || !sessionId || sessionId === "mock-session") {
      reportNotReadyBackoffAttemptRef.current = 0;
      return;
    }
    const nextAttempt = reportNotReadyBackoffAttemptRef.current + 1;
    const delayMs = Math.min(nextAttempt, 5) * 1000;
    const id = setTimeout(async () => {
      reportNotReadyBackoffAttemptRef.current = nextAttempt;
      setReportRetryCount((c) => c + 1);
      try {
        const statusRes = await homeworkApi.getStatus();
        const raw = statusRes as HomeworkSessionStatus & {
          session?: { recording_1_processing_status?: string };
          recording_1_processing_status?: string;
        };
        const processingFailed =
          raw?.recording_1_processing_status === "failed" ||
          (typeof raw?.session === "object" && raw.session?.recording_1_processing_status === "failed");
        if (processingFailed) setRecordingProcessingFailed(true);
      } catch {
        // ignore transient status errors while polling
      }
    }, delayMs);
    return () => clearTimeout(id);
  }, [reportNotReady, sessionId, reportRetryCount]);

  useEffect(() => {
    if (step !== 2 || !sessionId || sessionId === "mock-session") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const statusRes = await homeworkApi.getStatus();
        if (cancelled) return;
        const raw = statusRes as HomeworkSessionStatus & {
          session?: { recording_1_processing_status?: string };
          recording_1_processing_status?: string;
        };
        const processingFailed =
          raw?.recording_1_processing_status === "failed" ||
          (typeof raw?.session === "object" && raw.session?.recording_1_processing_status === "failed");
        if (processingFailed) setRecordingProcessingFailed(true);
      } catch {
        // ignore transient status errors on step 2
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, sessionId]);

  // When self-rating isn't accepted yet: poll GET session/status, then auto-submit self-rating.
  useEffect(() => {
    if ((step !== 2 && step !== 3) || !pendingRetrySelfRating) return;
    const { sessionId: sid } = pendingRetrySelfRating;
    const intervalMs = 5000;
    const maxWaitMs = 120000;
    const startedAt = Date.now();
    const poll = async () => {
      try {
        const statusRes = await homeworkApi.getStatus();
        const raw = statusRes as HomeworkSessionStatus & { recording_1_processing_status?: string };
        const processingStatus = raw?.recording_1_processing_status;
        const status = raw?.status ?? (raw as { session?: { status?: string } }).session?.status;
        if (processingStatus === "failed") {
          setRecordingProcessingFailed(true);
          setPendingRetrySelfRating(null);
          return;
        }
        const jobDone =
          (typeof processingStatus === "string" && processingStatus !== "pending") ||
          status === "completed" ||
          Date.now() - startedAt >= maxWaitMs;
        if (!jobDone) return;
        const payload = pendingRetrySelfRating;
        setPendingRetrySelfRating(null);
        if (payload && "rating" in payload) {
          await homeworkApi.submitSelfRating(sid, payload.rating);
        } else {
          await homeworkApi.submitSelfRatingSkipped(sid);
        }
        setStudentSpeechRatingSubmitted(true);
        setStep(3);
        setReportRetryCount((c) => c + 1);
      } catch {
        // keep polling
      }
    };
    const id = setInterval(poll, intervalMs);
    poll();
    return () => clearInterval(id);
  }, [step, pendingRetrySelfRating]);

  // Fetch sniper profile when on recording step
  useEffect(() => {
    if (step !== 1) return;
    const timeoutMs = 8000;
    const delayMs = 300;
    const tid = setTimeout(() => {
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), timeoutMs);
      refreshSniperProfile(ac.signal)
        .catch(() => {})
        .finally(() => clearTimeout(timeoutId));
    }, delayMs);
    return () => clearTimeout(tid);
  }, [refreshSniperProfile, step]);

  const RECORDING_1_DURATION_MIN = 30;

  const persistFinalSessionSummary = useCallback(
    async (params: {
      sessionId: string;
      durationSeconds: number;
      recordingId?: string | null;
      studentRating1To10?: number | null;
    }) => {
      if (completionPostedSessionsRef.current.has(params.sessionId)) {
        return;
      }
      const snapshot = sniperSnapshotRef.current;
      if (!snapshot) return;

      const asFiniteNumber = (v: unknown, fallback = 0): number =>
        typeof v === "number" && Number.isFinite(v) ? v : fallback;

      const payload = {
        session_id: params.sessionId,
        recording_id: params.recordingId ?? null,
        stage_score: asFiniteNumber(snapshot.performanceScore),
        wpm: asFiniteNumber(snapshot.wpm),
        avg_pause_ms: asFiniteNumber(snapshot.avgPauseMs),
        dynamic_range_db: asFiniteNumber(snapshot.dynamicRangeDb),
        emphasis_per_min: 0,
        energy_ratio: asFiniteNumber(snapshot.energyRatio),
        measured_pitch_center_st: asFiniteNumber(snapshot.pitchCenterSt),
        pitch_frame_count: asFiniteNumber(snapshot.pitchFrameCount),
        voiced_duration_sec: asFiniteNumber(snapshot.voicedDurationSec),
        duration_seconds: asFiniteNumber(params.durationSeconds),
        frontend_level: asFiniteNumber(snapshot.realtimeLevel),
        frontend_step: asFiniteNumber(snapshot.realtimeStep),
        completed: true as const,
        valid_for_progression: true as const,
        // Keep nested shape for current API route compatibility.
        session_means: {
          paceWpm: asFiniteNumber(snapshot.wpm),
          avgPauseMs: asFiniteNumber(snapshot.avgPauseMs),
          dynamicRangeDb: asFiniteNumber(snapshot.dynamicRangeDb),
          emphasisPerMin: 0,
          energyRatio: asFiniteNumber(snapshot.energyRatio),
          voicedDurationSec: asFiniteNumber(snapshot.voicedDurationSec),
          pitchCenterSt: asFiniteNumber(snapshot.pitchCenterSt),
          pitchFrameCount: asFiniteNumber(snapshot.pitchFrameCount),
        },
        // Alias keys accepted by backend.
        avgPauseMs: asFiniteNumber(snapshot.avgPauseMs),
        dynamicRangeDb: asFiniteNumber(snapshot.dynamicRangeDb),
        energyRatio: asFiniteNumber(snapshot.energyRatio),
        pitchCenterSt: asFiniteNumber(snapshot.pitchCenterSt),
      };
      if (
        typeof params.studentRating1To10 === "number" &&
        params.studentRating1To10 >= 1 &&
        params.studentRating1To10 <= 10
      ) {
        (payload as { student_rating_1_10?: number }).student_rating_1_10 = params.studentRating1To10;
      }

      const endpoint = "/api/user/sniper-profile";
      const payloadKeys = Object.keys(payload);
      const stageScorePresent = typeof payload.stage_score === "number" && Number.isFinite(payload.stage_score);

      const postCompletion = async (attempt: 1 | 2) => {
        console.info("[HomeworkFlow] completion POST", {
          session_id: params.sessionId,
          endpoint,
          stage_score_present: stageScorePresent,
          payload_keys: payloadKeys,
          attempt,
        });
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const rawBody = await response.text();
        let parsedBody: unknown = null;
        if (rawBody.trim()) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            parsedBody = rawBody;
          }
        }
        console.info("[HomeworkFlow] completion POST result", {
          session_id: params.sessionId,
          endpoint,
          stage_score_present: stageScorePresent,
          status: response.status,
          attempt,
        });
        return { ok: response.ok, status: response.status, parsedBody };
      };

      try {
        let result = await postCompletion(1);
        if (!result.ok) {
          console.error("[HomeworkFlow] completion POST failed", {
            session_id: params.sessionId,
            endpoint,
            status: result.status,
            response_body: result.parsedBody,
          });
          toast.warning("We couldn't save session metrics right away. Retrying once...");
          result = await postCompletion(2);
          if (!result.ok) {
            console.error("[HomeworkFlow] completion POST retry failed", {
              session_id: params.sessionId,
              endpoint,
              status: result.status,
              response_body: result.parsedBody,
            });
            toast.warning("Session metrics may be delayed. Your lesson will continue.");
            return;
          }
        }
        completionPostedSessionsRef.current.add(params.sessionId);
        if (
          result.parsedBody &&
          typeof result.parsedBody === "object" &&
          "user_id" in (result.parsedBody as Record<string, unknown>)
        ) {
          setSniperProfile(result.parsedBody as UserSniperProfile);
        }
      } catch (e) {
        console.error("[HomeworkFlow] completion POST error", {
          session_id: params.sessionId,
          endpoint,
          error: e instanceof Error ? e.message : e,
        });
        toast.warning("Session metrics couldn't be saved yet. Your lesson will continue.");
      }
    },
    []
  );

  const handleRecordingComplete = async (
    blob: Blob,
    durationSeconds: number,
    config: {
      recordingNumber: 1 | 2;
      minDurationSeconds: number;
      stepOnSuccess: Step;
      stepOnError: Step;
      inProgressRef: React.MutableRefObject<boolean>;
      upload: (blob: Blob, dur: number, signal: AbortSignal) => Promise<unknown>;
      onSuccess?: (result: unknown) => Promise<void> | void;
    }
  ) => {
    const { recordingNumber, minDurationSeconds, stepOnSuccess, stepOnError, inProgressRef, upload, onSuccess } = config;

    if (durationSeconds < minDurationSeconds) {
      const label = recordingNumber === 1 ? "First" : "Final";
      const msg = `${label} recording must be at least ${minDurationSeconds} seconds. You recorded ${durationSeconds}s.`;
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!sessionId) return;
    if (inProgressRef.current) return;
    inProgressRef.current = true;
    if (typeof window !== "undefined") {
      console.warn(`[HomeworkFlow] handleRecordingComplete rec${recordingNumber}`, { step, sessionId: sessionId?.slice(0, 8) + "…", durationSeconds });
    }
    if (recordingNumber === 1 && sessionId === "mock-session") {
      inProgressRef.current = false;
      setError("Recording captured (preview only). Implement POST /v2/homework/start and POST /v2/homework/session/:id/recording-1 on your backend to save and continue.");
      return;
    }
    if (uploadingRecording === recordingNumber) {
      inProgressRef.current = false;
      return;
    }
    setUploadingRecording(recordingNumber);
    setError(null);
    abortRef.current = new AbortController();
    setStep(stepOnSuccess);

    try {
      const res = await upload(blob, durationSeconds, abortRef.current.signal);
      await onSuccess?.(res);
    } catch (e) {
      console.error(`[HomeworkFlow] handleRecordingComplete rec${recordingNumber} error`, e);
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      const msg = isInvalidSessionStateError(e)
        ? "Session state conflict. Please refresh the page or switch tab and back."
        : (e instanceof Error ? e.message : "Upload failed. Please try again.");
      setStep(stepOnError);
      setError(msg);
      toast.error(msg, { duration: 8000 });
    } finally {
      setUploadingRecording(null);
      abortRef.current = null;
      inProgressRef.current = false;
    }
  };

  const onRecording1Complete = (blob: Blob, durationSeconds: number) =>
    handleRecordingComplete(blob, durationSeconds, {
      recordingNumber: 1,
      minDurationSeconds: RECORDING_1_DURATION_MIN,
      stepOnSuccess: 2,
      stepOnError: 1,
      inProgressRef: uploadRecording1InProgressRef,
      upload: (b, dur, signal) =>
        homeworkApi.uploadRecording1(
          sessionId!,
          b,
          dur,
          signal,
          localTranscriptRef.current || undefined,
          sniperSnapshotRef.current?.centerHoldRatio,
          sniperSnapshotRef.current?.centerHoldMs,
          sniperSnapshotRef.current?.totalActiveMs
        ),
      onSuccess: async (res) => {
        const backendStatus = (res as { status?: string }).status;
        const status: PublicHomeworkStatus =
          backendStatus && toPublicStatus(backendStatus) !== "none"
            ? toPublicStatus(backendStatus)
            : "recording_1_required";
        applyStatusToState({ status, session_id: sessionId });
        await persistFinalSessionSummary({
          sessionId: sessionId!,
          durationSeconds,
          recordingId: "recording_id" in (res as object) ? ((res as { recording_id?: string | null }).recording_id ?? null) : null,
        });
      },
    });

  // Step-2 self-rating handlers (inline to keep access to state setters)
  const handleRatingSelect = async (n: number) => {
    if (!sessionId || sessionId === "mock-session") return;
    setSavingStudentRating(true);
    try {
      lastSelfRatingPayloadRef.current = { sessionId, rating: n };
      const res: SelfRatingResponse = await homeworkApi.submitSelfRating(sessionId, n);
      setStudentSpeechRatingSubmitted(true);
      setStep(3);
      if (res.session_completed === false) {
        setPendingRetrySelfRating({ sessionId, rating: n });
      }
    } catch (e) {
      if (isRecordingProcessingFailedError(e)) {
        setRecordingProcessingFailed(true);
        toast.error("We couldn't process this recording. Please record again.");
        return;
      }
      // Self-rating is optional — any backend error that isn't a hard auth/not-found failure
      // should just queue a retry and move forward so the user is never blocked here.
      const err = e as { status?: number; code?: string };
      const isHardFailure = err.status === 401 || err.status === 403 || err.status === 404;
      if (!isHardFailure) {
        // "Not ready yet" or any transient/state error → retry in background once recording is done
        setPendingRetrySelfRating({ sessionId, rating: n });
        setStudentSpeechRatingSubmitted(true);
        setStep(3);
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save rating. Try again.");
      }
    } finally {
      setSavingStudentRating(false);
    }
  };

  const handleRatingSkip = async () => {
    if (!sessionId || sessionId === "mock-session") {
      setStudentSpeechRatingSubmitted(true);
      setStep(3);
      return;
    }
    setSavingStudentRating(true);
    try {
      lastSelfRatingPayloadRef.current = { sessionId, skipped: true };
      const res: SelfRatingResponse = await homeworkApi.submitSelfRatingSkipped(sessionId);
      setStudentSpeechRatingSubmitted(true);
      setStep(3);
      if (res.session_completed === false) {
        setPendingRetrySelfRating({ sessionId, skipped: true });
      }
    } catch (e) {
      if (isRecordingProcessingFailedError(e)) {
        setRecordingProcessingFailed(true);
        toast.error("We couldn't process this recording. Please record again.");
        return;
      }
      const err = e as { status?: number; code?: string };
      const isHardFailure = err.status === 401 || err.status === 403 || err.status === 404;
      if (!isHardFailure) {
        setPendingRetrySelfRating({ sessionId, skipped: true });
        setStudentSpeechRatingSubmitted(true);
        setStep(3);
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save. Try again.");
      }
    } finally {
      setSavingStudentRating(false);
    }
  };

  // ─── Auth / warmup guards ────────────────────────────────────────────────────

  if (!authReady) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground text-sm">Loading…</p>
      </Card>
    );
  }

  if (noWarmupConfigured) {
    return (
      <Card className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          No warm-up tasks are configured for your account. Please contact your coach to get started.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/dashboard">Contact your coach</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back</Link>
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await createClient().auth.signOut();
              router.push("/login");
            }}
          >
            Log out
          </Button>
        </div>
      </Card>
    );
  }

  // ─── Step router ─────────────────────────────────────────────────────────────

  if (step === 0) return (
    <Step0Screen
      reviewPending={reviewPending}
      waitingMessage={mainScreenMessage ?? REVIEW_PENDING_DEFAULT_MESSAGE}
      sniperProfile={sniperProfile}
      step0TutorVideoUrl={step0TutorVideoUrl}
      step0TutorVideoDescription={step0TutorVideoDescription}
      assignedExercises={assignedExercises}
      loading={loading}
      error={error}
      onStart={handleStart}
      videoModalUrl={videoModalUrl}
      onOpenVideoModal={setVideoModalUrl}
      onCloseVideoModal={() => setVideoModalUrl(null)}
      showInsufficientCreditsModal={showInsufficientCreditsModal}
      onCloseInsufficientCreditsModal={() => setShowInsufficientCreditsModal(false)}
      showReportsList={showReportsList}
      onToggleReportsList={() => {
        if (showReportsList) {
          setShowReportsList(false);
        } else {
          setVisibleReportsCount(STEP0_REPORTS_PAGE_SIZE);
          setShowReportsList(true);
          fetchStep0Reports();
        }
      }}
      step0Sessions={step0Sessions}
      step0SessionsLoading={step0SessionsLoading}
      visibleReportsCount={visibleReportsCount}
      onLoadMoreReports={() =>
        setVisibleReportsCount((prev) => Math.min(prev + STEP0_REPORTS_PAGE_SIZE, step0Sessions.length))
      }
      step0ReportPreviews={step0ReportPreviews}
      step0ReportPreviewLoading={step0ReportPreviewLoading}
      reportsModalOpen={reportsModalOpen}
      reportModalSessionId={reportModalSessionId}
      onOpenReportModal={(id) => {
        setReportModalSessionId(id);
        setReportsModalOpen(true);
      }}
      onCloseReportModal={() => {
        setReportsModalOpen(false);
        setReportModalSessionId(null);
      }}
    />
  );

  if (step === 1) return (
    <Step1RecordingScreen
      task={task}
      sessionId={sessionId}
      uploading={uploadingRecording !== null ? String(uploadingRecording) : null}
      statusUnknown={statusUnknown}
      sniperProfile={sniperProfile}
      loading={loading}
      error={error}
      coachMessage={coachMessageAfterHomework}
      onRecordingComplete={onRecording1Complete}
      onSniperSnapshot={(snapshot) => {
        setSniperSnapshot(snapshot);
        sniperSnapshotRef.current = snapshot;
      }}
      onAbandon={handleAbandon}
      onStartOver={startOverFromScratch}
      resetting={resetting}
    />
  );

  if (step === 2) return (
    <Step2SelfRatingScreen
      recordingProcessingFailed={recordingProcessingFailed}
      savingRating={savingStudentRating}
      ratingSubmitted={studentSpeechRatingSubmitted}
      coachMessage={coachMessageAfterHomework}
      onRatingSelect={handleRatingSelect}
      onSkip={recordingProcessingFailed ? handleStartOver : handleRatingSkip}
      onAbandon={handleAbandon}
      resetting={resetting}
    />
  );

  if (step === 3) return (
    <Step3ReportScreen
      sessionId={sessionId}
      reportData={reportData}
      reportLoading={reportLoading}
      reportError={reportError}
      reportNotReady={reportNotReady}
      recordingProcessingFailed={recordingProcessingFailed}
      performanceScoreEnd={performanceScoreEnd}
      sniperSnapshot={sniperSnapshot}
      localTranscript={localTranscript}
      leavingReport={leavingReport}
      resetting={resetting}
      loadingLottieData={loadingLottieData}
      audioPlaybackError={audioPlaybackError}
      coachMessage={coachMessageAfterHomework}
      tutorFeedbackDeadlineMs={tutorFeedbackDeadlineMs}
      onAudioPlaybackError={() => setAudioPlaybackError(true)}
      onRetryReport={() => {
        setReportError(null);
        setReportRetryCount((c) => c + 1);
      }}
      onLeaveReport={handleLeaveReport}
      onDoHomeworkAgain={handleAbandon}
    />
  );

  return null;
}
