"use client";

import { useEffect, useRef } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AudioRecorder from "@/components/recording/AudioRecorder";
import PreRecordingQuestionnaire from "@/components/session/PreRecordingQuestionnaire";
import PreQuestionsForm from "@/components/session/PreQuestionsForm";
import PostQuestionsForm from "@/components/session/PostQuestionsForm";
import PostQuestionsFormV2 from "@/components/session/PostQuestionsFormV2";
import CompletedCard from "@/components/session/CompletedCard";
import { toast } from "sonner";

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

  if (state === "pre_questionnaire") {
    return (
      <div className="space-y-4">
        <PreRecordingQuestionnaire />
      </div>
    );
  }

  if (state === "pre_questions") {
    return (
      <div className="space-y-4">
        <PreQuestionsForm questions={preQuestions} />
      </div>
    );
  }

  if (state === "command_select") {
    const hasOptions = commandOptions && commandOptions.length > 0;
    return (
      <>
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">Choose your recording prompt</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Select one option (A, B, or C). You will record your response to that prompt.
            </p>
            {hasOptions ? (
              <div className="space-y-3">
                {commandOptions.map((opt) => {
                  const promptText = (opt.prompt_text_snapshot ?? "").trim();
                  const displayText = promptText || opt.intent || `Option ${opt.option_id} — no prompt text yet`;
                  const selected = selectedCommandOptionId === opt.option_id;
                  return (
                    <button
                      key={opt.option_id}
                      type="button"
                      onClick={() => selectCommandOption(opt.option_id, promptText || displayText)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selected
                          ? "border-orange-500 shadow-md scale-105 ring-2 ring-orange-500/30"
                          : "border-border hover:border-orange-500/50"
                      }`}
                    >
                      <span className={`font-medium ${selected ? "text-orange-600 dark:text-orange-400" : ""}`}>
                        Option {opt.option_id}
                      </span>
                      {opt.is_primary && (
                        <span className="ml-2 text-xs text-muted-foreground">(recommended)</span>
                      )}
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {displayText}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  No options available yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  The backend may not have returned command options for this session. Try refreshing or starting a new session.
                </p>
              </div>
            )}
          </Card>
        </div>
      </>
    );
  }

  if (state === "recording_ready" || state === "recording") {
    const promptText = selectedPromptTextSnapshot ?? preQuestions[0]?.question_text ?? null;
    return (
      <>
        <div className="space-y-4">
          {promptText && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-2">Your recording prompt:</p>
              <p className="text-base leading-relaxed whitespace-pre-wrap">{promptText}</p>
            </div>
          )}
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onRecordingStart={state === "recording_ready" ? () => setRecordingStart(Date.now()) : undefined}
          />
        </div>
      </>
    );
  }

  if (state === "recorded") {
    const tooShort = durationSeconds !== null && durationSeconds < 60;
    const formatTime = (s: number) =>
      `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

    if (tooShort) {
      return (
        <>
          <div className="space-y-4">
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Record Audio</h3>
                <p className="text-sm text-muted-foreground">
                  Click start to begin recording. Min 1 min, max 5 min.
                </p>
              </div>
              <div className="text-center py-4">
                <div className="text-4xl font-mono font-bold">
                  {formatTime(durationSeconds ?? 0)}
                </div>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-orange-500">
                <button
                  type="button"
                  onClick={() => setRecordingReady()}
                  className="flex-1 bg-orange-500 py-3 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
                >
                  Resume recording
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await abandonCurrentSession();
                  }}
                  className="flex-1 bg-orange-600 py-3 text-sm font-medium text-white hover:bg-orange-700 transition-colors border-l border-orange-500"
                >
                  Start again
                </button>
              </div>
            </Card>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">Recording Complete</h3>
              <p className="text-sm text-muted-foreground">
                Click below to submit your recording.
              </p>
              {error && (
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
              )}
              <Button
                onClick={async () => {
                  const store = useSessionStore.getState();
                  if (store.audioBlob && store.durationSeconds !== null) {
                    const controller = new AbortController();
                    abortControllerRef.current = controller;
                    try {
                      await uploadRecordingBlob(controller);
                    } catch (err) {
                      if (err instanceof Error && err.name === "AbortError") {
                        toast.info("Upload cancelled");
                      } else {
                        const errorMsg = err instanceof Error ? err.message : "Upload failed";
                        toast.error(errorMsg);
                        console.error("Upload error details:", err);
                      }
                    } finally {
                      abortControllerRef.current = null;
                    }
                  }
                }}
                disabled={loading}
              >
                {loading ? "Uploading..." : "Submit Recording"}
              </Button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (state === "uploading_processing") {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
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
    );
  }

  if (state === "post_questions") {
    return (
      <>
        <div className="space-y-4">
          <PostQuestionsFormV2
            questions={postQuestions}
            submittedAnswers={postAnswersSubmitted ? postAnswers : undefined}
          />
        </div>
      </>
    );
  }

  if (state === "finalizing") {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
          <h3 className="text-lg font-semibold">Finalizing Session</h3>
          <p className="text-sm text-muted-foreground">
            Processing your answers...
          </p>
        </div>
      </Card>
    );
  }

  if (state === "completed" && completedRecording) {
    return (
      <>
        <div className="space-y-4">
          <CompletedCard recording={completedRecording} />
        </div>
      </>
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
