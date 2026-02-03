"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useSessionStore } from "@/store/session-store";
import { v2Api } from "@/lib/api/client-v2";
import type { ExerciseV2 } from "@/lib/api/types-v2";
import { Button } from "@/components/ui/button";
import { ProgressStepBullets } from "@/components/ui/progress-step-bullets";
import { Card } from "@/components/ui/card";
import AudioRecorder from "@/components/recording/AudioRecorder";
import PreRecordingQuestionnaire from "@/components/session/PreRecordingQuestionnaire";
import PreQuestionsForm from "@/components/session/PreQuestionsForm";
import PostQuestionsFormV2 from "@/components/session/PostQuestionsFormV2";
import CompletedCard from "@/components/session/CompletedCard";
import { Play, RefreshCw } from "lucide-react";

const FLOW_STEPS = 3;

function getFlowStepIndex(state: string): number {
  if (state === "pre_questionnaire") return 0;
  if (["command_select", "recording_ready", "recording", "recorded", "uploading_processing"].includes(state)) return 1;
  if (["post_questions", "finalizing", "completed"].includes(state)) return 2;
  return 0;
}

/** V2: Same flow as v1 (SessionCard), plus task_score submission (mood, readiness, mode_preference) to v2 API when questionnaire is submitted. */
export default function SessionCardV2() {
  const {
    state,
    sessionId,
    questionnaire,
    preQuestions,
    commandOptions,
    selectedCommandOptionId,
    selectedPromptTextSnapshot,
    durationSeconds,
    initialize,
    startNewSession,
    selectCommandOption,
    selectDifferentCommand,
    setRecordingReady,
    setRecordingStart,
    setRecordingEnd,
    transitionToPostQuestionsWithDefaults,
    uploadRecordingBlob,
    abandonCurrentSession,
    loading,
    error,
    postQuestions,
    postAnswers,
    postAnswersSubmitted,
    completedRecording,
    recordingId,
  } = useSessionStore();

  const authReady = useAuthReady();
  const abortControllerRef = useRef<AbortController | null>(null);
  const taskScoreSentForSessionRef = useRef<string | null>(null);
  const [exerciseFromPlan, setExerciseFromPlan] = useState<ExerciseV2 | null>(null);
  const [exerciseFeedbackDone, setExerciseFeedbackDone] = useState(false);
  const [exerciseLoading, setExerciseLoading] = useState(false);

  useEffect(() => {
    if (authReady) initialize();
  }, [authReady, initialize]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Reset exercise state when leaving command_select or starting new session
  useEffect(() => {
    if (state === "idle" || (state !== "command_select" && exerciseFromPlan != null)) {
      setExerciseFromPlan(null);
      setExerciseFeedbackDone(false);
    }
  }, [state, exerciseFromPlan]);

  // When questionnaire is submitted (state command_select), send task_score to v2 API and get plan (exercise optional)
  useEffect(() => {
    if (state !== "command_select" || !sessionId || !questionnaire) return;
    if (taskScoreSentForSessionRef.current === sessionId) return;
    taskScoreSentForSessionRef.current = sessionId;
    const mood = questionnaire.mood === "positive" ? 1 : 0;
    const readiness = Math.min(10, Math.max(1, Math.round(questionnaire.readiness)));
    const mode_preference = questionnaire.inspiration_needed ? 0 : 1;
    v2Api
      .submitUniversalAnswers(sessionId, { mood, readiness, mode_preference })
      .then((res) => {
        setExerciseFromPlan(res.plan.exercise ?? null);
      })
      .catch(() => {
        taskScoreSentForSessionRef.current = null;
      });
  }, [state, sessionId, questionnaire]);

  // Auto-select command only after exercise step is done (or when there is no exercise)
  useEffect(() => {
    if (state !== "command_select" || !commandOptions?.length) return;
    if (exerciseFromPlan != null && !exerciseFeedbackDone) return;
    const primary = commandOptions.find((o) => o.is_primary) ?? commandOptions[0];
    const promptText = (primary.prompt_text_snapshot ?? "").trim() || (primary.intent ?? "");
    selectCommandOption(primary.option_id, promptText);
  }, [state, commandOptions, selectCommandOption, exerciseFromPlan, exerciseFeedbackDone]);

  const handleStartSession = async () => {
    await startNewSession();
  };

  const handleRecordingComplete = (blob: Blob, _durationSeconds: number) => {
    const store = useSessionStore.getState();
    store.setRecordingEnd(Date.now(), blob);
    store.transitionToPostQuestionsWithDefaults();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    store.uploadRecordingBlob(controller, { background: true }).finally(() => {
      abortControllerRef.current = null;
    });
  };

  if (state === "idle") {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">Start a New Session (v2)</h3>
          <p className="text-sm text-muted-foreground">
            Record a practice interview session and get personalized feedback. Same flow as v1; task_score is calculated from your check-in.
          </p>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-left">
              <p className="font-medium">Error starting session:</p>
              <p>{error}</p>
            </div>
          )}
          <Button onClick={handleStartSession} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Starting...
              </span>
            ) : (
              "Record New Session"
            )}
          </Button>
        </div>
      </Card>
    );
  }

  const flowStepIndex = getFlowStepIndex(state);
  const FlowWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-4">
      <ProgressStepBullets
        total={FLOW_STEPS}
        currentIndex={flowStepIndex}
        aria-label={`Step ${flowStepIndex + 1} of ${FLOW_STEPS}`}
      />
      {children}
    </div>
  );

  if (state === "pre_questionnaire") {
    return (
      <FlowWrapper>
        <PreRecordingQuestionnaire />
      </FlowWrapper>
    );
  }

  if (state === "pre_questions") {
    return (
      <FlowWrapper>
        <PreQuestionsForm questions={preQuestions} />
      </FlowWrapper>
    );
  }

  if (state === "command_select") {
    const showExercise = exerciseFromPlan != null && !exerciseFeedbackDone;
    if (showExercise && exerciseFromPlan) {
      const ex = exerciseFromPlan;
      return (
        <FlowWrapper>
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold">{ex.title}</h3>
            {ex.description && (
              <p className="text-sm text-muted-foreground">{ex.description}</p>
            )}
            {ex.video_url && (
              <a
                href={ex.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex text-sm text-primary underline hover:no-underline"
              >
                Watch video
              </a>
            )}
            <p className="text-sm font-medium text-foreground">Did you find this exercise helpful?</p>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (!sessionId) return;
                  setExerciseLoading(true);
                  try {
                    await v2Api.submitExerciseFeedback(sessionId, { exercise_liked: true });
                    setExerciseFeedbackDone(true);
                  } finally {
                    setExerciseLoading(false);
                  }
                }}
                disabled={exerciseLoading}
              >
                Yes, liked it
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!sessionId) return;
                  setExerciseLoading(true);
                  try {
                    await v2Api.submitExerciseFeedback(sessionId, { exercise_liked: false });
                    setExerciseFeedbackDone(true);
                  } finally {
                    setExerciseLoading(false);
                  }
                }}
                disabled={exerciseLoading}
              >
                Skip / not really
              </Button>
            </div>
          </Card>
        </FlowWrapper>
      );
    }
    return (
      <FlowWrapper>
        <Card className="p-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-4" />
            <p className="text-muted-foreground">Preparing your recording...</p>
          </div>
        </Card>
      </FlowWrapper>
    );
  }

  if (state === "recording_ready" || state === "recording") {
    const promptText = selectedPromptTextSnapshot ?? preQuestions[0]?.question_text ?? null;
    const canGetDifferentTask = state === "recording_ready" && commandOptions && commandOptions.length > 1;
    return (
      <FlowWrapper>
        <div className="space-y-4">
          {promptText && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-1">Your task:</p>
                <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                  &ldquo;{promptText}&rdquo;
                </p>
              </div>
              {canGetDifferentTask && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectDifferentCommand()}
                  className="shrink-0 border-primary/50 text-primary hover:bg-primary/10"
                >
                  Get a different task
                </Button>
              )}
            </div>
          )}
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onRecordingStart={state === "recording_ready" ? () => setRecordingStart(Date.now()) : undefined}
            stopAndSend
          />
        </div>
      </FlowWrapper>
    );
  }

  if (state === "recorded") {
    const tooShort = durationSeconds !== null && durationSeconds < 60;
    const formatTime = (s: number) =>
      `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    const MIN_DURATION_SECONDS = 60;
    const recordedSec = durationSeconds ?? 0;
    const remainingSec = Math.max(0, MIN_DURATION_SECONDS - recordedSec);
    const progressPercent = Math.min(100, (recordedSec / MIN_DURATION_SECONDS) * 100);
    const promptText = selectedPromptTextSnapshot ?? preQuestions[0]?.question_text ?? null;

    if (tooShort) {
      return (
        <FlowWrapper>
          <div className="space-y-4">
            {promptText && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium text-muted-foreground mb-1">Your task:</p>
                <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                  &ldquo;{promptText}&rdquo;
                </p>
              </div>
            )}
            <Card className="p-6 space-y-4">
              <div className="text-center">
                <div className="text-4xl font-mono font-bold text-foreground">{formatTime(recordedSec)}</div>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatTime(remainingSec)} remaining to reach minimum
                </p>
              </div>
              <div
                className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
                role="alert"
              >
                <p className="font-semibold text-foreground">Recording stopped before 1 minute</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You need at least 1 minute of recording. Resume to continue or start over.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button type="button" onClick={() => setRecordingReady()} className="rounded-lg bg-primary hover:bg-primary/90">
                    <Play className="mr-2 h-4 w-4" aria-hidden /> Resume
                  </Button>
                  <Button type="button" variant="outline" onClick={() => abandonCurrentSession()} className="rounded-lg border-primary/30 bg-background hover:bg-muted">
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden /> Start Over
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </FlowWrapper>
      );
    }

    return (
      <FlowWrapper>
        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-center space-y-4">
              {error ? (
                <>
                  <h3 className="text-lg font-semibold">Upload failed</h3>
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    onClick={() => {
                      const controller = new AbortController();
                      abortControllerRef.current = controller;
                      useSessionStore.getState().uploadRecordingBlob(controller).finally(() => {
                        abortControllerRef.current = null;
                      });
                    }}
                    disabled={loading}
                    className="rounded-lg bg-primary text-white hover:bg-primary/90"
                  >
                    {loading ? "Sending…" : "Retry send"}
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold">Sending recording</h3>
                  <div className="flex flex-col items-center justify-center gap-3 py-8" aria-label="Sending">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Please wait…</p>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </FlowWrapper>
    );
  }

  if (state === "uploading_processing") {
    return (
      <FlowWrapper>
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto" />
            <h3 className="text-lg font-semibold">Uploading Recording</h3>
            <p className="text-sm text-muted-foreground">Please wait while we process your recording...</p>
          </div>
        </Card>
      </FlowWrapper>
    );
  }

  if (state === "post_questions") {
    const uploadInProgress = !recordingId && !error;
    return (
      <FlowWrapper>
        <div className="space-y-4">
          {uploadInProgress && (
            <p className="text-center text-xs text-muted-foreground">Uploading recording in background…</p>
          )}
          {error && !recordingId && (
            <Card className="p-4 border-destructive/50 bg-destructive/5">
              <p className="text-sm text-destructive font-medium mb-2">{error}</p>
              <Button
                onClick={() => {
                  const ctrl = new AbortController();
                  abortControllerRef.current = ctrl;
                  useSessionStore.getState().uploadRecordingBlob(ctrl, { background: true }).finally(() => {
                    abortControllerRef.current = null;
                  });
                }}
                disabled={loading}
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/10"
              >
                {loading ? "Retrying…" : "Retry upload"}
              </Button>
            </Card>
          )}
          <PostQuestionsFormV2
            questions={postQuestions}
            submittedAnswers={postAnswersSubmitted ? postAnswers : undefined}
          />
        </div>
      </FlowWrapper>
    );
  }

  if (state === "finalizing") {
    return (
      <FlowWrapper>
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto" />
            <h3 className="text-lg font-semibold">Finalizing Session</h3>
            <p className="text-sm text-muted-foreground">Processing your answers...</p>
          </div>
        </Card>
      </FlowWrapper>
    );
  }

  if (state === "completed" && completedRecording) {
    return (
      <div className="space-y-4">
        <CompletedCard recording={completedRecording} />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">{error}</p>
          <Button onClick={initialize}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="text-center text-muted-foreground">
        <p>Loading session...</p>
      </div>
    </Card>
  );
}
