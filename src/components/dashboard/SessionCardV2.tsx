"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useSessionStoreV2Flow } from "@/store/session-store-v2-flow";
import { Button } from "@/components/ui/button";
import { ProgressStepBullets } from "@/components/ui/progress-step-bullets";
import { ProgressPillBar } from "@/components/ui/progress-pill-bar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FlowBackLink } from "@/components/ui/flow-back-button";
import AudioRecorder from "@/components/recording/AudioRecorder";
import { Play, RefreshCw } from "lucide-react";

const FLOW_STEPS = 6; // universal → exercise → task → intent → recording → post/done
const UNIVERSAL_STEPS = 3;

function getFlowStepIndex(state: string): number {
  if (state === "universal_questions") return 0;
  if (state === "exercise") return 1;
  if (state === "task") return 2;
  if (state === "intent") return 3;
  if (["recording_ready", "recording", "recorded", "uploading_processing"].includes(state)) return 4;
  if (["post_questions", "finalizing", "completed"].includes(state)) return 5;
  return 0;
}

/** V2 universal questions — same UI as v1 PreRecordingQuestionnaire (3 steps). Maps to task_score: Good=1, Not great=0; readiness 1–10; guide me=0, I'll choose=1. */
function UniversalQuestionsV2({
  loading,
  error,
  setUniversalAnswer,
  submitUniversalAnswers,
  onBackStep,
}: {
  loading: boolean;
  error: string | null;
  setUniversalAnswer: (field: "mood" | "readiness" | "mode_preference", value: number) => void;
  submitUniversalAnswers: () => Promise<void>;
  onBackStep: () => Promise<void>;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [mood, setMood] = useState<"positive" | "negative" | null>(null);
  const [readiness, setReadiness] = useState<number | null>(null);
  const [inspirationNeeded, setInspirationNeeded] = useState<boolean | null>(null);

  const goBack = useCallback(() => {
    if (currentStep === 0) {
      onBackStep();
    } else {
      setCurrentStep((s) => Math.max(0, s - 1));
    }
  }, [currentStep, onBackStep]);

  const canAdvance =
    (currentStep === 0 && mood !== null) ||
    (currentStep === 1 && readiness !== null) ||
    (currentStep === 2 && inspirationNeeded !== null);

  const goNext = useCallback(() => {
    if (currentStep === 2) {
      setUniversalAnswer("mood", mood === "positive" ? 1 : 0);
      setUniversalAnswer("readiness", readiness ?? 5);
      setUniversalAnswer("mode_preference", inspirationNeeded ? 0 : 1);
      submitUniversalAnswers();
    } else {
      setCurrentStep((s) => Math.min(UNIVERSAL_STEPS - 1, s + 1));
    }
  }, [currentStep, mood, readiness, inspirationNeeded, setUniversalAnswer, submitUniversalAnswers]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (canAdvance) goNext();
      }
    },
    [canAdvance, goNext]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !canAdvance || loading) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      e.preventDefault();
      goNext();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [canAdvance, loading, goNext]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center gap-3 py-12" aria-label="Starting session">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Starting session…</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Check in before the recording</h3>

        <ProgressPillBar
          total={UNIVERSAL_STEPS}
          currentIndex={currentStep}
          aria-label={`Step ${currentStep + 1} of ${UNIVERSAL_STEPS}`}
        />

        <p className="text-muted-foreground text-sm text-center mb-4">
          Question {currentStep + 1} of {UNIVERSAL_STEPS}
        </p>

        <form onSubmit={(e) => { e.preventDefault(); goNext(); }} onKeyDown={handleKeyDown} className="space-y-6">
          <div className="relative min-h-[200px] overflow-hidden flex flex-col justify-center">
            {/* Step 0: Mood — Good = 1, Not great = 0 for task_score */}
            {currentStep === 0 && (
              <div key="0" className="animate-fade-in absolute inset-0 w-full space-y-3 pr-1 flex flex-col justify-center">
                <label className="block text-lg sm:text-xl font-bold text-foreground text-center">
                  Do you feel more like:
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setMood("positive"); setUniversalAnswer("mood", 1); }}
                    className={`flex-1 min-w-0 py-3 px-3 rounded-lg border-2 transition-all ${
                      mood === "positive"
                        ? "border-primary shadow-md ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-2xl block">🙂</span>
                    <p className={`text-xs mt-1 font-medium truncate ${mood === "positive" ? "text-primary" : ""}`}>
                      Good
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMood("negative"); setUniversalAnswer("mood", 0); }}
                    className={`flex-1 min-w-0 py-3 px-3 rounded-lg border-2 transition-all ${
                      mood === "negative"
                        ? "border-primary shadow-md ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-2xl block">🙁</span>
                    <p className={`text-xs mt-1 font-medium truncate ${mood === "negative" ? "text-primary" : ""}`}>
                      Not great
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Readiness 1–10 → task_score uses readiness/10 */}
            {currentStep === 1 && (
              <div key="1" className="animate-fade-in absolute inset-0 w-full space-y-3 pr-1 flex flex-col justify-center">
                <label className="block text-lg sm:text-xl font-bold text-foreground text-center">
                  How ready is your body and mind to present?
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground w-full sm:w-auto">Not ready</span>
                  <div className="flex-1 flex gap-1 min-w-0">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => { setReadiness(num); setUniversalAnswer("readiness", num); }}
                        className={`flex-1 aspect-square min-w-[2rem] rounded-lg border-2 transition-all ${
                          readiness === num
                            ? "border-primary ring-2 ring-primary/30"
                            : readiness !== null && readiness > num
                              ? "border-primary/50"
                              : "border-border hover:border-primary/50"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground w-full sm:w-auto">Very ready</span>
                </div>
                {readiness !== null && (
                  <p className="text-xs text-muted-foreground text-center">
                    {readiness}/10
                  </p>
                )}
              </div>
            )}

            {/* Step 2: Guided — Yes guide me = 0, No I'll choose = 1 for task_score */}
            {currentStep === 2 && (
              <div key="2" className="animate-fade-in absolute inset-0 w-full space-y-3 pr-1 flex flex-col justify-center">
                <label className="block text-lg sm:text-xl font-bold text-foreground text-center">
                  Do you want to be guided?
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setInspirationNeeded(true); setUniversalAnswer("mode_preference", 0); }}
                    className={`flex-1 min-w-0 py-3 px-3 rounded-lg border-2 transition-all ${
                      inspirationNeeded === true
                        ? "border-primary shadow-md ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-2xl block">📋</span>
                    <p className={`text-xs mt-1 font-medium truncate ${inspirationNeeded === true ? "text-primary" : ""}`}>
                      YES – guide me
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInspirationNeeded(false); setUniversalAnswer("mode_preference", 1); }}
                    className={`flex-1 min-w-0 py-3 px-3 rounded-lg border-2 transition-all ${
                      inspirationNeeded === false
                        ? "border-primary shadow-md ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-2xl block">🎯</span>
                    <p className={`text-xs mt-1 font-medium truncate ${inspirationNeeded === false ? "text-primary" : ""}`}>
                      NO – I'll choose
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            {canAdvance && (
              <p className="animate-fade-in text-muted-foreground text-sm text-center mt-3">
                Press <span className="font-medium">Enter ↵</span> or click to continue
              </p>
            )}
            <Button
              type="submit"
              disabled={loading || !canAdvance}
              className="w-full rounded-xl bg-primary py-6 text-base font-semibold text-white hover:opacity-90"
            >
              {currentStep === 2
                ? (loading ? "Starting session..." : "Continue")
                : "Next"}
            </Button>
            <FlowBackLink onClick={goBack}>back</FlowBackLink>
          </div>
        </form>
      </div>
    </Card>
  );
}

export default function SessionCardV2() {
  const {
    state,
    sessionId,
    plan,
    taskId,
    selectedTask,
    universalQuestions,
    universalAnswers,
    initialize,
    startNewSession,
    setUniversalAnswer,
    submitUniversalAnswers,
    submitExerciseFeedback,
    selectTask,
    submitIntent,
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
    updatePostAnswer,
    submitPostAnswers,
    recordingId,
    reset,
    report,
    performanceScore,
    performanceMetrics,
    metricLabelsSnapshot,
  } = useSessionStoreV2Flow();

  const authReady = useAuthReady();
  const abortControllerRef = useRef<AbortController | null>(null);
  const intentEmotionRef = useRef<HTMLInputElement>(null);
  const keywordsRef = useRef<[HTMLInputElement | null, HTMLInputElement | null, HTMLInputElement | null]>([null, null, null]);

  useEffect(() => {
    if (authReady) initialize();
  }, [authReady, initialize]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleStartSession = async () => {
    await startNewSession();
  };

  const handleRecordingComplete = (blob: Blob) => {
    const store = useSessionStoreV2Flow.getState();
    store.setRecordingEnd(Date.now(), blob);
    store.transitionToPostQuestionsWithDefaults();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    store.uploadRecordingBlob(controller, { background: true }).finally(() => {
      abortControllerRef.current = null;
    });
  };

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

  if (state === "idle") {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold">Start a New Session (v2)</h3>
          <p className="text-sm text-muted-foreground">
            Answer a few questions, choose a task, record, and get feedback with 5 metrics.
          </p>
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md text-left">
              <p className="font-medium">Error:</p>
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
              "Start v2 Session"
            )}
          </Button>
        </div>
      </Card>
    );
  }

  if (state === "universal_questions") {
    return (
      <FlowWrapper>
        <UniversalQuestionsV2
          loading={loading}
          error={error}
          setUniversalAnswer={setUniversalAnswer}
          submitUniversalAnswers={submitUniversalAnswers}
          onBackStep={abandonCurrentSession}
        />
      </FlowWrapper>
    );
  }

  if (state === "exercise" && plan?.exercise) {
    const ex = plan.exercise;
    return (
      <FlowWrapper>
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">{ex.title}</h3>
          <p className="text-sm text-muted-foreground">{ex.description}</p>
          {ex.video_url && (
            <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
              Watch video
            </a>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={() => submitExerciseFeedback(true)} disabled={loading}>Liked it</Button>
            <Button variant="outline" onClick={() => submitExerciseFeedback(false)} disabled={loading}>Skip / not really</Button>
          </div>
        </Card>
      </FlowWrapper>
    );
  }

  if (state === "task" && plan?.tasks?.length) {
    const tasks = plan.tasks;
    return (
      <FlowWrapper>
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Choose a task</h3>
          {tasks.map((t) => (
            <div key={t.id} className="rounded-lg border p-4">
              <p className="font-medium">{t.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{t.prompt_text}</p>
              <Button className="mt-2" size="sm" onClick={() => selectTask(t.id)} disabled={loading}>
                Select
              </Button>
            </div>
          ))}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </Card>
      </FlowWrapper>
    );
  }

  if (state === "intent") {
    const prompts = plan?.intent_prompts ?? { intended_emotion_prompt: "Intended emotion", keywords_prompt: "3 keywords" };
    const handleSubmitIntent = () => {
      const emotion = intentEmotionRef.current?.value?.trim() ?? "";
      const k0 = keywordsRef.current[0]?.value?.trim() ?? "";
      const k1 = keywordsRef.current[1]?.value?.trim() ?? "";
      const k2 = keywordsRef.current[2]?.value?.trim() ?? "";
      if (!emotion || !k0 || !k1 || !k2) {
        useSessionStoreV2Flow.getState().forceResetLoading();
        return;
      }
      submitIntent(emotion, [k0, k1, k2]);
    };
    return (
      <FlowWrapper>
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-semibold">Intent</h3>
          <div>
            <label className="block text-sm font-medium mb-1">{prompts.intended_emotion_prompt}</label>
            <Input ref={intentEmotionRef} placeholder="e.g. confident" defaultValue="" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{prompts.keywords_prompt} (3 words)</label>
            <div className="flex gap-2">
              <Input ref={(el) => { keywordsRef.current[0] = el; }} placeholder="1" />
              <Input ref={(el) => { keywordsRef.current[1] = el; }} placeholder="2" />
              <Input ref={(el) => { keywordsRef.current[2] = el; }} placeholder="3" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleSubmitIntent} disabled={loading}>
            {loading ? "Submitting…" : "Continue to recording"}
          </Button>
        </Card>
      </FlowWrapper>
    );
  }

  if (state === "recording_ready" || state === "recording") {
    const promptText = selectedTask?.prompt_text ?? "Record your reflection.";
    return (
      <FlowWrapper>
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">Your task</p>
            <p className="text-base font-medium leading-relaxed whitespace-pre-wrap">&ldquo;{promptText}&rdquo;</p>
          </div>
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
    const store = useSessionStoreV2Flow.getState();
    const durationSeconds = store.durationSeconds ?? 0;
    const tooShort = durationSeconds < 60;
    const formatTime = (s: number) =>
      `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
    if (tooShort) {
      return (
        <FlowWrapper>
          <Card className="p-6 space-y-4">
            <p className="font-mono text-2xl">{formatTime(durationSeconds)}</p>
            <p className="text-sm text-muted-foreground">Recording under 1 minute. Resume or start over.</p>
            <div className="flex gap-2">
              <Button onClick={() => setRecordingReady()}>
                <Play className="mr-2 h-4 w-4" /> Resume
              </Button>
              <Button variant="outline" onClick={() => abandonCurrentSession()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Start over
              </Button>
            </div>
          </Card>
        </FlowWrapper>
      );
    }
    return (
      <FlowWrapper>
        <Card className="p-6">
          <div className="text-center space-y-4">
            {error ? (
              <>
                <h3 className="text-lg font-semibold">Upload failed</h3>
                <p className="text-sm text-destructive">{error}</p>
                <Button
                  onClick={() => {
                    const c = new AbortController();
                    abortControllerRef.current = c;
                    useSessionStoreV2Flow.getState().uploadRecordingBlob(c).finally(() => { abortControllerRef.current = null; });
                  }}
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Retry send"}
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">Sending recording</h3>
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                <p className="text-sm text-muted-foreground">Please wait…</p>
              </>
            )}
          </div>
        </Card>
      </FlowWrapper>
    );
  }

  if (state === "uploading_processing") {
    return (
      <FlowWrapper>
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent mx-auto" />
            <h3 className="text-lg font-semibold">Uploading</h3>
            <p className="text-sm text-muted-foreground">Processing your recording…</p>
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
            <p className="text-center text-xs text-muted-foreground">Uploading in background…</p>
          )}
          {error && !recordingId && (
            <Card className="p-4 border-destructive/50 bg-destructive/5">
              <p className="text-sm text-destructive font-medium mb-2">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const c = new AbortController();
                  abortControllerRef.current = c;
                  useSessionStoreV2Flow.getState().uploadRecordingBlob(c, { background: true }).finally(() => { abortControllerRef.current = null; });
                }}
                disabled={loading}
              >
                {loading ? "Retrying…" : "Retry upload"}
              </Button>
            </Card>
          )}
          <Card className="p-6 space-y-4">
            {postQuestions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium mb-1">{q.text}</label>
                {q.answer_type === "scale_1_5" && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant={postAnswers[q.id] === String(n) ? "default" : "outline"}
                        size="sm"
                        onClick={() => updatePostAnswer(q.id, String(n))}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                )}
                {q.answer_type === "yes_no" && (
                  <div className="flex gap-2">
                    <Button type="button" variant={postAnswers[q.id] === "YES" ? "default" : "outline"} size="sm" onClick={() => updatePostAnswer(q.id, "YES")}>YES</Button>
                    <Button type="button" variant={postAnswers[q.id] === "NO" ? "default" : "outline"} size="sm" onClick={() => updatePostAnswer(q.id, "NO")}>NO</Button>
                  </div>
                )}
                {q.answer_type === "text" && (
                  <Input value={postAnswers[q.id] ?? ""} onChange={(e) => updatePostAnswer(q.id, e.target.value)} placeholder="Optional" />
                )}
              </div>
            ))}
            <Button onClick={() => useSessionStoreV2Flow.getState().submitPostAnswers()} disabled={loading || postAnswersSubmitted}>
              Submit answers
            </Button>
          </Card>
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
            <h3 className="text-lg font-semibold">Finalizing</h3>
            <p className="text-sm text-muted-foreground">Processing your answers…</p>
          </div>
        </Card>
      </FlowWrapper>
    );
  }

  if (state === "completed") {
    const score = performanceScore ?? 0;
    const labels = metricLabelsSnapshot?.length ? metricLabelsSnapshot : performanceMetrics?.map((m) => ({ code: m.code, left_label: "", right_label: "" })) ?? [];
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Session complete</h3>
          {report?.report_text && (
            <div className="rounded-lg bg-muted/50 p-4 mb-4 text-left text-sm whitespace-pre-wrap">
              {report.report_text}
            </div>
          )}
          {performanceMetrics?.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-sm font-medium">Performance: {Math.round(score * 100)}%</p>
              <div className="space-y-1">
                {performanceMetrics.map((m) => {
                  const label = labels.find((l) => l.code === m.code);
                  return (
                    <div key={m.code} className="flex items-center gap-2 text-sm">
                      <span className="w-24 truncate">{label?.left_label ?? m.code}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${m.normalized_score * 100}%` }} />
                      </div>
                      <span className="text-muted-foreground">{Math.round(m.normalized_score * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <Button onClick={reset}>Start another session</Button>
        </Card>
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
        <p>Loading…</p>
      </div>
    </Card>
  );
}
