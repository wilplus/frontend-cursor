"use client";

import { useEffect, useRef } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { FlowBackLink } from "@/components/ui/flow-back-button";
import { ProgressStepBullets } from "@/components/ui/progress-step-bullets";
import { Card } from "@/components/ui/card";
import AudioRecorder from "@/components/recording/AudioRecorder";
import PreRecordingQuestionnaire from "@/components/session/PreRecordingQuestionnaire";
import PreQuestionsForm from "@/components/session/PreQuestionsForm";
import PostQuestionsForm from "@/components/session/PostQuestionsForm";
import PostQuestionsFormV2 from "@/components/session/PostQuestionsFormV2";
import CompletedCard from "@/components/session/CompletedCard";
import { toast } from "sonner";
import { Play, RefreshCw } from "lucide-react";

const FLOW_STEPS = 3; // 1 Pre questions, 2 Command & recording, 3 Post questions

function getFlowStepIndex(state: string): number {
  if (state === "pre_questionnaire") return 0;
  if (["command_select", "recording_ready", "recording", "recorded", "uploading_processing"].includes(state)) return 1;
  if (["post_questions", "finalizing", "completed"].includes(state)) return 2;
  return 0;
}

export default function SessionCard() {
  const {
    state,
    sessionId,
    preQuestions,
    preAnswersSubmitted,
    commandOptions,
    selectedCommandOptionId,
    selectedPromptTextSnapshot,
    durationSeconds,
    initialize,
    startNewSession,
    selectCommandOption,
    goBackToPreQuestions,
    goBackToCommandSelect,
    setRecordingReady,
    setRecordingStart,
    uploadRecordingBlob,
    abandonCurrentSession,
    loading,
    error,
    postQuestions,
    postAnswers,
    postAnswersSubmitted,
    completedRecording,
  } = useSessionStore();

  const authReady = useAuthReady();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Wait for Supabase session before calling API (avoids race where getAuthFetchOptions runs before session is restored)
  useEffect(() => {
    if (authReady) initialize();
  }, [authReady, initialize]);

  // Handle abort on navigation/unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-select command when in command_select (command chosen by system; skip command select UI)
  useEffect(() => {
    if (state !== "command_select" || !commandOptions?.length) return;
    const primary = commandOptions.find((o) => o.is_primary) ?? commandOptions[0];
    const promptText = (primary.prompt_text_snapshot ?? "").trim() || (primary.intent ?? "");
    selectCommandOption(primary.option_id, promptText);
  }, [state, commandOptions, selectCommandOption]);

  const handleStartSession = async () => {
    await startNewSession();
  };

  const handleRecordingComplete = async (blob: Blob, durationSeconds: number) => {
    // Store the blob and duration in Zustand first
    const store = useSessionStore.getState();
    store.setRecordingEnd(Date.now(), blob);

    // Then upload
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await uploadRecordingBlob(controller);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        toast.info("Upload cancelled");
      } else {
        toast.error("Upload failed");
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Render based on state
  if (state === "idle") {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">Start a New Session</h3>
          <p className="text-sm text-muted-foreground">
            Record a practice interview session and get personalized feedback.
          </p>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-left">
              <p className="font-medium">Error starting session:</p>
              <p>{error}</p>
              {error.includes("500") && (
                <p className="mt-2 text-xs">
                  This is a backend error. Check your Flask backend logs.
                </p>
              )}
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
          {loading && (
            <p className="text-xs text-muted-foreground">
              This may take a moment. If it takes longer than 30 seconds, check your backend.
            </p>
          )}
        </div>
      </Card>
    );
  }

  // Flow steps: 1 Pre questions, 2 Command & recording, 3 Post questions
  const flowStepIndex = getFlowStepIndex(state);
  const FlowWrapper = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-4">
      <ProgressStepBullets
        total={FLOW_STEPS}
        currentIndex={flowStepIndex}
        aria-label={`Step ${flowStepIndex + 1} of ${FLOW_STEPS}`}
      />
      <p className="text-muted-foreground text-sm text-center mb-4">
        {flowStepIndex === 0 && "Pre questions"}
        {flowStepIndex === 1 && "Command & recording"}
        {flowStepIndex === 2 && "Post questions"}
      </p>
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

  // command_select: command chosen by system; auto-select runs in useEffect, show brief loading
  if (state === "command_select") {
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
    return (
      <FlowWrapper>
        <div className="space-y-4">
          {promptText && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Your Command:</p>
              <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                &ldquo;{promptText}&rdquo;
              </p>
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
                <p className="text-sm font-medium text-muted-foreground mb-1">Your Command:</p>
                <p className="text-base font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                  &ldquo;{promptText}&rdquo;
                </p>
              </div>
            )}
            <Card className="p-6 space-y-4">
              <div className="text-center">
                <div className="text-4xl font-mono font-bold text-foreground">
                  {formatTime(recordedSec)}
                </div>
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
                  <Button
                    type="button"
                    onClick={() => setRecordingReady()}
                    className="rounded-lg bg-primary hover:bg-primary/90"
                  >
                    <Play className="mr-2 h-4 w-4" aria-hidden />
                    Resume
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => abandonCurrentSession()}
                    className="rounded-lg border-primary/30 bg-background hover:bg-muted"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                    Start Over
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
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-left">
                    <p className="font-medium">Error:</p>
                    <p className="text-xs mt-1 break-words">{error}</p>
                    {error.includes("502") || error.includes("not responding") ? (
                      <div className="mt-2 text-xs">
                        <p className="font-medium">Backend Connection Issue:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Is your Flask backend running?</li>
                          <li>Is NEXT_PUBLIC_API_URL set correctly in your .env file?</li>
                          <li>Can you reach the backend URL directly in your browser?</li>
                          <li>Check your backend logs for errors</li>
                        </ul>
                      </div>
                    ) : error.includes("500") ? (
                      <div className="mt-2 text-xs">
                        <p>This is a backend error. Common causes:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Missing column in recordings table</li>
                          <li>Database constraint violation</li>
                          <li>File size too large</li>
                        </ul>
                        <p className="mt-2">Check your Flask backend logs for the exact error.</p>
                      </div>
                    ) : null}
                  </div>
                  <Button
                    onClick={() => {
                      const controller = new AbortController();
                      abortControllerRef.current = controller;
                      uploadRecordingBlob(controller).finally(() => {
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
          <p className="text-sm text-muted-foreground">
            Please wait while we process your recording...
          </p>
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded-md text-left">
              <p className="font-medium">Upload Error:</p>
              <p className="text-xs mt-1 break-words">{error}</p>
              {error.includes("500") && (
                <p className="text-xs mt-2">
                  This is a backend error. Check your Flask backend logs and Supabase database schema.
                </p>
              )}
            </div>
          )}
        </div>
      </Card>
      </FlowWrapper>
    );
  }

  if (state === "post_questions") {
    return (
      <FlowWrapper>
        <div className="space-y-4">
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
          <p className="text-sm text-muted-foreground">
            Processing your answers...
          </p>
        </div>
      </Card>
      </FlowWrapper>
    );
  }

  if (state === "completed" && completedRecording) {
    return (
      <FlowWrapper>
        <div className="space-y-4">
          <CompletedCard recording={completedRecording} />
        </div>
      </FlowWrapper>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">{error}</p>
          {(error.includes("502") || error.includes("not responding")) && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 rounded-md text-left text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Backend Connection Issue
              </p>
              <ul className="list-disc list-inside space-y-1 text-yellow-700 dark:text-yellow-300">
                <li>Check if your Flask backend is running</li>
                <li>Verify NEXT_PUBLIC_API_URL in your .env file</li>
                <li>Test the backend URL directly in your browser</li>
                <li>Check backend logs for startup errors</li>
              </ul>
            </div>
          )}
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
