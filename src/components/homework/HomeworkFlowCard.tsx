"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { homeworkApi } from "@/lib/api/homework-client";
import type { HomeworkQuestion } from "@/lib/api/types-homework";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressStepBullets } from "@/components/ui/progress-step-bullets";
import AudioRecorder from "@/components/recording/AudioRecorder";
import { toast } from "sonner";

const TOTAL_STEPS = 5;

type Step = 1 | 2 | 3 | 4 | 5;

export default function HomeworkFlowCard() {
  const authReady = useAuthReady();
  const [step, setStep] = useState<Step | 0>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [warmUpText, setWarmUpText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [finalTaskText, setFinalTaskText] = useState("");
  const [metricAnswer1, setMetricAnswer1] = useState("");
  const [metricAnswer2, setMetricAnswer2] = useState("");
  const [questions, setQuestions] = useState<HomeworkQuestion[]>([]);
  const [postAnswers, setPostAnswers] = useState<Record<string, string>>({});
  const [reportText, setReportText] = useState("");
  const [performanceScoreEnd, setPerformanceScoreEnd] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingRecording, setUploadingRecording] = useState<1 | 2 | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasAutoStarted = useRef(false);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await homeworkApi.start();
      setSessionId(res.session_id);
      setWarmUpText(res.warm_up_task_text || "Your warm-up task will appear here.");
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start homework");
      toast.error(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setLoading(false);
    }
  };

  // Show recording step right away: auto-start when auth is ready
  useEffect(() => {
    if (!authReady || step !== 0 || hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    handleStart();
  }, [authReady, step]);

  const buildFormData = (blob: Blob, durationSeconds: number): FormData => {
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append("duration_seconds", String(durationSeconds));
    return formData;
  };

  const handleRecording1Complete = async (blob: Blob, durationSeconds: number) => {
    if (!sessionId) return;
    setUploadingRecording(1);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const formData = buildFormData(blob, durationSeconds);
      const res = await homeworkApi.uploadRecording1(sessionId, formData, abortRef.current.signal);
      setTaskText(res.task_text || "");
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingRecording(null);
      abortRef.current = null;
    }
  };

  const handleMetricAnswersSubmit = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await homeworkApi.submitMetricAnswers(sessionId, {
        metric_answer_1: metricAnswer1.trim(),
        metric_answer_2: metricAnswer2.trim(),
      });
      setFinalTaskText(res.final_task_text || "");
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setLoading(false);
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
        setReportText(reportRes.report_text);
        setPerformanceScoreEnd(reportRes.performance_score_end);
        setStep(5);
      } else {
        setQuestions(qList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
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
    setLoading(true);
    setError(null);
    try {
      const answers = questions.map((q) => ({
        question_id: q.id,
        answer_text: (postAnswers[q.id] ?? "").trim(),
      }));
      const res = await homeworkApi.submitPostAnswers(sessionId, answers);
      setReportText(res.report_text);
      setPerformanceScoreEnd(res.performance_score_end);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      toast.error(e instanceof Error ? e.message : "Failed to submit");
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

  // Idle: start button
  if (step === 0) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold">Homework</h2>
          <p className="text-sm text-muted-foreground">
            Complete your warm-up, then two practice recordings. You’ll get a personalized report at the end.
          </p>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-left">
              {error}
            </div>
          )}
          <Button onClick={handleStart} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Starting…
              </span>
            ) : (
              "Start homework"
            )}
          </Button>
        </div>
      </Card>
    );
  }

  const flowStepIndex = step - 1;
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-4 animate-fade-in">
      <ProgressStepBullets
        total={TOTAL_STEPS}
        currentIndex={flowStepIndex}
        aria-label={`Step ${step} of ${TOTAL_STEPS}`}
      />
      {children}
    </div>
  );

  // Step 1: Warm-up text + record
  if (step === 1) {
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
    return (
      <Wrapper>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Warm-up task</p>
          <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
            {warmUpText}
          </p>
        </div>
        <AudioRecorder
          onRecordingComplete={handleRecording1Complete}
          stopAndSend
        />
      </Wrapper>
    );
  }

  // Step 2: Task text + metric answers
  if (step === 2) {
    return (
      <Wrapper>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground mb-2">Your task (after first recording)</p>
          <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">{taskText}</p>
        </div>
        <Card className="p-6 space-y-4">
          <p className="text-sm font-medium">Answer these two questions:</p>
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Metric question 1
            </label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Your answer…"
              value={metricAnswer1}
              onChange={(e) => setMetricAnswer1(e.target.value)}
            />
            <label className="block text-sm font-medium">
              Metric question 2
            </label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Your answer…"
              value={metricAnswer2}
              onChange={(e) => setMetricAnswer2(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleMetricAnswersSubmit} disabled={loading}>
            {loading ? "Submitting…" : "Continue"}
          </Button>
        </Card>
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
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-1">Final task</p>
          <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
            {finalTaskText}
          </p>
        </div>
        <AudioRecorder
          onRecordingComplete={handleRecording2Complete}
          stopAndSend
        />
      </Wrapper>
    );
  }

  // Step 4: Questions
  if (step === 4) {
    return (
      <Wrapper>
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">A few questions</h3>
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium mb-1">{q.text}</label>
                <textarea
                  className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={postAnswers[q.id] ?? ""}
                  onChange={(e) => setPostAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Your answer…"
                />
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handlePostAnswersSubmit} disabled={loading}>
            {loading ? "Submitting…" : "See my report"}
          </Button>
        </Card>
      </Wrapper>
    );
  }

  // Step 5: Report
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
          <Button asChild variant="outline">
            <a href="/dashboard">Back to dashboard</a>
          </Button>
        </Card>
      </Wrapper>
    );
  }

  return null;
}
