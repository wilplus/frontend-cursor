"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthReady } from "@/hooks/useAuthReady";
import { homeworkApi, type HomeworkApiError } from "@/lib/api/homework-client";
import type {
  HomeworkQuestion,
  HomeworkSessionStatus,
  HomeworkReportResponse,
  TaskBlockV2,
  HomeworkResponse,
} from "@/lib/api/types-homework";
import {
  mapStatusToStep,
  getStatusToHomeworkResponse,
  type Step as StepType,
  type PublicHomeworkStatus,
} from "@/lib/api/types-homework";
import AnswerMetricQuestionsScreen from "@/components/homework/AnswerMetricQuestionsScreen";
import PostQuestionsStepScreen from "@/components/homework/PostQuestionsStepScreen";
import ProgressOverSessionsChart from "@/components/homework/ProgressOverSessionsChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressStepBullets } from "@/components/ui/progress-step-bullets";
import AudioRecorder from "@/components/recording/AudioRecorder";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { debugIngest } from "@/lib/debugIngest";
import { useRecordingContext } from "@/components/dashboard/DashboardShell";

const TOTAL_STEPS = 5;

/** Default warm-up question when the backend assigns none. */
const DEFAULT_WARMUP_QUESTION = "How was your day so far?";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resolveWarmUpText(text: string | null | undefined): string {
  return (text ?? "").trim() || DEFAULT_WARMUP_QUESTION;
}

type Step = StepType;

/** Coerce API value to string; backend may send { id, text } instead of a plain string. */
function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "text" in v) {
    const t = (v as { text: unknown }).text;
    return typeof t === "string" ? t : String(t ?? "");
  }
  return String(v);
}

/** Stable string id for keys and state; backend may send id as object. */
function toId(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "id" in v) {
    const id = (v as { id: unknown }).id;
    return typeof id === "string" ? id : String(id ?? "");
  }
  return String(v);
}

// One auto-start per page load (avoids double request in React Strict Mode). Reset when user finishes and goes to dashboard so next visit starts fresh.
let autoStartAttempted = false;
function resetAutoStartAttempted() {
  autoStartAttempted = false;
}

function isNoWarmupError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "NO_WARMUP_CONFIGURED";
}

function isInvalidSessionStateError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "INVALID_SESSION_STATE";
}

/** Stable wrapper so children (e.g. PostQuestionsStepScreen) do not remount on parent re-render. Progress bar only on steps 1–4 (hidden on step 0 and step 5). When syncingBehind, show "Syncing…" below the progress bar. */
function StepFlowWrapper({
  step,
  syncingBehind,
  children,
}: {
  step: Step;
  syncingBehind?: boolean;
  children: React.ReactNode;
}) {
  const showProgressBar = step >= 1 && step <= 4;
  const flowStepIndex = step >= 1 ? step - 1 : 0;
  return (
      <div className="w-full space-y-4 animate-fade-in flex flex-col items-center">
      {showProgressBar && (
        <ProgressStepBullets
          total={TOTAL_STEPS}
          currentIndex={flowStepIndex}
          aria-label={`Step ${step} of ${TOTAL_STEPS}`}
          variant="minimal"
        />
      )}
      {syncingBehind && (
        <p className="text-center text-sm text-muted-foreground">Syncing…</p>
      )}
      <div className="w-full flex flex-col items-center">{children}</div>
    </div>
  );
}

export default function HomeworkFlowCard() {
  const router = useRouter();
  const authReady = useAuthReady();
  const { setRecordingActive, setShowNavbar } = useRecordingContext();
  const [step, setStep] = useState<Step>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [warmUpText, setWarmUpText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [finalTaskText, setFinalTaskText] = useState("");
  const [taskBlock, setTaskBlock] = useState<TaskBlockV2 | null>(null);
  const [questions, setQuestions] = useState<HomeworkQuestion[]>([]);
  const [postAnswers, setPostAnswers] = useState<Record<string, string>>({});
  const [reportText, setReportText] = useState("");
  const [performanceScoreEnd, setPerformanceScoreEnd] = useState<number | null>(null);
  /** Fetched report for step 5 (player + graph + text). Fresh on load so audio_url is valid. */
  const [reportData, setReportData] = useState<HomeworkReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** When true, metric step Continue is disabled because recording-1 analysis failed (submitting again won't help). */
  const [metricStepBlockedByRecordingFailure, setMetricStepBlockedByRecordingFailure] = useState(false);
  /** On step 2 when taskBlock was null, we fetch it; this becomes true when that fetch settles (success or fail). Used to show error if questions still missing after fetch. */
  const [taskBlockFetchSettled, setTaskBlockFetchSettled] = useState(false);
  /** On step 4 when questions were [], we fetch GET questions; this becomes true when that fetch settles so we only show the form once questions are loaded (or show error). */
  const [questionsStep4Settled, setQuestionsStep4Settled] = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState<1 | 2 | null>(null);
  const [noWarmupConfigured, setNoWarmupConfigured] = useState(false);
  const [statusUnknown, setStatusUnknown] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncingBehind, setSyncingBehind] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const metricSubmitInProgress = useRef(false);
  const postAnswersSubmitInProgress = useRef(false);
  const uploadRecording1InProgressRef = useRef(false);
  const uploadRecording2InProgressRef = useRef(false);
  const postAnswersAutoSubmitDoneRef = useRef(false);
  /** Session IDs we have already triggered notify-lesson-complete for (admin email). */
  const notifiedLessonCompleteRef = useRef<Set<string>>(new Set());
  /** When set, user just finished a lesson (step 5 → 0); show tutor countdown notice on step 0. Cleared when they click Start homework. */
  const [tutorFeedbackDeadlineMs, setTutorFeedbackDeadlineMs] = useState<number | null>(null);
  /** When no active session: message from backend (e.g. tutor warning). Show as info banner on step 0. */
  const [tutorFeedbackMessage, setTutorFeedbackMessage] = useState<string | null>(null);
  /** Ticker so countdown re-renders every second when tutor deadline is shown. */
  const [countdownTick, setCountdownTick] = useState(0);
  /** True when we already started fetching task-block (e.g. in mount or step-2 effect) so we do not double-fetch. */
  const taskBlockFetchStartedRef = useRef(false);

  /** On step 0, fetch status so we get backend tutor_feedback_deadline and tutor_feedback_message (when no active session). Wait for auth to avoid 500 on first load. */
  useEffect(() => {
    if (!authReady || step !== 0) return;
    homeworkApi.getStatus().then((statusRes) => {
      const deadlineIso = statusRes?.tutor_feedback_deadline;
      if (deadlineIso && typeof deadlineIso === "string") {
        const ms = new Date(deadlineIso).getTime();
        setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
      } else {
        setTutorFeedbackDeadlineMs(null);
      }
      const msg = statusRes?.tutor_feedback_message;
      setTutorFeedbackMessage(typeof msg === "string" && msg.trim() ? msg.trim() : null);
    }).catch(() => {
      setTutorFeedbackDeadlineMs(null);
      setTutorFeedbackMessage(null);
    });
  }, [authReady, step]);

  /** Countdown ticker: update every second when showing tutor deadline. When time runs out, clear the notice. */
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

  /** While on step 0 with timer showing, poll session/status so we hide the timer when backend clears tutor_feedback_deadline (e.g. tutor sent feedback). Also refresh tutor_feedback_message. */
  const TUTOR_DEADLINE_POLL_INTERVAL_MS = 45_000;
  useEffect(() => {
    if (!authReady || step !== 0 || tutorFeedbackDeadlineMs == null) return;
    const id = setInterval(() => {
      homeworkApi.getStatus().then((statusRes) => {
        const deadlineIso = statusRes?.tutor_feedback_deadline;
        if (deadlineIso && typeof deadlineIso === "string") {
          const ms = new Date(deadlineIso).getTime();
          if (Number.isFinite(ms) && ms > Date.now()) setTutorFeedbackDeadlineMs(ms);
          else setTutorFeedbackDeadlineMs(null);
        } else {
          setTutorFeedbackDeadlineMs(null);
        }
        const msg = statusRes?.tutor_feedback_message;
        setTutorFeedbackMessage(typeof msg === "string" && msg.trim() ? msg.trim() : null);
      }).catch(() => {});
    }, TUTOR_DEADLINE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authReady, step, tutorFeedbackDeadlineMs]);

  /** Show navbar on step 0 (start) and step 5 (report); hide from step 1–4. */
  useEffect(() => {
    setShowNavbar(step === 0 || step === 5);
  }, [step, setShowNavbar]);

  /** Clear recording context when not on a recording step (body scroll lock released when leaving step 1/3). */
  useEffect(() => {
    if (step !== 1 && step !== 3) setRecordingActive(false);
  }, [step, setRecordingActive]);

  /** Single state projection from backend response. No floors, caps, or step overrides. Never downgrade step. */
  const applyStatusToState = (res: HomeworkResponse) => {
    const status: PublicHomeworkStatus = res.status ?? "none";
    const step = mapStatusToStep(status);
    setStep(step);
    setStatusUnknown(false);
    setError(null);

    if (res.session_id != null) setSessionId(res.session_id);
    if (status === "none") {
      setSessionId(null);
      setWarmUpText("");
      setTaskText("");
      setTaskBlock(null);
      setFinalTaskText("");
      setQuestions([]);
      setReportText("");
      setPerformanceScoreEnd(null);
      setReportData(null);
      setTutorFeedbackDeadlineMs(null);
      setTutorFeedbackMessage(null);
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkReport");
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      return;
    }

    if ("warm_up_task" in res && res.warm_up_task != null) {
      setWarmUpText(resolveWarmUpText(res.warm_up_task.text ?? ""));
    } else if ("warm_up_task_text" in res && res.warm_up_task_text != null) {
      setWarmUpText(resolveWarmUpText(res.warm_up_task_text));
    }
    if ("task_text" in res && res.task_text !== undefined) setTaskText(res.task_text ?? "");
    if ("task_block" in res && res.task_block != null) setTaskBlock(res.task_block);
    if ("final_task" in res && res.final_task != null) setFinalTaskText(res.final_task.trim());
    else if ("final_task_text" in res && res.final_task_text != null) setFinalTaskText(res.final_task_text.trim());
    if ("performance_score_2" in res && res.performance_score_2 !== undefined) setPerformanceScoreEnd(res.performance_score_2);
    if ("report_text" in res && res.report_text !== undefined) setReportText(res.report_text ?? "");
    if ("performance_score_end" in res && res.performance_score_end !== undefined) setPerformanceScoreEnd(res.performance_score_end);
    if ("questions" in res && Array.isArray(res.questions)) {
      const qList = res.questions.map((q) => ({
        ...q,
        id: toId(q.id) || crypto.randomUUID(),
        text: toText(q.text),
      }));
      setQuestions(qList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
    }
    if ("tutor_feedback_deadline" in res) {
      const deadlineIso = res.tutor_feedback_deadline;
      if (deadlineIso && typeof deadlineIso === "string") {
        const ms = new Date(deadlineIso).getTime();
        setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
      } else {
        setTutorFeedbackDeadlineMs(null);
      }
    }
    if ("tutor_feedback_message" in res) {
      const msg = res.tutor_feedback_message;
      setTutorFeedbackMessage(typeof msg === "string" && msg.trim() ? msg.trim() : null);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setStatusUnknown(false);
    try {
      const startRes = await homeworkApi.start();
      const warmUpTextFromStart =
        (startRes.warm_up_task && "text" in startRes.warm_up_task ? startRes.warm_up_task.text : null) ??
        (startRes as { warm_up_task?: { text?: string } }).warm_up_task?.text ??
        (startRes as { warm_up_task_text?: string }).warm_up_task_text ??
        "";
      applyStatusToState({
        status: "recording_1_required",
        session_id: startRes.session_id,
        warm_up_task: (startRes as { warm_up_task?: { id: string; text: string } }).warm_up_task ?? null,
        warm_up_task_text: warmUpTextFromStart || null,
      });
    } catch (e) {
      if (isNoWarmupError(e)) {
        setNoWarmupConfigured(true);
        setError(null);
        applyStatusToState({ status: "none" });
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to start homework";
      const isBackendUnavailable = msg.includes("not available yet") || msg.includes("404");
      if (isBackendUnavailable) {
        applyStatusToState({ status: "recording_1_required", session_id: "mock-session" });
        setWarmUpText("");
        setError(null);
        setStatusUnknown(false);
      } else {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  /** Reset the homework session as if the user had just logged in: clear backend session, clear all state and stored report, show step 0 (Start homework card). User stays logged in. Idempotent: safe to call multiple times; button disabled while resetting. */
  const handleStartOver = async () => {
    if (resetting) return;
    setResetting(true);
    try {
      // Clear all flow-restore keys (only ones used in this flow)
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkReport");
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      if (sessionId && sessionId !== "mock-session") {
        try {
          await homeworkApi.abandonSession(sessionId);
        } catch (e) {
          // Clear local state anyway; avoid stale server session when user starts again
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[HomeworkFlow] abandonSession failed on reset", e);
          }
        }
      }
      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      postAnswersAutoSubmitDoneRef.current = false;
      metricSubmitInProgress.current = false;
      postAnswersSubmitInProgress.current = false;
      uploadRecording1InProgressRef.current = false;
      uploadRecording2InProgressRef.current = false;
      setSessionId(null);
      setStep(0);
      setWarmUpText("");
      setTaskText("");
      setFinalTaskText("");
      setTaskBlock(null);
      setQuestions([]);
      setPostAnswers({});
      setReportText("");
      setPerformanceScoreEnd(null);
      setReportData(null);
      setReportLoading(false);
      setReportError(null);
      setError(null);
      setNoWarmupConfigured(false);
      setStatusUnknown(false);
      setLoading(false);
      setUploadingRecording(null);
      setTutorFeedbackDeadlineMs(null);
      setTutorFeedbackMessage(null);
    } finally {
      setResetting(false);
    }
  };

  /** Abandon current session via API (backend deletes/invalidates it), then full local reset to step 0. No refetch — guarantees a clean restart. */
  const handleAbandon = async () => {
    if (!sessionId || sessionId === "mock-session") {
      handleStartOver();
      return;
    }
    // Abort any in-flight recording upload so we don't leave it running after abandoning
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    uploadRecording1InProgressRef.current = false;
    uploadRecording2InProgressRef.current = false;
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
      if (!isSessionGoneError(e)) {
        setError(e instanceof Error ? e.message : "Failed to abandon session");
        toast.error("Could not abandon session");
        setLoading(false);
        return;
      }
      toast.success("Session was already cleared. You can start a new session.");
    }
    postAnswersAutoSubmitDoneRef.current = false;
    metricSubmitInProgress.current = false;
    postAnswersSubmitInProgress.current = false;
    uploadRecording1InProgressRef.current = false;
    uploadRecording2InProgressRef.current = false;
    applyStatusToState({ status: "none" });
    setLoading(false);
    setMetricStepBlockedByRecordingFailure(false);
  };

  /** Local-only reset when session is already gone (e.g. 404). Uses same projection as abandon. */
  const startOverFromScratch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    postAnswersAutoSubmitDoneRef.current = false;
    metricSubmitInProgress.current = false;
    postAnswersSubmitInProgress.current = false;
    uploadRecording1InProgressRef.current = false;
    uploadRecording2InProgressRef.current = false;
    applyStatusToState({ status: "none" });
    setMetricStepBlockedByRecordingFailure(false);
  };

  /** True if error indicates session is gone (404 / SESSION_NOT_FOUND or message). */
  const isSessionGoneError = (e: unknown) => {
    const err = e as { code?: string; message?: string; status?: number };
    const msg = (err.message ?? "").toLowerCase();
    return (
      err.code === "SESSION_NOT_FOUND" ||
      err.status === 404 ||
      msg.includes("session not found") ||
      msg.includes("no active session")
    );
  };

  // Cold load: GET status only (mount). Never downgrade step; missing payload handled by Option B (e.g. fetch task-block for step 2).
  useEffect(() => {
    if (!authReady || step !== 0 || autoStartAttempted) return;
    autoStartAttempted = true;
    setLoading(true);
    let cancelled = false;
    homeworkApi
      .getStatus()
      .then((statusRes) => {
        if (cancelled) return;
        if (!statusRes || statusRes.has_active_session === false) {
          applyStatusToState({ status: "none" });
          if (statusRes?.tutor_feedback_deadline && typeof statusRes.tutor_feedback_deadline === "string") {
            const ms = new Date(statusRes.tutor_feedback_deadline).getTime();
            if (Number.isFinite(ms) && ms > Date.now()) setTutorFeedbackDeadlineMs(ms);
          }
          if (typeof statusRes?.tutor_feedback_message === "string" && statusRes.tutor_feedback_message.trim()) {
            setTutorFeedbackMessage(statusRes.tutor_feedback_message.trim());
          }
          return;
        }
        const resp = getStatusToHomeworkResponse(statusRes);
        applyStatusToState(resp);
        const sessionIdFromRes = resp.session_id ?? null;
        if (mapStatusToStep(resp.status) === 2 && sessionIdFromRes && !resp.task_block) {
          taskBlockFetchStartedRef.current = true;
          homeworkApi
            .getTaskBlock(sessionIdFromRes)
            .then((data) => {
              if (!cancelled && data.task_block) setTaskBlock(data.task_block);
            })
            .catch(() => {
              if (!cancelled) setError("Could not load questions. Try continuing or refresh.");
            })
            .finally(() => {
              if (!cancelled) setTaskBlockFetchSettled(true);
            });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (isNoWarmupError(e)) {
          setNoWarmupConfigured(true);
          setError(null);
          applyStatusToState({ status: "none" });
        } else {
          setError("Could not load session. Click Start homework to begin.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, step]);

  // Tab refocus: GET status and apply. No downgrade.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        homeworkApi.getStatus().then((res) => {
          if (res) applyStatusToState(getStatusToHomeworkResponse(res));
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // On step 2, if task_block is missing (e.g. after refresh — Option B), fetch from GET task-block. Never downgrade step.
  useEffect(() => {
    if (step !== 2 || !sessionId || sessionId === "mock-session" || taskBlock != null) return;
    if (taskBlockFetchStartedRef.current) return;
    taskBlockFetchStartedRef.current = true;
    let cancelled = false;
    homeworkApi
      .getTaskBlock(sessionId)
      .then((data) => {
        if (!cancelled && data.task_block) {
          setTaskBlock(data.task_block);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load questions. Try continuing or refresh.");
      })
      .finally(() => {
        if (!cancelled) setTaskBlockFetchSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [step, sessionId, taskBlock]);

  useEffect(() => {
    if (step !== 2) {
      setTaskBlockFetchSettled(false);
      taskBlockFetchStartedRef.current = false;
    }
  }, [step]);

  useEffect(() => {
    if (step !== 4) setQuestionsStep4Settled(false);
  }, [step]);

  // On step 4, if questions are missing (thin status or refresh), load from GET questions. If none, finish without post-questions (auto-submit to get report).
  useEffect(() => {
    if (step !== 4 || !sessionId || sessionId === "mock-session" || questions.length > 0) return;
    if (postAnswersAutoSubmitDoneRef.current) return;
    let cancelled = false;
    homeworkApi
      .getQuestions(sessionId)
      .then(({ questions: qList }) => {
        if (cancelled) return;
        setQuestionsStep4Settled(true);
        if (qList.length > 0) {
          const normalized = qList.map((q) => ({
            ...q,
            id: toId(q.id) || crypto.randomUUID(),
            text: toText(q.text),
          }));
          setQuestions(normalized.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
        } else {
          // No reflective questions: finish without them — auto-submit to get report
          postAnswersAutoSubmitDoneRef.current = true;
          setLoading(true);
          setError(null);
          homeworkApi
            .submitPostAnswers(sessionId, [])
            .then((res) => {
              if (!cancelled) {
                applyStatusToState({
                  status: "completed",
                  session_id: sessionId,
                  report_text: res.report_text ?? "",
                  performance_score_end: res.performance_score_end ?? null,
                });
                if (typeof sessionStorage !== "undefined") {
                  sessionStorage.setItem(
                    "homeworkReport",
                    JSON.stringify({ sessionId, reportText: res.report_text ?? "", performanceScoreEnd: res.performance_score_end ?? null })
                  );
                }
              }
            })
            .catch((e) => {
              if (!cancelled) {
                const msg = e instanceof Error ? e.message : "Failed to load report";
                setError(msg);
                toast.error(msg);
                postAnswersAutoSubmitDoneRef.current = false;
              }
            })
            .finally(() => {
              if (!cancelled) setLoading(false);
            });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuestionsStep4Settled(true);
          setError("Could not load questions. Try continuing or refresh.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [step, sessionId, questions.length]);

  // Fetch report when on step 5 with a real session (single source of truth for player + scores + text)
  useEffect(() => {
    if (step !== 5 || !sessionId || sessionId === "mock-session") return;
    setReportLoading(true);
    setReportError(null);
    homeworkApi
      .getReport(sessionId)
      .then((data) => {
        setReportData(data);
        setReportError(null);
        // Notify admin (e.g. artur@willonski.com) once per session when report is ready
        if (!notifiedLessonCompleteRef.current.has(sessionId)) {
          notifiedLessonCompleteRef.current.add(sessionId);
          homeworkApi.notifyLessonComplete(sessionId).catch(() => {});
        }
      })
      .catch((e) => {
        if (isSessionGoneError(e)) {
          toast.info("Your session is gone. You can start a new lesson.");
          startOverFromScratch();
          return;
        }
        const msg = e instanceof Error ? e.message : "Failed to load report";
        setReportError(msg);
        setReportData(null);
      })
      .finally(() => setReportLoading(false));
  }, [step, sessionId]);

  const RECORDING_1_DURATION_MIN = 30;
  const RECORDING_2_DURATION_MIN = 62;
  const RECORDING_2_DURATION_MAX = 300;

  const handleRecording1Complete = async (blob: Blob, durationSeconds: number) => {
    if (durationSeconds < RECORDING_1_DURATION_MIN) {
      const msg = `First recording must be at least ${RECORDING_1_DURATION_MIN} seconds. You recorded ${durationSeconds}s.`;
      setError(msg);
      toast.error(msg);
      return;
    }
    // #region agent log
    debugIngest("http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1", { location: "HomeworkFlowCard.tsx:handleRecording1Complete:entry", message: "rec1 complete handler entered", data: { hasSessionId: !!sessionId, uploadInProgress: uploadRecording1InProgressRef.current, uploadingRecording, step, durationSeconds }, timestamp: Date.now(), hypothesisId: "H5" });
    // #endregion
    if (!sessionId) return;
    if (uploadRecording1InProgressRef.current) return;
    uploadRecording1InProgressRef.current = true;
    if (typeof window !== "undefined") {
      console.warn("[HomeworkFlow] handleRecording1Complete", { step, sessionId: sessionId?.slice(0, 8) + "…", durationSeconds });
    }
    if (sessionId === "mock-session") {
      uploadRecording1InProgressRef.current = false;
      setError(
        "Recording captured (preview only). Implement POST /v2/homework/start and POST /v2/homework/session/:id/recording-1 on your backend to save and continue."
      );
      return;
    }
    if (uploadingRecording === 1) {
      uploadRecording1InProgressRef.current = false;
      return;
    }
    setUploadingRecording(1);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const res = await homeworkApi.uploadRecording1(sessionId, blob, durationSeconds, abortRef.current.signal);
      applyStatusToState({
        status: "task_block",
        session_id: sessionId,
        task_block: (res as { task_block?: TaskBlockV2 }).task_block ?? null,
        task_text: (res as { task_text?: string }).task_text ?? undefined,
      });
    } catch (e) {
      // #region agent log
      debugIngest("http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1", { location: "HomeworkFlowCard.tsx:handleRecording1Complete catch", message: "rec1 error", data: { error: String((e as Error)?.message), code: (e as { code?: string })?.code }, timestamp: Date.now(), hypothesisId: "H4" });
      // #endregion
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      if (isInvalidSessionStateError(e)) {
        setError("Session state conflict. Please refresh the page or switch tab and back.");
        toast.error("Session state conflict. Please refresh the page or switch tab and back.");
      } else {
        setError(e instanceof Error ? e.message : "Upload failed");
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    } finally {
      setUploadingRecording(null);
      abortRef.current = null;
      uploadRecording1InProgressRef.current = false;
    }
  };

  const METRIC_ANSWERS_VALIDATION_MSG = "Please answer all three questions before continuing.";

  const handleMetricAnswersSubmit = async (answer_1: string, answer_2: string, answer_3: string) => {
    if (!sessionId) return;
    if (metricSubmitInProgress.current) return;
    const a1 = answer_1.trim();
    const a2 = answer_2.trim();
    const a3 = answer_3.trim();
    if (!a1 || !a2 || !a3) {
      setError(METRIC_ANSWERS_VALIDATION_MSG);
      toast.error(METRIC_ANSWERS_VALIDATION_MSG);
      return;
    }
    metricSubmitInProgress.current = true;
    setLoading(true);
    setError(null);
    if (typeof window !== "undefined") {
      console.warn("[HomeworkFlow] metric answers submit started", { sessionId: sessionId?.slice(0, 8) + "…" });
    }
    try {
      const metricResponse = await homeworkApi.submitMetricAnswers(sessionId, {
        metric_answer_1: a1,
        metric_answer_2: a2,
        metric_answer_3: a3,
      });
      const responseErr = metricResponse && typeof (metricResponse as { error?: string }).error === "string" ? (metricResponse as { error: string }).error : null;
      if (typeof window !== "undefined") {
        console.warn("[HomeworkFlow] metric-answers response", {
          hasFinalTask: !!metricResponse?.final_task,
          hasError: !!responseErr,
          errorMsg: responseErr ?? undefined,
        });
      }
      if (metricResponse?.recording_1_fallback && metricResponse?.message?.trim()) {
        toast.info(metricResponse.message.trim());
      }
      applyStatusToState({
        status: "final_task_ready",
        session_id: sessionId,
        final_task: typeof metricResponse?.final_task === "string" ? metricResponse.final_task : undefined,
      });
      toast.success("Answers saved. Continue to the final recording.");
    } catch (e) {
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      if (typeof window !== "undefined") {
        console.warn("[HomeworkFlow] metric submit catch", e instanceof Error ? e.message : String(e));
      }
      const errCode = (e as HomeworkApiError).code;
      const errMessage = e instanceof Error ? e.message : "Failed to submit";

      if (errCode === "RECORDING_1_FAILED") {
        setMetricStepBlockedByRecordingFailure(true);
        setError(errMessage || "We couldn't analyze your recording. Please try again or contact support.");
        toast.error(errMessage || "We couldn't analyze your recording. Please try again or contact support.");
        return;
      }

      // RECORDING_1_PROCESSING: poll GET status only to decide when to retry the same mutation. Do not use GET to set step or applyStatusToState; step advances only when POST metric-answers succeeds.
      if (errCode === "RECORDING_1_PROCESSING") {
        setError(errMessage || "Still analyzing your recording. Please wait a moment.");
        toast.info(errMessage || "Still analyzing your recording. Please wait a moment.");
        const maxWaitMs = 60000;
        const pollIntervalMs = 2500;
        const start = Date.now();
        while (Date.now() - start < maxWaitMs && sessionId) {
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          try {
            const statusRes = await homeworkApi.getStatus();
            const session = (statusRes as { session?: { performance_score_1?: number; context_short?: string; recording_1_processing_status?: string } })?.session;
            const ready = session?.performance_score_1 != null && (session?.context_short || session?.recording_1_processing_status === "completed");
            if (ready) {
              const retryResponse = await homeworkApi.submitMetricAnswers(sessionId, {
                metric_answer_1: a1,
                metric_answer_2: a2,
                metric_answer_3: a3,
              });
              applyStatusToState({
                status: "final_task_ready",
                session_id: sessionId,
                final_task: typeof retryResponse?.final_task === "string" ? retryResponse.final_task : undefined,
              });
              setError(null);
              if (retryResponse?.recording_1_fallback && retryResponse?.message?.trim()) {
                toast.info(retryResponse.message.trim());
              }
              toast.success("Answers saved. Continue to the final recording.");
              return;
            }
          } catch (retryErr) {
            if ((retryErr as HomeworkApiError).code === "RECORDING_1_PROCESSING") continue;
            if ((retryErr as HomeworkApiError).code === "RECORDING_1_FAILED") {
              setMetricStepBlockedByRecordingFailure(true);
              setError((retryErr as Error).message || "We couldn't analyze your recording. Please try again or contact support.");
              toast.error((retryErr as Error).message || "We couldn't analyze your recording. Please try again or contact support.");
              return;
            }
            throw retryErr;
          }
        }
        setError("Analysis is taking longer than usual. Please try again in a moment.");
        toast.error("Analysis is taking longer than usual. Please try again in a moment.");
        return;
      }

      if (isInvalidSessionStateError(e)) {
        // Do not call GET status here (contract: no GET inside mutation handler). User can refresh or refocus.
        // Advancing to step 3 on 409 would let the UI progress before metric-answers has actually succeeded.
        const msg =
          errMessage?.trim() ||
          "Session state conflict. The system may still be processing. Please wait a moment and click Continue again.";
        setError(msg);
        toast.info(msg);
      } else {
        const displayMsg =
          typeof errMessage === "string" && errMessage.trim()
            ? errMessage
            : errCode === "VALIDATION_ERROR"
              ? METRIC_ANSWERS_VALIDATION_MSG
              : "Failed to save answers. Please try again or refresh.";
        setError(displayMsg);
        toast.error(displayMsg);
      }
    } finally {
      setLoading(false);
      metricSubmitInProgress.current = false;
    }
  };

  const handleRecording2Complete = async (blob: Blob, durationSeconds: number) => {
    if (!sessionId) return;
    if (uploadRecording2InProgressRef.current) return;
    uploadRecording2InProgressRef.current = true;
    if (durationSeconds < RECORDING_2_DURATION_MIN || durationSeconds > RECORDING_2_DURATION_MAX) {
      uploadRecording2InProgressRef.current = false;
      const msg = `Final recording must be at least 1 minute 2 seconds (62s) and at most 5 minutes. You recorded ${durationSeconds}s.`;
      setError(msg);
      toast.error(msg);
      return;
    }
    if (uploadingRecording === 2) {
      uploadRecording2InProgressRef.current = false;
      return;
    }
    setUploadingRecording(2);
    setError(null);
    abortRef.current = new AbortController();
    try {
      await homeworkApi.uploadRecording2(sessionId, blob, durationSeconds, abortRef.current.signal);
      applyStatusToState({
        status: "post_questions",
        session_id: sessionId,
      });
    } catch (e) {
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      if (isInvalidSessionStateError(e)) {
        setError("Session state conflict. Please refresh the page or switch tab and back.");
        toast.error("Session state conflict. Please refresh the page or switch tab and back.");
      } else {
        const msg = e instanceof Error ? e.message : "Upload failed";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setUploadingRecording(null);
      abortRef.current = null;
      uploadRecording2InProgressRef.current = false;
    }
  };

  const handlePostAnswersSubmit = async (answersFromChild: Record<string, string>) => {
    if (!sessionId) return;
    if (postAnswersSubmitInProgress.current) return;
    const missing = questions.filter((q) => !(answersFromChild[toId(q.id)] ?? "").trim());
    if (missing.length > 0) {
      setError("Please answer all questions before continuing.");
      return;
    }
    postAnswersSubmitInProgress.current = true;
    setLoading(true);
    setError(null);
    try {
      const answers = questions.map((q) => ({
        question_id: toId(q.id),
        answer_text: (answersFromChild[toId(q.id)] ?? "").trim(),
      }));
      const res = await homeworkApi.submitPostAnswers(sessionId, answers);
      applyStatusToState({
        status: "completed",
        session_id: sessionId,
        report_text: res.report_text ?? "",
        performance_score_end: res.performance_score_end ?? null,
      });
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(
          "homeworkReport",
          JSON.stringify({ sessionId, reportText: res.report_text ?? "", performanceScoreEnd: res.performance_score_end ?? null })
        );
      }
    } catch (e) {
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      const err = e as { code?: string };
      if (err.code === "INVALID_SESSION_STATE") {
        setError("Session state conflict. Please refresh the page or switch tab and back.");
        toast.error("Session state conflict. Please refresh the page or switch tab and back.");
      } else {
        const msg = e instanceof Error ? e.message : "Failed to submit";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      postAnswersSubmitInProgress.current = false;
    }
  };

  const allPostQuestionsAnswered =
    questions.length === 0 ||
    questions.every((q) => (postAnswers[toId(q.id)] ?? "").trim() !== "");

  /** User-initiated refresh: GET status and apply. No downgrade; missing payload handled per Option B. */
  const refreshStatus = async () => {
    if (sessionId === "mock-session") return;
    setLoading(true);
    setError(null);
    setStatusUnknown(false);
    try {
      const statusRes = await homeworkApi.getStatus();
      if (!statusRes || statusRes.has_active_session === false) {
        applyStatusToState({ status: "none" });
        if (statusRes?.tutor_feedback_deadline && typeof statusRes.tutor_feedback_deadline === "string") {
          const ms = new Date(statusRes.tutor_feedback_deadline).getTime();
          if (Number.isFinite(ms) && ms > Date.now()) setTutorFeedbackDeadlineMs(ms);
        }
        if (typeof statusRes?.tutor_feedback_message === "string" && statusRes.tutor_feedback_message.trim()) {
          setTutorFeedbackMessage(statusRes.tutor_feedback_message.trim());
        }
        toast.success("Session was cleared. You can start a new one.");
      } else {
        applyStatusToState(getStatusToHomeworkResponse(statusRes));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh");
      toast.error(e instanceof Error ? e.message : "Failed to refresh");
    } finally {
      setLoading(false);
    }
  };

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

  // Step 0: No session — show Start homework so next run starts from step 1 (first recording)
  if (step === 0) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-start pt-16 w-full">
        <StepFlowWrapper step={0} syncingBehind={syncingBehind}>
          {tutorFeedbackMessage && (
            <div className="w-full max-w-md mx-auto mb-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 p-4 text-left">
              <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{tutorFeedbackMessage}</p>
              {tutorFeedbackDeadlineMs != null && (
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-2 font-mono tabular-nums">
                  Time remaining: {formatCountdown(Math.max(0, tutorFeedbackDeadlineMs - Date.now()))}
                </p>
              )}
            </div>
          )}
          <Card className="w-full max-w-md mx-auto p-6 sm:p-8 border-0 bg-transparent shadow-none">
          <div className="flex flex-col items-center text-center space-y-5">
            <div
              className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-full bg-orange-50"
              aria-hidden
            >
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-orange-100">
                <Mic className="h-7 w-7 sm:h-8 sm:w-8 text-orange-500" strokeWidth={2} />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">Homework</h2>
            {tutorFeedbackDeadlineMs != null && !tutorFeedbackMessage ? (
              <div className="w-full max-w-md rounded-xl bg-amber-50 dark:bg-amber-950/30 p-4 text-left space-y-2">
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  Your tutor has <span className="font-mono font-semibold tabular-nums">{formatCountdown(Math.max(0, tutorFeedbackDeadlineMs - Date.now()))}</span> to send you feedback and a new homework on your email address.
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  You can start the lesson now though it will be awkwardly similar to the previous one!
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground max-w-md">
                Complete your warm-up recording, then the metric questions and main recording. You’ll get a report at the end.
              </p>
            )}
            {error && (
              <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2 text-left">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={handleStart} disabled={loading}>
                  Try again
                </Button>
              </div>
            )}
            <Button
              onClick={handleStart}
              disabled={loading}
              className="w-full max-w-md rounded-xl h-12 bg-primary text-white font-semibold hover:bg-primary/90"
            >
              {loading ? "Starting…" : "Start homework"}
            </Button>
          </div>
        </Card>
        </StepFlowWrapper>
      </div>
    );
  }

  // Step 1: Warm-up text + recorder — show as soon as session exists (from POST start response)
  if (step === 1) {
    const isUploadingRec1 = uploadingRecording === 1;
    if (isUploadingRec1) {
      return (
        <StepFlowWrapper step={1} syncingBehind={syncingBehind}>
          <Card className="p-6 border-0 bg-transparent shadow-none">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <h3 className="text-lg font-semibold">Sending first recording</h3>
              <p className="text-sm text-muted-foreground">Please wait…</p>
            </div>
          </Card>
        </StepFlowWrapper>
      );
    }
    const warmUpEmpty = sessionId && !warmUpText.trim();
    const showStatusUnknownBlock = statusUnknown;
    const showWarmUpUnavailableBlock = warmUpEmpty && !statusUnknown;

    return (
      <StepFlowWrapper step={1} syncingBehind={syncingBehind}>
        {sessionId === "mock-session" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Preview mode — backend not connected. Recording will not be saved until you implement <code className="text-xs">POST /v2/homework/start</code>.
          </div>
        )}
        {showStatusUnknownBlock && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
            <p>Session could not be restored. Start over to begin a new session.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                startOverFromScratch();
                toast.info("Click Start homework to begin a new session.");
              }}
            >
              Start over
            </Button>
          </div>
        )}
        {showWarmUpUnavailableBlock && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
            <p>Warm-up prompt unavailable. Start over to begin a new session.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                startOverFromScratch();
                toast.info("Click Start homework to begin a new session.");
              }}
            >
              Start over
            </Button>
          </div>
        )}
        {!showStatusUnknownBlock && !showWarmUpUnavailableBlock && (
          <AudioRecorder
            prompt={warmUpText.trim() || DEFAULT_WARMUP_QUESTION}
            onRecordingComplete={handleRecording1Complete}
            stopAndSend
            uploading={isUploadingRec1}
            minDurationSeconds={RECORDING_1_DURATION_MIN}
          />
        )}
        {sessionId && sessionId !== "mock-session" && (
          <div className="mt-[1px] flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleAbandon}
              disabled={loading}
            >
              Abandon session
            </Button>
          </div>
        )}
      </StepFlowWrapper>
    );
  }

  // Step 2: metric questions — only show form when task_block is loaded; otherwise show loading (or error if fetch settled with no data)
  if (step === 2) {
    const step2DataReady = taskBlock != null;
    if (!step2DataReady && sessionId && sessionId !== "mock-session") {
      return (
        <StepFlowWrapper step={step} syncingBehind={syncingBehind}>
          <Card className="p-6 border-0 bg-transparent shadow-none">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <p className="text-sm text-muted-foreground">Loading questions…</p>
              {taskBlockFetchSettled && error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </Card>
          <div className="mt-[1px] flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleAbandon}
              disabled={loading}
            >
              Abandon session
            </Button>
          </div>
        </StepFlowWrapper>
      );
    }
    return (
      <StepFlowWrapper step={step} syncingBehind={syncingBehind}>
        <AnswerMetricQuestionsScreen
          sessionId={sessionId!}
          taskBlock={taskBlock}
          onSubmit={handleMetricAnswersSubmit}
          loading={loading}
          error={error}
          onAbandon={sessionId && sessionId !== "mock-session" ? handleAbandon : undefined}
          submitDisabled={metricStepBlockedByRecordingFailure}
        />
      </StepFlowWrapper>
    );
  }

  // Step 3: Final task + record
  if (step === 3) {
    const isUploadingRec2 = uploadingRecording === 2;
    if (isUploadingRec2) {
      return (
        <StepFlowWrapper step={step} syncingBehind={syncingBehind}>
          <Card className="p-6 border-0 bg-transparent shadow-none">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <h3 className="text-lg font-semibold">Sending second recording</h3>
              <p className="text-sm text-muted-foreground">Please wait…</p>
            </div>
          </Card>
        </StepFlowWrapper>
      );
    }
    return (
      <StepFlowWrapper step={step} syncingBehind={syncingBehind}>
        <AudioRecorder
          prompt={finalTaskText || "—"}
          onRecordingComplete={handleRecording2Complete}
          stopAndSend
          uploading={isUploadingRec2}
          minDurationSeconds={RECORDING_2_DURATION_MIN}
        />
        <div className="mt-[1px] flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleAbandon}
            disabled={loading}
          >
            Abandon session
          </Button>
        </div>
      </StepFlowWrapper>
    );
  }

  // Step 4: Reflective questions — only show form when questions are loaded (or 0 and we're auto-submitting). Otherwise show loading or error.
  if (step === 4) {
    // #region agent log
    debugIngest("http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1", { location: "HomeworkFlowCard.tsx:step4", message: "step4 render", data: { step: 4, questionsLen: questions.length, postAnswersKeys: Object.keys(postAnswers).length }, timestamp: Date.now(), hypothesisId: "H1" });
    // #endregion
    const step4DataReady = questions.length > 0 || (questionsStep4Settled && questions.length === 0);
    if (!step4DataReady && sessionId && sessionId !== "mock-session") {
      return (
        <StepFlowWrapper step={step} syncingBehind={syncingBehind}>
          <Card className="p-6 border-0 bg-transparent shadow-none">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <p className="text-sm text-muted-foreground">Loading questions…</p>
            </div>
          </Card>
          <div className="mt-[1px] flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleAbandon}
              disabled={loading}
            >
              Abandon session
            </Button>
          </div>
        </StepFlowWrapper>
      );
    }
    if (questionsStep4Settled && questions.length === 0 && sessionId && sessionId !== "mock-session") {
      // Fetch returned 0 questions — we're in auto-submit path (loading) or failed; show minimal UI
      return (
        <StepFlowWrapper step={step} syncingBehind={syncingBehind}>
          <Card className="p-6 border-0 bg-transparent shadow-none">
            <div className="text-center space-y-4">
              {loading ? (
                <>
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                  <p className="text-sm text-muted-foreground">Finishing…</p>
                </>
              ) : (
                <>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <p className="text-sm text-muted-foreground">No reflective questions for this session.</p>
                </>
              )}
            </div>
          </Card>
          <div className="mt-[1px] flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleAbandon}
              disabled={loading}
            >
              Abandon session
            </Button>
          </div>
        </StepFlowWrapper>
      );
    }
    return (
      <StepFlowWrapper step={step} syncingBehind={syncingBehind}>
        <PostQuestionsStepScreen
          questions={questions}
          onSubmit={handlePostAnswersSubmit}
          loading={loading}
          error={error}
        />
        {sessionId && sessionId !== "mock-session" && (
          <div className="mt-[1px] flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleAbandon}
              disabled={loading}
            >
              Abandon session
            </Button>
          </div>
        )}
      </StepFlowWrapper>
    );
  }

  // Step 5: Report — only show report content when data (or error) is loaded; otherwise show loading
  if (step === 5) {
    const step5DataReady = reportData != null || (reportError != null && !reportLoading);
    if (!step5DataReady) {
      return (
        <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
          <Card className="border-0 bg-transparent p-6 shadow-none">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <p className="text-sm text-muted-foreground">Loading report…</p>
            </div>
          </Card>
        </div>
      );
    }

    const displayScores = reportData?.scores ?? (performanceScoreEnd != null ? { warmup: undefined, final: undefined, overall: Math.round(performanceScoreEnd * 100) } : undefined);
    const displayReportText = reportData?.report_text ?? reportText;

    // Progress chart needs performance_history from GET report (oldest first). Cap at last 5.
    // If backend omits it or returns empty, we show only current session as S1.
    const performanceHistory = reportData?.performance_history;
    const lastFive = performanceHistory?.length ? performanceHistory.slice(-5) : [];
    const progressChartData =
      lastFive.length > 0
        ? lastFive.map((p, i) => ({
            sessionLabel: `S${i + 1}`,
            date: p.date,
            score: p.score,
          }))
        : displayScores?.overall != null
          ? [{ sessionLabel: "S1", date: new Date().toISOString(), score: displayScores.overall }]
          : [];

    return (
      <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
        <Card className="border-0 bg-transparent p-6 space-y-4 shadow-none">
          <h3 className="text-center text-lg font-semibold">Your report</h3>
          {reportError && (
            <p className="text-sm text-destructive">{reportError}</p>
          )}
          <div className="space-y-4">
            {/* 1. Final recording player */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Your final recording</p>
              {reportData?.final_recording?.audio_url ? (
                <audio controls src={reportData.final_recording.audio_url} className="w-full max-w-md" />
              ) : (
                <p className="text-sm text-muted-foreground">Recording playback not available.</p>
              )}
            </div>
            {/* 2. Progress over sessions chart */}
            {progressChartData.length > 0 && (
              <ProgressOverSessionsChart data={progressChartData} />
            )}
            {/* 3. Report text */}
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                {displayReportText.trim() || "Report pending."}
              </p>
            </div>
          </div>
          <Button onClick={handleStartOver} disabled={resetting} className="mt-2 w-full rounded-xl h-12 font-semibold">
            {resetting ? "Resetting…" : "Start new homework"}
          </Button>
        </Card>
      </div>
    );
  }

  return null;
}
