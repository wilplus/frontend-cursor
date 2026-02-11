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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressStepBullets } from "@/components/ui/progress-step-bullets";
import AudioRecorder from "@/components/recording/AudioRecorder";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

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
  const status = statusRaw.toLowerCase().trim();

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

  if (status === "warm_up") return { step: 1, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "task_block") return { step: 2, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "final_task_ready") return { step: 3, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "post_questions") return { step: 4, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null, statusUnknown: false };
  if (status === "completed") return { step: 5, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd, statusUnknown: false };

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

// One auto-start per page load (avoids double request in React Strict Mode)
let autoStartAttempted = false;

function isNoWarmupError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "NO_WARMUP_CONFIGURED";
}

function isInvalidSessionStateError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "INVALID_SESSION_STATE";
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

  /** Single source of truth: apply GET session/status response to all step-dependent state. Used on load and after every step-advancing success. No session-scoped API calls without a valid sessionId. */
  const applyStatusToState = (statusRes: HomeworkSessionStatus) => {
    const sessionIdFromRes =
      statusRes.session_id ?? statusRes.session?.id ?? null;
    setSessionId(sessionIdFromRes);
    const derived = deriveStepFromStatus(statusRes);
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
    setStep(derived.step);
    setStatusUnknown(derived.statusUnknown);
    setError(derived.statusUnknown ? "Session status could not be determined. Please refresh." : null);
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setStatusUnknown(false);
    try {
      await homeworkApi.start();
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) applyStatusToState(statusRes);
      else {
        setSessionId(null);
        setStep(0);
        setError("Could not load session. Please try again.");
      }
    } catch (e) {
      if (isNoWarmupError(e)) {
        setNoWarmupConfigured(true);
        setError(null);
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

  /** Clear state and start a new session (new session_id from backend). */
  const handleStartOver = () => {
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
    setLoading(true);
    homeworkApi
      .start()
      .then(async () => {
        const statusRes = await homeworkApi.getStatus();
        if (statusRes) applyStatusToState(statusRes);
        else {
          setSessionId(null);
          setStep(0);
          setError("Could not load session. Please try again.");
        }
      })
      .catch((e) => {
        if (isNoWarmupError(e)) {
          setNoWarmupConfigured(true);
          setError(null);
        } else {
          const msg = e instanceof Error ? e.message : "Failed to start";
          setError(msg);
          toast.error(msg);
        }
      })
      .finally(() => setLoading(false));
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
          return handleStart();
        }
        if (statusRes) applyStatusToState(statusRes);
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

  // On step 4, if questions are missing (thin status or refresh), load from GET questions
  useEffect(() => {
    if (step !== 4 || !sessionId || sessionId === "mock-session" || questions.length > 0) return;
    let cancelled = false;
    homeworkApi
      .getQuestions(sessionId)
      .then(({ questions: qList }) => {
        if (!cancelled && qList.length > 0) {
          const normalized = qList.map((q) => ({
            ...q,
            id: toId(q.id) || crypto.randomUUID(),
            text: toText(q.text),
          }));
          setQuestions(normalized.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
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
    if (!sessionId) return;
    if (sessionId === "mock-session") {
      setError(
        "Recording captured (preview only). Implement POST /v2/homework/start and POST /v2/homework/session/:id/recording-1 on your backend to save and continue."
      );
      return;
    }
    if (uploadingRecording === 1) return;
    setUploadingRecording(1);
    setError(null);
    abortRef.current = new AbortController();
    try {
      await homeworkApi.uploadRecording1(sessionId, blob, durationSeconds, abortRef.current.signal);
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) applyStatusToState(statusRes);
    } catch (e) {
      if (isInvalidSessionStateError(e)) {
        try {
          const statusRes = await homeworkApi.getStatus();
          if (statusRes) applyStatusToState(statusRes);
        } catch {
          setError(e instanceof Error ? e.message : "Upload failed");
          toast.error(e instanceof Error ? e.message : "Upload failed");
        }
      } else {
        setError(e instanceof Error ? e.message : "Upload failed");
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    } finally {
      setUploadingRecording(null);
      abortRef.current = null;
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
    try {
      await homeworkApi.submitMetricAnswers(sessionId, {
        metric_answer_1: a1,
        metric_answer_2: a2,
        metric_answer_3: a3,
      });
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) applyStatusToState(statusRes);
    } catch (e) {
      const isValidationError =
        e instanceof Error && "code" in e && (e as HomeworkApiError).code === "VALIDATION_ERROR";
      setError(isValidationError ? METRIC_ANSWERS_VALIDATION_MSG : (e instanceof Error ? e.message : "Failed to submit"));
      toast.error(isValidationError ? METRIC_ANSWERS_VALIDATION_MSG : (e instanceof Error ? e.message : "Failed to submit"));
    } finally {
      setLoading(false);
      metricSubmitInProgress.current = false;
    }
  };

  const RECORDING_2_DURATION_MIN = 60;
  const RECORDING_2_DURATION_MAX = 300;

  const handleRecording2Complete = async (blob: Blob, durationSeconds: number) => {
    if (!sessionId) return;
    if (durationSeconds < RECORDING_2_DURATION_MIN || durationSeconds > RECORDING_2_DURATION_MAX) {
      const msg = `Final recording must be between ${RECORDING_2_DURATION_MIN / 60} and ${RECORDING_2_DURATION_MAX / 60} minutes.`;
      setError(msg);
      toast.error(msg);
      return;
    }
    if (uploadingRecording === 2) return;
    setUploadingRecording(2);
    setError(null);
    abortRef.current = new AbortController();
    try {
      await homeworkApi.uploadRecording2(sessionId, blob, durationSeconds, abortRef.current.signal);
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) applyStatusToState(statusRes);
    } catch (e) {
      if (isInvalidSessionStateError(e)) {
        try {
          const statusRes = await homeworkApi.getStatus();
          if (statusRes) applyStatusToState(statusRes);
        } catch {
          setError(e instanceof Error ? e.message : "Upload failed");
          toast.error(e instanceof Error ? e.message : "Upload failed");
        }
      } else {
        setError(e instanceof Error ? e.message : "Upload failed");
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    } finally {
      setUploadingRecording(null);
      abortRef.current = null;
    }
  };

  const handlePostAnswersSubmit = async () => {
    if (!sessionId) return;
    if (postAnswersSubmitInProgress.current) return;
    const missing = questions.filter((q) => !(postAnswers[toId(q.id)] ?? "").trim());
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
        answer_text: (postAnswers[toId(q.id)] ?? "").trim(),
      }));
      await homeworkApi.submitPostAnswers(sessionId, answers);
      const statusRes = await homeworkApi.getStatus();
      if (statusRes) applyStatusToState(statusRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      toast.error(e instanceof Error ? e.message : "Failed to submit");
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

  const flowStepIndex = step >= 1 ? step - 1 : 0;
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-4 animate-fade-in">
      <ProgressStepBullets
        total={TOTAL_STEPS}
        currentIndex={flowStepIndex}
        aria-label={step >= 1 ? `Step ${step} of ${TOTAL_STEPS}` : `Step 1 of ${TOTAL_STEPS}`}
      />
      {children}
    </div>
  );

  // Step 1 (or loading): Warm-up text + recorder — show as soon as user is logged in
  if (step === 0 || step === 1) {
    if (uploadingRecording === 1) {
      return (
        <Wrapper>
          <Card className="p-6">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <h3 className="text-lg font-semibold">Sending first recording</h3>
              <p className="text-sm text-muted-foreground">Please wait…</p>
            </div>
          </Card>
        </Wrapper>
      );
    }
    const showRecorder = !!sessionId;
    const warmUpEmpty = step === 1 && sessionId && !warmUpText.trim();
    const showStatusUnknownBlock = step === 1 && statusUnknown;
    const showWarmUpUnavailableBlock = step === 1 && warmUpEmpty && !statusUnknown;
    const warmUpDisplayText = sessionId
      ? warmUpText.trim()
      : error
        ? "Tap Try again above to load your task."
        : "Loading your warm-up task…";

    return (
      <Wrapper>
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
        {step === 0 && error && !showStatusUnknownBlock && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={handleStart} disabled={loading}>
              Try again
            </Button>
          </div>
        )}
        {!showStatusUnknownBlock && !showWarmUpUnavailableBlock && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Warm-up task</p>
          <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
            {!sessionId && loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {warmUpDisplayText || "—"}
              </span>
            ) : (
              warmUpDisplayText || "—"
            )}
          </p>
        </div>
        )}
        {showRecorder && (
          <div className="flex flex-col gap-3">
            <AudioRecorder
              onRecordingComplete={handleRecording1Complete}
              stopAndSend
            />
          </div>
        )}
        {!showRecorder && (
          <Card className="p-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Preparing recorder…
          </Card>
        )}
      </Wrapper>
    );
  }

  // Step 2: 3 metric questions only (context_short is used by backend for the task, not shown here)
  if (step === 2) {
    return (
      <Wrapper>
        <AnswerMetricQuestionsScreen
          sessionId={sessionId!}
          taskBlock={taskBlock}
          onSubmit={handleMetricAnswersSubmit}
          loading={loading}
          error={error}
        />
      </Wrapper>
    );
  }

  // Step 3: Final task + record
  if (step === 3) {
    if (uploadingRecording === 2) {
      return (
        <Wrapper>
          <Card className="p-6">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <h3 className="text-lg font-semibold">Sending second recording</h3>
              <p className="text-sm text-muted-foreground">Please wait…</p>
            </div>
          </Card>
        </Wrapper>
      );
    }
    return (
      <Wrapper>
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
        />
        <div className="mt-3 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleStartOver}
          >
            Abandon session
          </Button>
        </div>
      </Wrapper>
    );
  }

  // Step 4: Reflective questions (0 or N — if GET questions returned [], we skip to step 5). Enforce answer all before submit.
  if (step === 4) {
    return (
      <Wrapper>
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Reflective questions</h3>
          <div className="space-y-4">
            {questions.map((q) => {
              const qId = toId(q.id);
              return (
                <div key={qId}>
                  <label className="block text-sm font-medium mb-1">{toText(q.text)}</label>
                  <textarea
                    className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={postAnswers[qId] ?? ""}
                    onChange={(e) => setPostAnswers((prev) => ({ ...prev, [qId]: e.target.value }))}
                    placeholder="Your answer…"
                  />
                </div>
              );
            })}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={handlePostAnswersSubmit}
            disabled={loading || !allPostQuestionsAnswered}
          >
            {loading ? "Submitting…" : "See my report"}
          </Button>
          {!allPostQuestionsAnswered && questions.length > 0 && (
            <p className="text-sm text-muted-foreground">Answer all questions above to continue.</p>
          )}
        </Card>
      </Wrapper>
    );
  }

  // Step 5: Report (content from backend; backend should include analysis of both recording 1 and 2)
  if (step === 5) {
    return (
      <Wrapper>
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
            <Button variant="outline" onClick={handleStartOver}>
              Start new homework
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </Card>
      </Wrapper>
    );
  }

  return null;
}
