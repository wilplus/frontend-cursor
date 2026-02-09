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

/** Derive current step and restored state from session status (backend may send status enum or we infer from IDs/payload). */
function deriveStepFromStatus(s: HomeworkSessionStatus): {
  step: Step;
  warmUpText: string;
  taskText: string;
  taskBlock: TaskBlockV2 | null;
  finalTaskText: string;
  questions: HomeworkQuestion[];
  reportText: string;
  performanceScoreEnd: number | null;
} {
  const warmUpText = (s.warm_up_task?.text ?? s.warm_up_task_text ?? "").trim() || "";
  const taskText = s.task_text ?? "";
  const taskBlock = s.task_block ?? null;
  const finalTaskText = s.final_task_text ?? "";
  const reportText = s.report_text ?? "";
  const performanceScoreEnd = s.performance_score_end ?? null;
  const questions = Array.isArray(s.questions) ? s.questions : [];

  const status = (s.status ?? "").toLowerCase();

  if (reportText || performanceScoreEnd != null) {
    return { step: 5, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd };
  }
  if (status === "report_generated") {
    return { step: 5, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd };
  }
  if (questions.length > 0 && s.recording_2_id) {
    return { step: 4, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null };
  }
  if (status === "post_questions_done" || status === "recording2_scored") {
    return { step: 4, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null };
  }
  if (finalTaskText || s.recording_2_id) {
    return { step: 3, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null };
  }
  if (status === "task_generated" || status === "focus_selected") {
    return { step: 3, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null };
  }
  if (s.recording_1_id || taskText || taskBlock) {
    return { step: 2, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null };
  }
  if (status === "warmup_recorded" || status === "warmup_scored") {
    return { step: 2, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null };
  }
  return { step: 1, warmUpText, taskText, taskBlock, finalTaskText, questions, reportText, performanceScoreEnd: null };
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
  const [noFocusTaskAvailable, setNoFocusTaskAvailable] = useState(false);
  const [noWarmupConfigured, setNoWarmupConfigured] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const metricSubmitInProgress = useRef(false);
  const postAnswersSubmitInProgress = useRef(false);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await homeworkApi.start();
      const text =
        res.warm_up_task?.text ??
        res.warm_up_task_text ??
        toText((res as { warm_up_task?: unknown }).warm_up_task) ??
        toText((res as { task_text?: unknown }).task_text) ??
        "";
      setSessionId(res.session_id);
      setWarmUpText(text || "Your warm-up task will appear here.");
      setStep(1);
    } catch (e) {
      if (isNoWarmupError(e)) {
        setNoWarmupConfigured(true);
        setError(null);
        setStep(0);
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to start homework";
      const isBackendUnavailable = msg.includes("not available yet") || msg.includes("404");
      if (isBackendUnavailable) {
        // Show recording step anyway so the UI is visible; backend not implemented yet
        setSessionId("mock-session");
        setWarmUpText(
          "Read the following aloud at a comfortable pace. (Backend not connected — this is a preview.)"
        );
        setStep(1);
        setError(null);
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
    setNoFocusTaskAvailable(false);
    setNoWarmupConfigured(false);
    setLoading(true);
    homeworkApi
      .start()
      .then((res) => {
        const text =
          res.warm_up_task?.text ??
          res.warm_up_task_text ??
          toText((res as { warm_up_task?: unknown }).warm_up_task) ??
          toText((res as { task_text?: unknown }).task_text) ??
          "";
        setSessionId(res.session_id);
        setWarmUpText(text || "Your warm-up task will appear here.");
        setStep(1);
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
        if (statusRes?.session_id) {
          const derived = deriveStepFromStatus(statusRes);
          setSessionId(statusRes.session_id);
          setWarmUpText(derived.warmUpText);
          setTaskText(derived.taskText);
          setTaskBlock(derived.taskBlock);
          setFinalTaskText(derived.finalTaskText);
          setReportText(derived.reportText);
          setPerformanceScoreEnd(derived.performanceScoreEnd);
          const qList = derived.questions.map((q) => ({
            ...q,
            id: toId(q.id) || q.id,
            text: toText(q.text),
          }));
          setQuestions(qList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
          setStep(derived.step);
          setError(null);
        } else {
          return handleStart();
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

  const buildFormData = (blob: Blob, durationSeconds: number): FormData => {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append("duration_seconds", String(durationSeconds));
    return formData;
  };

  const handleRecording1Complete = async (blob: Blob, durationSeconds: number) => {
    if (!sessionId) return;
    if (sessionId === "mock-session") {
      setError(
        "Recording captured (preview only). Implement POST /v2/homework/start and POST /v2/homework/session/:id/recording-1 on your backend to save and continue."
      );
      return;
    }
    setUploadingRecording(1);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const formData = buildFormData(blob, durationSeconds);
      const res = await homeworkApi.uploadRecording1(sessionId, formData, abortRef.current.signal);
      setTaskText(toText(res.task_text));
      const r = res as {
        task_block?: TaskBlockV2;
        metric_question_1?: TaskBlockV2["metric_question_1"];
        metric_question_2?: TaskBlockV2["metric_question_2"];
        metric_question_3?: TaskBlockV2["metric_question_3"];
      };
      const block =
        r.task_block ??
        (r.metric_question_1 != null || r.metric_question_2 != null || r.metric_question_3 != null
          ? {
              metric_question_1: r.metric_question_1,
              metric_question_2: r.metric_question_2,
              metric_question_3: r.metric_question_3,
            }
          : null);
      setTaskBlock(block);
      setNoFocusTaskAvailable(
        block != null && (block.focus_task === null || block.focus_task === undefined)
      );
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      toast.error(e instanceof Error ? e.message : "Upload failed");
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
      const res = await homeworkApi.submitMetricAnswers(sessionId, {
        metric_answer_1: a1,
        metric_answer_2: a2,
        metric_answer_3: a3,
      });
      const finalTask = res.final_task ?? res.final_task_text ?? "";
      setFinalTaskText(toText(finalTask));
      setStep(3);
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

  const handleRecording2Complete = async (blob: Blob, durationSeconds: number) => {
    if (!sessionId) return;
    setUploadingRecording(2);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const formData = buildFormData(blob, durationSeconds);
      await homeworkApi.uploadRecording2(sessionId, formData, abortRef.current.signal);
      const { questions: qList } = await homeworkApi.getQuestions(sessionId);
      if (qList.length === 0) {
        const reportRes = await homeworkApi.submitPostAnswers(sessionId, []);
        setReportText(toText(reportRes.report_text));
        setPerformanceScoreEnd(reportRes.performance_score_end);
        setStep(5);
      } else {
        const normalized = qList.map((q) => ({
          ...q,
          id: toId(q.id) || crypto.randomUUID(),
          text: toText(q.text),
        }));
        setQuestions(normalized.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
        setStep(4);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      toast.error(e instanceof Error ? e.message : "Upload failed");
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
      const res = await homeworkApi.submitPostAnswers(sessionId, answers);
      setReportText(toText(res.report_text));
      setPerformanceScoreEnd(res.performance_score_end);
      setStep(5);
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
    const warmUpDisplayText = sessionId
      ? warmUpText
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
        {step === 0 && error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
            <p>{error}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleStart} disabled={loading}>
                Try again
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">Abandon</Link>
              </Button>
            </div>
          </div>
        )}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Warm-up task</p>
          <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
            {!sessionId && loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {warmUpDisplayText}
              </span>
            ) : (
              warmUpDisplayText
            )}
          </p>
        </div>
        {showRecorder && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleStartOver} disabled={loading}>
                Start over
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">Abandon</Link>
              </Button>
            </div>
            <AudioRecorder
              onRecordingComplete={handleRecording1Complete}
              stopAndSend
              sessionId={sessionId}
              recordingSlot="recording_1"
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

  // Step 2: Task text + 3 metric questions
  if (step === 2) {
    return (
      <Wrapper>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleStartOver} disabled={loading}>
            Start over
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Abandon</Link>
          </Button>
        </div>
        {noFocusTaskAvailable && (
          <div
            className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
            role="alert"
          >
            No focus task available for your current score. You can still answer the questions below and continue, or
            start over. Contact your coach if this persists.
          </div>
        )}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-2">Your task (after first recording)</p>
          <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">{taskText || "—"}</p>
        </div>
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleStartOver} disabled={loading}>
            Start over
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Abandon</Link>
          </Button>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Final task</p>
          <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
            {finalTaskText}
          </p>
        </div>
        <AudioRecorder
          onRecordingComplete={handleRecording2Complete}
          stopAndSend
          sessionId={sessionId}
          recordingSlot="recording_2"
        />
      </Wrapper>
    );
  }

  // Step 4: Reflective questions (0 or N — if GET questions returned [], we skip to step 5). Enforce answer all before submit.
  if (step === 4) {
    return (
      <Wrapper>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleStartOver} disabled={loading}>
            Start over
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Abandon</Link>
          </Button>
        </div>
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
            <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{reportText}</p>
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
