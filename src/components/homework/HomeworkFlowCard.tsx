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

type Step = 1 | 2 | 3 | 4 | 5;

/** Derive current step and restored state from session status. Step only from the five canonical statuses (warm_up, task_block, final_task_ready, post_questions, completed). */
function deriveStepFromStatus(s: HomeworkSessionStatus): {
  step: Step;
  warmUpText: string;
  taskText: string;
  taskBlock: TaskBlockV2 | null;
  finalTaskText: string;
  questions: HomeworkQuestion[];
  reportText: string;
  performanceScoreEnd: number | null;
  /** True when status was missing or not one of the five; UI should show error + Refresh. */
  statusUnknown: boolean;
} {
  const session = (s as HomeworkSessionStatus).session;
  const statusRaw =
    s.status ??
    session?.status ??
    session?.state ??
    s.session_state ??
    "";
  const status = statusRaw.toLowerCase().trim().replace(/\s+/g, "_");

  const warmUpTask = s.warm_up_task ?? session?.warm_up_task;
  const warmUpText = (warmUpTask?.text ?? s.warm_up_task_text ?? session?.warm_up_task_text ?? "").trim() || "";
  const taskText = s.task_text ?? "";
  const q1 = s.session_metric_question_1 ?? session?.session_metric_question_1;
  const q2 = s.session_metric_question_2 ?? session?.session_metric_question_2;
  const q3 = s.session_metric_question_3 ?? session?.session_metric_question_3;
  const taskBlock =
    s.task_block ??
    (q1 != null || q2 != null || q3 != null
      ? { metric_question_1: q1 ?? undefined, metric_question_2: q2 ?? undefined, metric_question_3: q3 ?? undefined }
      : null);
  const finalTaskText = (session?.final_task_text ?? s.final_task_text ?? toText(s.final_task) ?? "").trim() || "";
  const reportText = (s.report_text ?? session?.context_long ?? "").trim() || "";
  const performanceScoreEnd = s.performance_score_end ?? session?.performance_score_end ?? null;
  const questions = Array.isArray(s.questions) ? s.questions : [];

  // Empty or missing status is normal for a brand-new session (e.g. right after POST start). Treat as step 1 so we don't show "Session could not be restored" and unmount the recorder.
  if (status === "" || status === "created" || status === "initializing" || status === "pending") {
    return { step: 1, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  }

  // Canonical statuses (taskmaster)
  if (status === "warm_up") return { step: 1, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "task_block") return { step: 2, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "final_task_ready") return { step: 3, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "post_questions") return { step: 4, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "completed") return { step: 5, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd, statusUnknown: false };

  // Backend may use different strings; map common aliases so we don't get stuck on "unknown status"
  // After recording 1: backend may return warmup_recorded, warmup_scored, focus_selected, task_generated → step 2 (metric questions)
  if (status === "warmup_recorded" || status === "warmup_scored" || status === "focus_selected" || status === "task_generated") return { step: 2, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "final_task" || status === "ready_for_final" || status === "final_task_ready") return { step: 3, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "post_task" || status === "post_task_questions" || status === "reflective") return { step: 4, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "recording2_uploaded" || status === "recording2_scored") return { step: 4, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "finished" || status === "done" || status === "post_questions_done" || status === "report_generated") return { step: 5, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd, statusUnknown: false };

  // #region agent log
  debugIngest("http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1", { location: "HomeworkFlowCard.tsx:deriveStepFromStatus", message: "unmapped status -> step 1", data: { statusRaw, status, step: 1, statusUnknown: true }, timestamp: Date.now(), hypothesisId: "H1" });
  // #endregion
  return { step: 1, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: true };
}

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
  step: Step | 0;
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
  const [step, setStep] = useState<Step | 0>(0);
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
  /** Ticker so countdown re-renders every second when tutor deadline is shown. */
  const [countdownTick, setCountdownTick] = useState(0);
  /** Minimum step the UI may show after a confirmed mutation success. Prevents regressing when GET status is stale. Reset to 0 when there is no session or user starts over / goes to dashboard. */
  const uiStepFloorRef = useRef(0);
  /** Last step derived from GET status (before clamping). Used to detect "sync behind" and show Syncing… / retry. */
  const lastDerivedStepRef = useRef(0);
  /** Current UI step (updated when step state changes). Used in applyStatusToState to never set step lower than displayed. */
  const lastStepRef = useRef(0);
  /** Latest known task content; preserved when applyStatusToState gets a thin GET response so task does not disappear. */
  const taskBlockRef = useRef<TaskBlockV2 | null>(null);
  const finalTaskTextRef = useRef<string>("");

  /** Keep lastStepRef in sync with step so applyStatusToState can clamp to never go backward. */
  useEffect(() => {
    lastStepRef.current = step;
  }, [step]);

  /** On step 0, fetch status so we get backend tutor_feedback_deadline (when no active session). Wait for auth to avoid 500 on first load. */
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
    }).catch(() => {
      setTutorFeedbackDeadlineMs(null);
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

  /** While on step 0 with timer showing, poll session/status so we hide the timer when backend clears tutor_feedback_deadline (e.g. tutor sent feedback). */
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

  /** Keep refs in sync with task content so applyStatusToState can preserve them when GET response omits task_block/final_task_text. */
  useEffect(() => {
    taskBlockRef.current = taskBlock;
    finalTaskTextRef.current = finalTaskText;
  }, [taskBlock, finalTaskText]);

  /** Apply GET session/status to state. Step is clamped: nextStep = max(derivedStep, uiStepFloor) so we never go backward after a successful mutation. */
  const applyStatusToState = (statusRes: HomeworkSessionStatus) => {
    const derived = deriveStepFromStatus(statusRes);
    const statusRaw =
      statusRes.status ??
      statusRes.session?.status ??
      statusRes.session?.state ??
      (statusRes as { session_state?: string }).session_state ??
      "";
    if (typeof window !== "undefined") {
      console.warn("[HomeworkFlow] applyStatusToState", { statusRaw: String(statusRaw), derivedStep: derived.step, floor: uiStepFloorRef.current });
    }
    const sessionIdFromRes =
      statusRes.session_id ?? statusRes.session?.id ?? null;
    let reportTextToSet = derived.reportText;
    let performanceScoreEndToSet = derived.performanceScoreEnd;
    if (derived.step === 4 && sessionIdFromRes && typeof sessionStorage !== "undefined") {
      const storedReportRaw = sessionStorage.getItem("homeworkReport");
      if (storedReportRaw) {
        try {
          const r = JSON.parse(storedReportRaw) as { sessionId?: string; reportText?: string; performanceScoreEnd?: number | null };
          if (r.sessionId === sessionIdFromRes) {
            uiStepFloorRef.current = 5;
            reportTextToSet = r.reportText ?? "";
            performanceScoreEndToSet = r.performanceScoreEnd ?? null;
          }
        } catch {
          /* ignore */
        }
      }
    }
    setSessionId(sessionIdFromRes);
    setWarmUpText(resolveWarmUpText(derived.warmUpText));
    setTaskText(derived.taskText);
    setTaskBlock(derived.taskBlock ?? taskBlockRef.current ?? null);
    setFinalTaskText(derived.finalTaskText?.trim() ? derived.finalTaskText.trim() : (finalTaskTextRef.current || ""));
    setReportText(reportTextToSet);
    setPerformanceScoreEnd(performanceScoreEndToSet);
    const qList = derived.questions.map((q) => ({
      ...q,
      id: toId(q.id) || crypto.randomUUID(),
      text: toText(q.text),
    }));
    setQuestions(qList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
    lastDerivedStepRef.current = derived.step;
    const stepToSet = Math.max(derived.step, uiStepFloorRef.current, lastStepRef.current) as Step | 0;
    setStep(stepToSet);
    setStatusUnknown(derived.statusUnknown);
    setError(derived.statusUnknown ? "Session status could not be determined. Please refresh." : null);
    const deadlineIso = (statusRes as { tutor_feedback_deadline?: string | null }).tutor_feedback_deadline;
    if (deadlineIso && typeof deadlineIso === "string") {
      const ms = new Date(deadlineIso).getTime();
      setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
    } else {
      setTutorFeedbackDeadlineMs(null);
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
        "";
      setSessionId(startRes.session_id);
      setStep(1);
      setWarmUpText(resolveWarmUpText(warmUpTextFromStart));
      setError(null);
      setStatusUnknown(false);
      const statusRes = await homeworkApi.getStatus();
      const sessionIdFromStatus = statusRes?.session_id ?? (statusRes as { session?: { id?: string } })?.session?.id;
      if (statusRes && sessionIdFromStatus === startRes.session_id) {
        const derived = deriveStepFromStatus(statusRes);
        // Don't overwrite with statusUnknown when we just started — keeps recorder visible and avoids "Session could not be restored" on new session.
        if (!derived.statusUnknown) applyStatusToState(statusRes);
      } else {
        setSessionId(startRes.session_id);
        setStep(1);
        setWarmUpText(resolveWarmUpText(warmUpTextFromStart));
      }
    } catch (e) {
      if (isNoWarmupError(e)) {
        setNoWarmupConfigured(true);
        setError(null);
        uiStepFloorRef.current = 0;
        lastDerivedStepRef.current = 0;
        setStep(0);
        setSessionId(null);
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to start homework";
      const isBackendUnavailable = msg.includes("not available yet") || msg.includes("404");
      if (isBackendUnavailable) {
        setSessionId("mock-session");
        setWarmUpText("");
        setStep(1);
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
      uiStepFloorRef.current = 0;
      lastDerivedStepRef.current = 0;
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
      const msg = e instanceof Error ? e.message : "Failed to abandon session";
      setError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }
    // Full restart: clear storage and all state; do not refetch status (avoids re-applying any session).
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("homeworkReport");
      sessionStorage.removeItem("homeworkJustFinishedRecording2");
    }
    uiStepFloorRef.current = 0;
    lastDerivedStepRef.current = 0;
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
    setNoWarmupConfigured(false);
    setStatusUnknown(false);
    setUploadingRecording(null);
    setLoading(false);
  };

  /** Local-only reset to step 0 (no API call). Use when session is already gone (404) so user can start a new lesson. */
  const startOverFromScratch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    uiStepFloorRef.current = 0;
    lastDerivedStepRef.current = 0;
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
    setUploadingRecording(null);
    setLoading(false);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem("homeworkReport");
      sessionStorage.removeItem("homeworkJustFinishedRecording2");
    }
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

  // On auth ready: try to resume from session status; otherwise start a new session (once per page load)
  useEffect(() => {
    if (!authReady || step !== 0 || autoStartAttempted) return;
    autoStartAttempted = true;
    setLoading(true);
    homeworkApi
      .getStatus()
      .then((statusRes) => {
        const hasActive = statusRes?.has_active_session !== false;
        const sessionIdFromRes = statusRes?.session_id ?? (statusRes as { session?: { id?: string } })?.session?.id;
        const statusRaw =
          (statusRes as { status?: string })?.status ??
          (statusRes as { session?: { status?: string } })?.session?.status ??
          "";
        const isCompleted = statusRaw.toLowerCase().trim() === "completed";
        if (!hasActive || !sessionIdFromRes || isCompleted) {
          const storedReport =
            typeof sessionStorage !== "undefined" && sessionStorage.getItem("homeworkReport");
          if (storedReport) {
            try {
              const parsed = JSON.parse(storedReport) as {
                sessionId?: string;
                reportText?: string;
                performanceScoreEnd?: number | null;
              };
              if (parsed.sessionId && (parsed.reportText !== undefined || parsed.performanceScoreEnd != null)) {
                setSessionId(parsed.sessionId);
                setReportText(parsed.reportText ?? "");
                setPerformanceScoreEnd(parsed.performanceScoreEnd ?? null);
                setStep(5);
                setWarmUpText("");
                setTaskText("");
                setTaskBlock(null);
                setFinalTaskText("");
                setQuestions([]);
                setError(null);
                setStatusUnknown(false);
                setLoading(false);
                return;
              }
            } catch {
              // ignore invalid JSON
            }
          }
          uiStepFloorRef.current = 0;
          lastDerivedStepRef.current = 0;
          setSessionId(null);
          setStep(0);
          setWarmUpText("");
          setTaskText("");
          setTaskBlock(null);
          setFinalTaskText("");
          setQuestions([]);
          setReportText("");
          setPerformanceScoreEnd(null);
          setError(null);
          setStatusUnknown(false);
          setLoading(false);
          const deadlineIso = statusRes?.tutor_feedback_deadline;
          if (deadlineIso && typeof deadlineIso === "string") {
            const ms = new Date(deadlineIso).getTime();
            setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
          } else {
            setTutorFeedbackDeadlineMs(null);
          }
          return;
        }
        if (statusRes) {
          const sessionIdFromResForReport = statusRes?.session_id ?? (statusRes as { session?: { id?: string } })?.session?.id;
          const storedReportRaw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("homeworkReport") : null;
          if (storedReportRaw && sessionIdFromResForReport) {
            try {
              const r = JSON.parse(storedReportRaw) as { sessionId?: string; reportText?: string; performanceScoreEnd?: number | null };
              if (r.sessionId && r.sessionId === sessionIdFromResForReport) {
                uiStepFloorRef.current = 5;
                setSessionId(r.sessionId);
                setReportText(r.reportText ?? "");
                setPerformanceScoreEnd(r.performanceScoreEnd ?? null);
                setStep(5);
                setWarmUpText("");
                setTaskText("");
                setTaskBlock(null);
                setFinalTaskText("");
                setQuestions([]);
                setError(null);
                setStatusUnknown(false);
                setLoading(false);
                return;
              }
            } catch {
              // ignore invalid JSON
            }
          }
          const derived = deriveStepFromStatus(statusRes);
          const flag = typeof sessionStorage !== "undefined" && sessionStorage.getItem("homeworkJustFinishedRecording2") === "1";
          if (flag) {
            uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 4);
            if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("homeworkJustFinishedRecording2");
          }
          applyStatusToState(statusRes);
        }
      })
      .catch((e) => {
        if (isNoWarmupError(e)) {
          setNoWarmupConfigured(true);
          setError(null);
        } else {
          setError("Could not load session. Click Start homework to begin.");
        }
      })
      .finally(() => setLoading(false));
  }, [authReady, step]);

  // On step 2, if task_block is missing (e.g. user refreshed), load it from GET task-block
  useEffect(() => {
    if (step !== 2 || !sessionId || sessionId === "mock-session" || taskBlock != null) return;
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
      });
    return () => {
      cancelled = true;
    };
  }, [step, sessionId, taskBlock]);

  // On step 4, if questions are missing (thin status or refresh), load from GET questions. If none, finish without post-questions (auto-submit to get report).
  useEffect(() => {
    if (step !== 4 || !sessionId || sessionId === "mock-session" || questions.length > 0) return;
    if (postAnswersAutoSubmitDoneRef.current) return;
    let cancelled = false;
    homeworkApi
      .getQuestions(sessionId)
      .then(({ questions: qList }) => {
        if (cancelled) return;
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
                const reportTextVal = res.report_text ?? "";
                const scoreVal = res.performance_score_end ?? null;
                setReportText(reportTextVal);
                setPerformanceScoreEnd(scoreVal);
                uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 5);
                setStep(5);
                if (typeof sessionStorage !== "undefined") {
                  sessionStorage.setItem(
                    "homeworkReport",
                    JSON.stringify({ sessionId, reportText: reportTextVal, performanceScoreEnd: scoreVal })
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
        if (!cancelled) setError("Could not load questions. Try continuing or refresh.");
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
    // If session already advanced past warm_up (e.g. another tab or race), sync and skip upload to avoid 409
    try {
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) {
        const derived = deriveStepFromStatus(statusRes);
        if (derived.step >= 2) {
          applyStatusToState(statusRes);
          toast.info("Session already advanced. You're on the right step now.");
          return;
        }
      }
    } catch {
      /* proceed to upload */
    }
    setUploadingRecording(1);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const recording1Res = await homeworkApi.uploadRecording1(sessionId, blob, durationSeconds, abortRef.current.signal);
      uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 2);
      lastDerivedStepRef.current = 2;
      // Show step 2 and metric questions immediately from POST response (no wait for getStatus)
      setStep(2);
      if (recording1Res?.task_block) setTaskBlock(recording1Res.task_block);
      setStatusUnknown(false);
      setError(null);
      // Sync rest of session state in background; keep task_block from POST so GET can't overwrite with stale null
      try {
        const statusRes = await homeworkApi.getStatus();
        if (statusRes) applyStatusToState(statusRes);
        if (recording1Res?.task_block) setTaskBlock(recording1Res.task_block);
        // Ensure we stay on step 2 after sync (backend may still return warm_up briefly)
        setStep((s) => (s >= 2 ? s : 2));
      } catch {
        // Keep step 2 and task_block from upload response; user can continue
      }
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
        uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 2);
        const backendStatus = (e as HomeworkApiError).backendStatus;
        if (backendStatus) {
          applyStatusToState({ status: backendStatus, session_id: sessionId ?? undefined } as HomeworkSessionStatus);
        }
        try {
          const statusRes = await homeworkApi.getStatus();
          if (statusRes) {
            applyStatusToState(statusRes);
            toast.success("Session updated. You're on the right step now.");
          } else {
            setError("Session state changed. Please refresh.");
            toast.error("Session state changed. Please refresh.");
          }
        } catch {
          try {
            const statusResRetry = await homeworkApi.getStatus();
            if (statusResRetry) {
              applyStatusToState(statusResRetry);
              toast.success("Session updated.");
            } else {
              setError("Could not refresh session. Click Refresh below.");
              toast.error("Could not refresh session. Click Refresh below.");
            }
          } catch {
            setError("Could not refresh session. Click Refresh to try again.");
            toast.error("Could not refresh session. Click Refresh to try again.");
          }
        }
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
          hasFinalTask: !!(metricResponse?.final_task ?? metricResponse?.final_task_text),
          hasError: !!responseErr,
          errorMsg: responseErr ?? undefined,
        });
      }
      uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 3);
      const statusRes = await homeworkApi.getStatus();
      const finalTextFromResponse =
        typeof metricResponse?.final_task === "string"
          ? metricResponse.final_task
          : typeof metricResponse?.final_task_text === "string"
            ? metricResponse.final_task_text
            : metricResponse?.final_task && typeof (metricResponse.final_task as { text?: string }).text === "string"
              ? (metricResponse.final_task as { text: string }).text
              : "";
      if (statusRes) {
        applyStatusToState(statusRes);
        const finalFromSession =
          statusRes?.session && typeof (statusRes.session as { final_task_text?: string }).final_task_text === "string"
            ? (statusRes.session as { final_task_text: string }).final_task_text
            : "";
        const finalText = (finalTextFromResponse.trim() || finalFromSession.trim()) || "";
        if (finalText) setFinalTaskText(finalText);
      } else {
        setStep(3);
        if (finalTextFromResponse.trim()) setFinalTaskText(finalTextFromResponse.trim());
        setStatusUnknown(false);
        setError(null);
      }
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
        setError(errMessage || "We couldn't analyze your recording. Please try again or contact support.");
        toast.error(errMessage || "We couldn't analyze your recording. Please try again or contact support.");
        return;
      }

      if (errCode === "RECORDING_1_PROCESSING") {
        toast.info("Still analyzing your recording. Please wait a moment.");
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
              uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 3);
              const statusRes2 = await homeworkApi.getStatus();
              const finalTextFromResponse =
                typeof retryResponse?.final_task === "string"
                  ? retryResponse.final_task
                  : typeof retryResponse?.final_task_text === "string"
                    ? retryResponse.final_task_text
                    : retryResponse?.final_task && typeof (retryResponse.final_task as { text?: string }).text === "string"
                      ? (retryResponse.final_task as { text: string }).text
                      : "";
              if (statusRes2) {
                applyStatusToState(statusRes2);
                const finalFromSession =
                  statusRes2?.session && typeof (statusRes2.session as { final_task_text?: string }).final_task_text === "string"
                    ? (statusRes2.session as { final_task_text: string }).final_task_text
                    : "";
                const finalText = (finalTextFromResponse.trim() || finalFromSession.trim()) || "";
                if (finalText) setFinalTaskText(finalText);
              } else {
                setStep(3);
                if (finalTextFromResponse.trim()) setFinalTaskText(finalTextFromResponse.trim());
                setStatusUnknown(false);
                setError(null);
              }
              toast.success("Answers saved. Continue to the final recording.");
              return;
            }
          } catch (retryErr) {
            if ((retryErr as HomeworkApiError).code === "RECORDING_1_PROCESSING") continue;
            if ((retryErr as HomeworkApiError).code === "RECORDING_1_FAILED") {
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
        uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 3);
        const backendStatus = (e as HomeworkApiError).backendStatus;
        if (backendStatus) {
          applyStatusToState({ status: backendStatus, session_id: sessionId ?? undefined } as HomeworkSessionStatus);
        }
        try {
          const statusRes = await homeworkApi.getStatus();
          if (statusRes) {
            applyStatusToState(statusRes);
            const derived = deriveStepFromStatus(statusRes);
            if (derived.step === 2) {
              setError("Answers could not be saved. Please try again or refresh the page.");
              toast.error("Answers could not be saved. Please try again or refresh.");
            } else {
              toast.success("Session updated. You're on the right step now.");
            }
          } else {
            setError("Session state changed. Please refresh.");
            toast.error("Session state changed. Please refresh.");
          }
        } catch {
          setError(errMessage);
          toast.error(errMessage);
        }
      } else {
        const isValidationError = errCode === "VALIDATION_ERROR";
        const rawMsg = isValidationError ? METRIC_ANSWERS_VALIDATION_MSG : errMessage;
        const displayMsg = (typeof rawMsg === "string" && rawMsg.trim()) ? rawMsg : "Failed to save answers. Please try again or refresh.";
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
      uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 4);
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem("homeworkJustFinishedRecording2", "1");
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) applyStatusToState(statusRes);
    } catch (e) {
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      if (isInvalidSessionStateError(e)) {
        uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 4);
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem("homeworkJustFinishedRecording2", "1");
        const backendStatus = (e as HomeworkApiError).backendStatus;
        if (backendStatus) {
          applyStatusToState({ status: backendStatus, session_id: sessionId ?? undefined } as HomeworkSessionStatus);
        }
        try {
          const statusRes = await homeworkApi.getStatus();
          if (statusRes) {
            applyStatusToState(statusRes);
            toast.success("Session updated. You're on the right step now.");
          }
        } catch {
          setError(e instanceof Error ? e.message : "Upload failed");
          toast.error(e instanceof Error ? e.message : "Upload failed");
        }
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
      // Completed sessions are not returned by GET status; show report from response. Set floor so applyStatusToState cannot revert to step 4.
      const reportTextVal = res.report_text ?? "";
      const scoreVal = res.performance_score_end ?? null;
      setReportText(reportTextVal);
      setPerformanceScoreEnd(scoreVal);
      uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 5);
      setStep(5);
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(
          "homeworkReport",
          JSON.stringify({ sessionId, reportText: reportTextVal, performanceScoreEnd: scoreVal })
        );
      }
    } catch (e) {
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to submit";
      setError(msg);
      toast.error(msg);
      // On session state conflict, refetch status so step syncs with backend (e.g. back to step 3 if main recording not done)
      const err = e as { code?: string };
      if (err.code === "INVALID_SESSION_STATE" && sessionId) {
        try {
          const statusRes = await homeworkApi.getStatus();
          if (statusRes) applyStatusToState(statusRes);
        } catch {
          // ignore
        }
      }
    } finally {
      setLoading(false);
      postAnswersSubmitInProgress.current = false;
    }
  };

  const allPostQuestionsAnswered =
    questions.length === 0 ||
    questions.every((q) => (postAnswers[toId(q.id)] ?? "").trim() !== "");

  /** Refetch GET status and apply to state (e.g. after "Refresh" when status unknown or warm-up empty). If no active session (e.g. cleaned up), redirect to step 0. */
  const refreshStatus = async () => {
    if (!sessionId || sessionId === "mock-session") return;
    setLoading(true);
    setError(null);
    setStatusUnknown(false);
    try {
      const statusRes = await homeworkApi.getStatus();
      const hasActive = statusRes?.has_active_session !== false;
      const sessionIdFromRes = statusRes?.session_id ?? (statusRes as { session?: { id?: string } })?.session?.id;
      if (!statusRes || !hasActive || !sessionIdFromRes) {
        // Session was cleaned up or no longer exists — full reset to step 0 so user can start fresh
        if (abortRef.current) {
          abortRef.current.abort();
          abortRef.current = null;
        }
        uiStepFloorRef.current = 0;
        lastDerivedStepRef.current = 0;
        postAnswersAutoSubmitDoneRef.current = false;
        metricSubmitInProgress.current = false;
        postAnswersSubmitInProgress.current = false;
        uploadRecording1InProgressRef.current = false;
        uploadRecording2InProgressRef.current = false;
        setSessionId(null);
        setStep(0);
        setWarmUpText("");
        setTaskText("");
        setTaskBlock(null);
        setFinalTaskText("");
        setQuestions([]);
        setPostAnswers({});
        setReportText("");
        setPerformanceScoreEnd(null);
        setReportData(null);
        setReportLoading(false);
        setReportError(null);
        setNoWarmupConfigured(false);
        setStatusUnknown(false);
        setUploadingRecording(null);
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("homeworkReport");
          sessionStorage.removeItem("homeworkJustFinishedRecording2");
        }
        toast.success("Session was cleared. You can start a new one.");
        return;
      }
      applyStatusToState(statusRes);
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
            {tutorFeedbackDeadlineMs != null ? (
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

  // Step 2: 3 metric questions only (context_short is used by backend for the task, not shown here)
  if (step === 2) {
    return (
      <StepFlowWrapper step={step} syncingBehind={syncingBehind}>
        <AnswerMetricQuestionsScreen
          sessionId={sessionId!}
          taskBlock={taskBlock}
          onSubmit={handleMetricAnswersSubmit}
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

  // Step 4: Reflective questions (0 or N — if GET questions returned [], we skip to step 5). Enforce answer all before submit.
  if (step === 4) {
    // #region agent log
    debugIngest("http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1", { location: "HomeworkFlowCard.tsx:step4", message: "step4 render", data: { step: 4, questionsLen: questions.length, postAnswersKeys: Object.keys(postAnswers).length }, timestamp: Date.now(), hypothesisId: "H1" });
    // #endregion
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

  // Step 5: Report — (1) recording, (2) performance chart, (3) text, (4) button
  if (step === 5) {
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
          {reportLoading && (
            <p className="text-sm text-muted-foreground">Loading report…</p>
          )}
          {reportError && !reportLoading && (
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
