"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthReady } from "@/hooks/useAuthReady";
import { homeworkApi, type HomeworkApiError } from "@/lib/api/homework-client";
import type {
  HomeworkQuestion,
  HomeworkSessionStatus,
  TaskBlockV2,
} from "@/lib/api/types-homework";
import AnswerMetricQuestionsScreen from "@/components/homework/AnswerMetricQuestionsScreen";
import PostQuestionsStepScreen from "@/components/homework/PostQuestionsStepScreen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressStepBullets } from "@/components/ui/progress-step-bullets";
import AudioRecorder from "@/components/recording/AudioRecorder";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { debugIngest } from "@/lib/debugIngest";

const TOTAL_STEPS = 5;

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
  if (typeof window !== "undefined") {
    fetch("http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "HomeworkFlowCard.tsx:deriveStepFromStatus", message: "unmapped status -> step 1", data: { statusRaw, status, step: 1, statusUnknown: true }, timestamp: Date.now(), hypothesisId: "H1" }) }).catch(() => {});
  }
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

/** Stable wrapper so children (e.g. PostQuestionsStepScreen) do not remount on parent re-render. */
function StepFlowWrapper({
  step,
  children,
}: {
  step: Step | 0;
  children: React.ReactNode;
}) {
  const flowStepIndex = step >= 1 ? step - 1 : 0;
  return (
    <div className="space-y-4 animate-fade-in">
      <ProgressStepBullets
        total={TOTAL_STEPS}
        currentIndex={flowStepIndex}
        aria-label={step >= 1 ? `Step ${step} of ${TOTAL_STEPS}` : `Step 1 of ${TOTAL_STEPS}`}
      />
      {children}
    </div>
  );
}

export default function HomeworkFlowCard() {
  const router = useRouter();
  const authReady = useAuthReady();
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingRecording, setUploadingRecording] = useState<1 | 2 | null>(null);
  const [noWarmupConfigured, setNoWarmupConfigured] = useState(false);
  const [statusUnknown, setStatusUnknown] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const metricSubmitInProgress = useRef(false);
  const postAnswersSubmitInProgress = useRef(false);
  const uploadRecording1InProgressRef = useRef(false);
  const uploadRecording2InProgressRef = useRef(false);
  const postAnswersAutoSubmitDoneRef = useRef(false);
  /** Minimum step the UI may show after a confirmed mutation success. Prevents regressing when GET status is stale. Reset to 0 when there is no session or user starts over / goes to dashboard. */
  const uiStepFloorRef = useRef(0);

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
    setSessionId(sessionIdFromRes);
    setWarmUpText(derived.warmUpText);
    setTaskText(derived.taskText);
    setTaskBlock(derived.taskBlock);
    setFinalTaskText(derived.finalTaskText);
    setReportText(derived.reportText);
    setPerformanceScoreEnd(derived.performanceScoreEnd);
    const qList = derived.questions.map((q) => ({
      ...q,
      id: toId(q.id) || crypto.randomUUID(),
      text: toText(q.text),
    }));
    setQuestions(qList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
    const stepToSet = Math.max(derived.step, uiStepFloorRef.current) as Step | 0;
    setStep(stepToSet);
    setStatusUnknown(derived.statusUnknown);
    setError(derived.statusUnknown ? "Session status could not be determined. Please refresh." : null);
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
      setWarmUpText(warmUpTextFromStart);
      setError(null);
      setStatusUnknown(false);
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) applyStatusToState(statusRes);
      else {
        setSessionId(startRes.session_id);
        setStep(1);
        setWarmUpText(warmUpTextFromStart);
      }
    } catch (e) {
      if (isNoWarmupError(e)) {
        setNoWarmupConfigured(true);
        setError(null);
        uiStepFloorRef.current = 0;
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

  /** Finish the flow: clear state and go to dashboard. Next time user starts homework they will begin from step 1 (first recording). */
  const handleBackToDashboard = () => {
    resetAutoStartAttempted();
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("homeworkReport");
    uiStepFloorRef.current = 0;
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
    setError(null);
    setNoWarmupConfigured(false);
    setStatusUnknown(false);
    postAnswersAutoSubmitDoneRef.current = false;
    router.push("/dashboard");
  };

  /** Clear state and start a new session (new session_id from backend). Show step 1 (warm-up) immediately so the first step appears instantly. */
  const handleStartOver = () => {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("homeworkReport");
    uiStepFloorRef.current = 0;
    setSessionId(null);
    setStep(1);
    setWarmUpText("");
    setTaskText("");
    setFinalTaskText("");
    setTaskBlock(null);
    setQuestions([]);
    setPostAnswers({});
    setReportText("");
    setPerformanceScoreEnd(null);
    setError(null);
    setNoWarmupConfigured(false);
    setStatusUnknown(false);
    postAnswersAutoSubmitDoneRef.current = false;
    setLoading(true);
    homeworkApi
      .start()
      .then(async (startRes) => {
        const newSessionId = startRes.session_id ?? (startRes as { session_id?: string }).session_id ?? null;
        const warmUpTextFromStart =
          (startRes.warm_up_task && typeof startRes.warm_up_task === "object" && "text" in startRes.warm_up_task ? (startRes.warm_up_task as { text?: string }).text : null) ??
          (startRes as { warm_up_task?: { text?: string } }).warm_up_task?.text ??
          "";
        const statusRes = await homeworkApi.getStatus();
        if (statusRes) {
          const statusSessionId = statusRes.session_id ?? statusRes.session?.id ?? (statusRes as { session?: { id?: string } }).session?.id ?? null;
          if (typeof sessionStorage !== "undefined") sessionStorage.removeItem("homeworkJustFinishedRecording2");
          if (statusSessionId === newSessionId) {
            applyStatusToState(statusRes);
          } else {
            setSessionId(newSessionId);
            setStep(1);
            setWarmUpText(warmUpTextFromStart);
            setError(null);
            setStatusUnknown(false);
          }
        } else {
          setSessionId(newSessionId);
          setStep(1);
          setWarmUpText(warmUpTextFromStart);
          setError(null);
          setStatusUnknown(false);
        }
      })
      .catch((e) => {
        if (isNoWarmupError(e)) {
          setNoWarmupConfigured(true);
          setError(null);
          uiStepFloorRef.current = 0;
          setStep(0);
        } else {
          const msg = e instanceof Error ? e.message : "Failed to start";
          setError(msg);
          toast.error(msg);
          uiStepFloorRef.current = 0;
          setStep(0);
        }
      })
      .finally(() => setLoading(false));
  };

  /** Abandon current session via API, clear state, refetch status. On 200 or 409: clear and show Start. */
  const handleAbandon = async () => {
    if (!sessionId || sessionId === "mock-session") {
      handleStartOver();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await homeworkApi.abandonSession(sessionId);
      toast.success("Session abandoned. You can start a new session.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to abandon session";
      setError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }
    uiStepFloorRef.current = 0;
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
    setNoWarmupConfigured(false);
    setStatusUnknown(false);
    postAnswersAutoSubmitDoneRef.current = false;
    try {
      const statusRes = await homeworkApi.getStatus();
      if (statusRes?.has_active_session !== false && statusRes?.session_id) {
        applyStatusToState(statusRes);
      } else {
        setStep(0);
        setSessionId(null);
      }
    } catch {
      setStep(0);
      setSessionId(null);
    } finally {
      setLoading(false);
    }
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
          return;
        }
        if (statusRes) {
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
          void handleStart();
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

  const handleRecording1Complete = async (blob: Blob, durationSeconds: number) => {
    // #region agent log
    if (typeof window !== "undefined") {
      fetch("http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "HomeworkFlowCard.tsx:handleRecording1Complete:entry", message: "rec1 complete handler entered", data: { hasSessionId: !!sessionId, uploadInProgress: uploadRecording1InProgressRef.current, uploadingRecording, step, durationSeconds }, timestamp: Date.now(), hypothesisId: "H5" }) }).catch(() => {});
    }
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
      const recording1Res = await homeworkApi.uploadRecording1(sessionId, blob, durationSeconds, abortRef.current.signal);
      uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 2);
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) {
        applyStatusToState(statusRes);
        const s = statusRes as HomeworkSessionStatus;
        if (recording1Res?.task_block && !s.task_block) setTaskBlock(recording1Res.task_block);
      } else {
        setStep(2);
        if (recording1Res?.task_block) setTaskBlock(recording1Res.task_block);
        setStatusUnknown(false);
        setError(null);
      }
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9fb51955-8d8a-45a5-8be0-0c14c26dafe1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HomeworkFlowCard.tsx:handleRecording1Complete catch',message:'rec1 error',data:{error:String((e as Error)?.message),code:(e as {code?:string})?.code},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      if (isInvalidSessionStateError(e)) {
        const backendStatus = (e as HomeworkApiError).backendStatus;
        if (backendStatus) {
          applyStatusToState({ status: backendStatus } as HomeworkSessionStatus);
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
      if (typeof window !== "undefined") {
        console.warn("[HomeworkFlow] metric submit catch", e instanceof Error ? e.message : String(e));
      }
      if (isInvalidSessionStateError(e)) {
        const backendStatus = (e as HomeworkApiError).backendStatus;
        if (backendStatus) {
          applyStatusToState({ status: backendStatus } as HomeworkSessionStatus);
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
          setError(e instanceof Error ? e.message : "Failed to submit");
          toast.error(e instanceof Error ? e.message : "Failed to submit");
        }
      } else {
        const isValidationError =
          e instanceof Error && "code" in e && (e as HomeworkApiError).code === "VALIDATION_ERROR";
        const rawMsg = isValidationError ? METRIC_ANSWERS_VALIDATION_MSG : (e instanceof Error ? e.message : "Failed to submit");
        const displayMsg = (typeof rawMsg === "string" && rawMsg.trim()) ? rawMsg : "Failed to save answers. Please try again or refresh.";
        setError(displayMsg);
        toast.error(displayMsg);
      }
    } finally {
      setLoading(false);
      metricSubmitInProgress.current = false;
    }
  };

  const RECORDING_2_DURATION_MIN = 62;
  const RECORDING_2_DURATION_MAX = 300;

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
      if (isInvalidSessionStateError(e)) {
        uiStepFloorRef.current = Math.max(uiStepFloorRef.current, 4);
        if (typeof sessionStorage !== "undefined") sessionStorage.setItem("homeworkJustFinishedRecording2", "1");
        const backendStatus = (e as HomeworkApiError).backendStatus;
        if (backendStatus) {
          applyStatusToState({ status: backendStatus } as HomeworkSessionStatus);
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

  /** Refetch GET status and apply to state (e.g. after "Refresh" when status unknown or warm-up empty). */
  const refreshStatus = async () => {
    if (!sessionId || sessionId === "mock-session") return;
    setLoading(true);
    setError(null);
    setStatusUnknown(false);
    try {
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) applyStatusToState(statusRes);
      else setError("Could not load session. Please try again.");
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
      <StepFlowWrapper step={0}>
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Homework</h3>
          <p className="text-sm text-muted-foreground">
            Complete your warm-up recording, then the metric questions and main recording. You’ll get a report at the end.
          </p>
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={handleStart} disabled={loading}>
                Try again
              </Button>
            </div>
          )}
          <Button onClick={handleStart} disabled={loading} className="w-full sm:w-auto">
            {loading ? "Starting…" : "Start homework"}
          </Button>
        </Card>
      </StepFlowWrapper>
    );
  }

  // Step 1: Warm-up text + recorder — show as soon as session exists (from POST start response)
  if (step === 1) {
    const isUploadingRec1 = uploadingRecording === 1;
    if (isUploadingRec1) {
      return (
        <StepFlowWrapper step={1}>
          <Card className="p-6">
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
      <StepFlowWrapper step={1}>
        {sessionId === "mock-session" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Preview mode — backend not connected. Recording will not be saved until you implement <code className="text-xs">POST /v2/homework/start</code>.
          </div>
        )}
        {showStatusUnknownBlock && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
            <p>{error ?? "Session status could not be determined. Please refresh."}</p>
            <Button variant="outline" size="sm" onClick={refreshStatus} disabled={loading}>
              Refresh
            </Button>
          </div>
        )}
        {showWarmUpUnavailableBlock && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
            <p>Warm-up prompt unavailable. Please refresh.</p>
            <Button variant="outline" size="sm" onClick={refreshStatus} disabled={loading}>
              Refresh
            </Button>
          </div>
        )}
        {!showStatusUnknownBlock && !showWarmUpUnavailableBlock && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">Warm-up task</p>
            <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
              {warmUpText.trim() || "—"}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          <AudioRecorder
            onRecordingComplete={handleRecording1Complete}
            stopAndSend
            uploading={isUploadingRec1}
          />
        </div>
        {sessionId && sessionId !== "mock-session" && (
          <div className="mt-3 flex justify-center">
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
      <StepFlowWrapper step={step}>
        <AnswerMetricQuestionsScreen
          sessionId={sessionId!}
          taskBlock={taskBlock}
          onSubmit={handleMetricAnswersSubmit}
          loading={loading}
          error={error}
        />
      </StepFlowWrapper>
    );
  }

  // Step 3: Final task + record
  if (step === 3) {
    const isUploadingRec2 = uploadingRecording === 2;
    if (isUploadingRec2) {
      return (
        <StepFlowWrapper step={step}>
          <Card className="p-6">
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
      <StepFlowWrapper step={step}>
        {/* Final task: only API value (response.final_task or final_task_text); no hardcoded fallback */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Final task</p>
          <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
            {finalTaskText || "—"}
          </p>
        </div>
        <AudioRecorder
          onRecordingComplete={handleRecording2Complete}
          stopAndSend
          uploading={isUploadingRec2}
          minDurationSeconds={RECORDING_2_DURATION_MIN}
        />
        <div className="mt-3 flex justify-center">
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
      <StepFlowWrapper step={step}>
        <PostQuestionsStepScreen
          questions={questions}
          onSubmit={handlePostAnswersSubmit}
          loading={loading}
          error={error}
        />
      </StepFlowWrapper>
    );
  }

  // Step 5: Report (content from backend; backend should include analysis of both recording 1 and 2)
  if (step === 5) {
    return (
      <StepFlowWrapper step={step}>
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Your report</h3>
          {performanceScoreEnd != null && (
            <p className="text-sm text-muted-foreground">
              Overall score: {Math.round(performanceScoreEnd * 100)}%
            </p>
          )}
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
              {reportText.trim() || "Report pending."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleBackToDashboard}>
              Back to dashboard
            </Button>
            <Button variant="outline" onClick={handleStartOver}>
              Start new homework
            </Button>
          </div>
        </Card>
      </StepFlowWrapper>
    );
  }

  return null;
}
