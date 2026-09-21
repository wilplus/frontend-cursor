"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import { Loader2, Mic, Square } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import ConfidenceLabelChips from "@/components/willab/ConfidenceLabelChips";
import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  recordServiceCoachGuidanceEvent,
  recordServiceEvent,
  type ServiceCoachGuidance,
} from "@/services/api/mlc3FirstClient";
import { usePracticeFlow } from "@/components/willab/usePracticeFlow";

function freshId(): string {
  return globalThis.crypto?.randomUUID?.() ?? "";
}

function CoachGuidanceCard({ item }: { item: ServiceCoachGuidance }) {
  const renderId = useRef(freshId());
  const renderConfirmation = useRef<Promise<boolean> | null>(null);
  const ensureRendered = useCallback(() => {
    if (!renderId.current) return Promise.resolve(false);
    if (!renderConfirmation.current) {
      renderConfirmation.current = recordServiceCoachGuidanceEvent(
        item.attachmentVersionId,
        "rendered",
        renderId.current,
        `mlc3-guidance-render:${item.attachmentVersionId}:${renderId.current}`,
      ).then((result) => result.ok);
    }
    return renderConfirmation.current;
  }, [item.attachmentVersionId]);
  useEffect(() => {
    void ensureRendered();
  }, [ensureRendered]);
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Coach guidance
      </p>
      {item.writtenNote ? (
        <p className="mt-2 text-sm leading-relaxed">{item.writtenNote}</p>
      ) : null}
      {item.mediaUrl ? (
        <video
          src={item.mediaUrl}
          controls
          playsInline
          preload="metadata"
          className="mt-3 max-h-52 w-full rounded-xl bg-black"
          onPlay={() => void ensureRendered().then((rendered) => {
            if (!rendered) return;
            return recordServiceCoachGuidanceEvent(
              item.attachmentVersionId,
              "played",
              null,
              `mlc3-guidance-play:${item.attachmentVersionId}:${renderId.current}`,
            );
          })}
        />
      ) : null}
    </div>
  );
}

type PracticeFlow = ReturnType<typeof usePracticeFlow>;

function SpeakerConfirmation({
  busy,
  onAnswer,
}: {
  busy: boolean;
  onAnswer: (confirmed: boolean) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-sm font-semibold">Is this your voice in this recording?</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        This keeps comparisons on your own voice. It is not a confidence score.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer(true)}
          className="rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-50"
        >
          Yes, this is my voice
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer(false)}
          className="rounded-xl border border-border px-4 py-3 text-sm font-medium disabled:opacity-50"
        >
          Not sure or someone else
        </button>
      </div>
    </div>
  );
}

function OfferStep({ flow }: { flow: PracticeFlow }) {
  const exercise = flow.offer?.exercise;
  if (!flow.offer || !exercise) return null;
  return (
    <div>
      <p className="text-sm leading-relaxed text-foreground">
        {exercise.instructionText}
      </p>
      <video
        src={exercise.mediaUrl}
        controls
        playsInline
        preload="metadata"
        className="mt-3 max-h-52 w-full rounded-xl bg-black"
        onPlay={() => void recordServiceEvent(
          "offer", flow.offer!.id, "playback_started", flow.offerRenderId,
          exercise.contentIdentitySha256,
          `mlc3-offer-play:${flow.offer!.id}:${flow.offerRenderId}`,
        )}
        onEnded={() => void recordServiceEvent(
          "offer", flow.offer!.id, "playback_completed", flow.offerRenderId,
          exercise.contentIdentitySha256,
          `mlc3-offer-complete:${flow.offer!.id}:${flow.offerRenderId}`,
        )}
      />
      <button
        type="button"
        disabled={flow.busy}
        onClick={() => void flow.openPractice()}
        className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
      >
        {flow.busy ? "Opening…" : "Practise this moment"}
      </button>
    </div>
  );
}

function RecordingAction({ flow }: { flow: PracticeFlow }) {
  const recording = flow.mic.state.status === "recording";
  const onClick = flow.retryPending
    ? flow.retryUpload
    : recording
      ? () => void flow.mic.stop()
      : () => void flow.startRecording();
  return (
    <button
      type="button"
      disabled={flow.busy}
      onClick={onClick}
      className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
    >
      {flow.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        : recording
          ? <Square className="h-4 w-4" aria-hidden />
          : <Mic className="h-4 w-4" aria-hidden />}
      {flow.retryPending ? "Retry saving" : recording ? "Stop" : "Record again"}
    </button>
  );
}

function PreferenceAction({ flow }: { flow: PracticeFlow }) {
  if (flow.preferenceSaved) {
    return <p className="mt-4 text-sm text-muted-foreground">Thank you.</p>;
  }
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">
        Does this sound better to you than the original?
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {([
          ["prefer_right", "Yes"], ["same", "Same"],
          ["prefer_left", "No"], ["not_sure", "Not sure"],
          ["audio_unusable", "Audio unclear"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={flow.busy}
            aria-pressed={flow.preference === value}
            onClick={() => void flow.savePreference(value)}
            className="rounded-xl border border-border px-3 py-3 text-sm font-medium disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PracticeStep({
  flow,
  suggestion,
}: {
  flow: PracticeFlow;
  suggestion: DocumentSuggestion;
}) {
  const practice = flow.practice;
  if (!practice) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Read this exact passage
      </p>
      <p className="mt-2 text-base font-medium leading-relaxed">
        {practice.exactPassage}
      </p>
      <div className="mt-4 grid gap-3">
        {suggestion.snippetAudioRef ? (
          <MediaPlayer
            src={suggestion.snippetAudioRef}
            startOffsetMs={suggestion.startOffsetMs ?? 0}
            durationMs={suggestion.durationMs ?? 0}
          />
        ) : null}
        {flow.attempts.map((attempt) => (
          <MediaPlayer
            key={attempt.attemptId}
            src={attempt.audioRef}
            startOffsetMs={0}
            durationMs={attempt.durationMs}
          />
        ))}
      </div>
      {flow.selectedAttempt
        ? <PreferenceAction flow={flow} />
        : flow.speakerPendingAttempt
          ? (
            <div className="mt-4">
              <SpeakerConfirmation
                busy={flow.busy}
                onAnswer={(confirmed) => void flow.confirmPracticeSpeaker(
                  flow.speakerPendingAttempt!.attemptId,
                  confirmed,
                )}
              />
            </div>
          )
        : <RecordingAction flow={flow} />}
      {flow.error ? (
        <p className="mt-3 text-xs text-destructive">{flow.error}</p>
      ) : null}
    </div>
  );
}

/** THE QUESTION SCREEN — step one of the ladder, and only that.
 *
 *  It used to be one component with the exercise nested under the answered
 *  question (founder 2026-09-21: "instead of a Done button simply instant
 *  acceptance"). Answering now advances the ladder, so nothing may live under
 *  the answer on this screen: the sheet is told the answer and moves on, and
 *  the exercise has its own rung (`Mlc3ExerciseStep` below). */
export function Mlc3ConfidenceQuestion({
  flow,
  question,
  onAnswered,
}: {
  flow: PracticeFlow;
  question: string;
  /** The answer was saved server-side. `exerciseAllowed` is the server's
   *  word on whether an exercise rung follows; the sheet builds the ladder
   *  from it in the same tick, before this flow's state has re-rendered. */
  onAnswered: (value: ConfidenceRatingValue, exerciseAllowed: boolean) => void;
}) {
  if (!flow.active || !flow.identity) return null;
  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      {flow.coachGuidance.length ? (
        <div className="mb-4 grid gap-3">
          {flow.coachGuidance.map((item) => (
            <CoachGuidanceCard key={item.attachmentVersionId} item={item} />
          ))}
        </div>
      ) : null}
      <ConfidenceLabelChips
        question={question}
        value={flow.confidence}
        disabled={!flow.feedbackReady || flow.busy || flow.confidence !== null}
        saving={flow.busy}
        error={flow.error}
        ownerWording
        onPick={(value) => {
          void flow.answerConfidence(value).then((result) => {
            if (result.saved) onAnswered(value, result.exerciseAllowed);
          });
        }}
      />
    </section>
  );
}

/** THE EXERCISE RUNG. Everything that used to sit under the answered question:
 *  the self-voice check, the frozen offer, the practice recording and the
 *  owner's preference. The sheet owns the footer; this draws the body. */
export function Mlc3ExerciseStep({
  flow,
  suggestion,
}: {
  flow: PracticeFlow;
  suggestion: DocumentSuggestion;
}) {
  if (!flow.active || !flow.identity) return null;
  return (
    <section
      data-testid="service-exercise"
      className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4"
    >
      <ExerciseStage flow={flow} suggestion={suggestion} />
    </section>
  );
}

function ExerciseStage({
  flow,
  suggestion,
}: {
  flow: PracticeFlow;
  suggestion: DocumentSuggestion;
}) {
  if (flow.sourceSpeakerState === "pending") {
    return (
      <SpeakerConfirmation
        busy={flow.busy}
        onAnswer={(confirmed) => void flow.confirmSourceSpeaker(confirmed)}
      />
    );
  }
  if (flow.sourceSpeakerState === "declined") {
    return (
      <p className="text-sm text-muted-foreground">
        Voice practice is unavailable for this recording.
      </p>
    );
  }
  if (flow.offer?.outcome === "coach_exercise_requested") {
    return (
      <p className="text-sm text-muted-foreground">
        A matching exercise is not ready yet.
      </p>
    );
  }
  if (flow.offer?.exercise && !flow.practice) return <OfferStep flow={flow} />;
  if (flow.practice) return <PracticeStep flow={flow} suggestion={suggestion} />;
  if (flow.busy) {
    return <p className="text-sm text-muted-foreground">Preparing…</p>;
  }
  if (flow.error) return <p className="text-xs text-destructive">{flow.error}</p>;
  return null;
}

/** Has the rung reached a point where Done is honest? Not a verdict on the
 *  practice — only "there is nothing left on this screen to do". */
export function serviceExerciseSettled(flow: PracticeFlow): boolean {
  return (
    flow.preferenceSaved ||
    flow.sourceSpeakerState === "declined" ||
    flow.offer?.outcome === "coach_exercise_requested"
  );
}
