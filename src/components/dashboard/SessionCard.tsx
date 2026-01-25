"use client";

import { useEffect, useState, useRef } from "react";
import { useSessionStore } from "@/store/session-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    preAnswers,
    preAnswersSubmitted,
    postQuestions,
    postAnswers,
    postAnswersSubmitted,
    completedRecording,
    initialize,
    startNewSession,
    setRecordingReady,
    setRecordingStart,
    uploadRecordingBlob,
    abandonCurrentSession,
    loading,
    error,
  } = useSessionStore();

  const [showAbandonDialog, setShowAbandonDialog] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

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

  const handleAbandon = async () => {
    await abandonCurrentSession();
    setShowAbandonDialog(false);
    toast.success("Session abandoned");
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

  // Old pre_questions state removed - questionnaire replaces it
  // If somehow we end up in pre_questions state, redirect to questionnaire
  if (state === "pre_questions") {
    // This shouldn't happen with new flow, but handle gracefully
    const currentState = get();
    if (!currentState.questionnaireSubmitted) {
      // No questionnaire submitted yet - show questionnaire
      return (
        <div className="space-y-4">
          <PreRecordingQuestionnaire />
        </div>
      );
    } else {
      // Questionnaire was submitted but state is wrong - go to recording
      return (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">Ready to Record</h3>
              <p className="text-sm text-muted-foreground">
                Click below to start recording.
              </p>
              <Button 
                onClick={() => {
                  setRecordingStart(Date.now());
                }}
              >
                Start Recording
              </Button>
            </div>
          </Card>
        </div>
      );
    }
  }

  if (state === "recording_ready") {
    // Show the AI-generated prompt(s) from the questionnaire
    const generatedPrompt = preQuestions.length > 0 ? preQuestions[0] : null;
    
    return (
      <>
        <div className="space-y-4">
          {sessionId && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAbandonDialog(true)}
              >
                Abandon Session
              </Button>
            </div>
          )}
          <Card className="p-6">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Ready to Record</h3>
                {generatedPrompt && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Your recording prompt:
                    </p>
                    <p className="text-base leading-relaxed">
                      {generatedPrompt.question_text}
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  {generatedPrompt 
                    ? "Click below to start recording your response."
                    : "Click below to start recording."}
                </p>
              </div>
              <Button 
                className="w-full"
                onClick={() => {
                  // Transition to recording state and show AudioRecorder
                  setRecordingStart(Date.now());
                }}
              >
                Start Recording
              </Button>
            </div>
          </Card>
        </div>
        <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Abandon Session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently abandon your current session. All progress
                will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowAbandonDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleAbandon}>
                Abandon Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (state === "recording") {
    return (
      <>
        <div className="space-y-4">
          {sessionId && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAbandonDialog(true)}
              >
                Abandon Session
              </Button>
            </div>
          )}
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onCancel={() => {
              // Return to recording_ready without auto-starting
              setRecordingReady();
            }}
          />
        </div>
        <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Abandon Session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently abandon your current session. All progress
                will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowAbandonDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleAbandon}>
                Abandon Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  if (state === "recorded") {
    return (
      <>
        <div className="space-y-4">
          {sessionId && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAbandonDialog(true)}
              >
                Abandon Session
              </Button>
            </div>
          )}
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
        <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Abandon Session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently abandon your current session. All progress
                will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowAbandonDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleAbandon}>
                Abandon Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
          {sessionId && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAbandonDialog(true)}
              >
                Abandon Session
              </Button>
            </div>
          )}
          <PostQuestionsFormV2
            questions={postQuestions}
            submittedAnswers={postAnswersSubmitted ? postAnswers : undefined}
          />
        </div>
        <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Abandon Session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently abandon your current session. All progress
                will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowAbandonDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleAbandon}>
                Abandon Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
          {sessionId && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAbandonDialog(true)}
              >
                Abandon Session
              </Button>
            </div>
          )}
          <CompletedCard recording={completedRecording} />
        </div>
        <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Abandon Session?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently abandon your current session. All progress
                will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowAbandonDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleAbandon}>
                Abandon Session
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
    <>
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <p>Loading session...</p>
        </div>
      </Card>
      <AlertDialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abandon Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently abandon your current session. All progress
              will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowAbandonDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAbandon}>
              Abandon Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
