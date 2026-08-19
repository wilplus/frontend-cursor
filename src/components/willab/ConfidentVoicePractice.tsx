"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, Square, X } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import type {
  ConfidentVoicePracticeOffer,
  DocumentSuggestion,
} from "@/services/api/idealText";
import {
  finishConfidencePractice,
  startConfidencePractice,
  uploadConfidencePracticeAttempt,
  type ConfidencePractice,
  type ConfidencePracticeAttempt,
} from "@/services/api/confidentVoicePractice";

type Evidence = NonNullable<DocumentSuggestion["evidence"]>;

interface Props {
  snippetId: string;
  offer: ConfidentVoicePracticeOffer;
  evidence: Evidence;
  originalUserAnswer: "yes" | "no";
}

/**
 * The practice is deliberately nested under an already-answered Confident
 * Voice card. It cannot become another Feedback Manager item and it cannot
 * mutate the transcript: this component only talks to the isolated practice
 * endpoints.
 */
export default function ConfidentVoicePractice({
  snippetId,
  offer,
  evidence,
  originalUserAnswer,
}: Props) {
  const mic = useDualCaptureMic({ transcript: false });
  const [view, setView] = useState<"offer" | "practice" | "final" | "closed">(
    offer.resume ? "practice" : "offer",
  );
  const [practice, setPractice] = useState<ConfidencePractice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadedBlob = useRef<Blob | null>(null);

  useEffect(() => {
    if (!offer.resume || practice || busy) return;
    void begin();
    // begin is intentionally event-like. The stable offer identity is the
    // resume key; retry remains a visible user action after a failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.resume]);

  useEffect(() => {
    if (mic.state.status !== "stopped") return;
    if (uploadedBlob.current === mic.state.audioBlob) return;
    uploadedBlob.current = mic.state.audioBlob;
    void submitAttempt(mic.state.audioBlob, mic.state.durationSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.state]);

  async function ensurePractice(): Promise<ConfidencePractice | null> {
    if (practice) return practice;
    setBusy(true);
    setError(null);
    const result = await startConfidencePractice(
      snippetId,
      offer,
      evidence,
      originalUserAnswer,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't open the practice. Try again.");
      return null;
    }
    setPractice(result.practice);
    return result.practice;
  }

  async function begin() {
    const opened = await ensurePractice();
    if (opened) setView(opened.finalReady ? "final" : "practice");
  }

  async function dismiss() {
    mic.cancel();
    const opened = await ensurePractice();
    if (!opened) return;
    setBusy(true);
    setError(null);
    const result = await finishConfidencePractice(opened.id, { action: "dismiss" });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that choice. Try again.");
      return;
    }
    setPractice(result.practice);
    setView("closed");
  }

  async function submitAttempt(audio: Blob, durationSec: number) {
    const opened = await ensurePractice();
    if (!opened) return;
    setBusy(true);
    setError(null);
    const result = await uploadConfidencePracticeAttempt(
      opened.id,
      audio,
      durationSec,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't assess that attempt. Try again.");
      return;
    }
    setPractice(result.practice);
    mic.cancel();
    if (result.practice.finalReady) setView("final");
  }

  async function finish(answer: "yes" | "no") {
    const strongest = practice?.strongestAttempt;
    if (!practice || !strongest || busy) return;
    setBusy(true);
    setError(null);
    const result = await finishConfidencePractice(practice.id, {
      attempt_id: strongest.id,
      user_answer: answer,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that answer. Try again.");
      return;
    }
    setPractice(result.practice);
    setView("closed");
  }

  function closePractice() {
    mic.cancel();
    setView("closed");
  }

  if (view === "closed") return null;

  if (view === "offer") {
    return (
      <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
        <p className="text-[15px] font-medium leading-relaxed text-foreground">
          {originalUserAnswer === "yes"
            ? offer.yesIntroduction
            : offer.noIntroduction}
        </p>
        <h3 className="mt-4 text-[15px] font-semibold text-foreground">
          {offer.title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {offer.instruction}
        </p>
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={offer.explanationVideoRef}
            controls
            playsInline
            preload="metadata"
            className="max-h-48 w-full"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void begin()}
            className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-medium text-background disabled:opacity-50"
          >
            {busy ? "Opening…" : "Practise this moment"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void dismiss()}
            className="rounded-full border border-border px-5 py-2.5 text-[13px] font-medium text-foreground disabled:opacity-50"
          >
            Not now
          </button>
        </div>
        {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="relative rounded-2xl border border-primary/25 bg-background p-4">
      <button
        type="button"
        onClick={closePractice}
        className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        aria-label="Close practice"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>

      <p className="pr-9 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
        {practice?.exercise.title ?? offer.title}
      </p>
      <p className="mt-2 pr-8 text-[13px] leading-relaxed text-muted-foreground">
        {practice?.exercise.instruction ?? offer.instruction}
      </p>

      <div className="mt-4 rounded-xl border border-border bg-muted/35 p-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Read this exact passage
        </p>
        <p className="mt-1.5 text-[16px] font-medium leading-relaxed text-foreground">
          {practice?.passage ?? offer.passage}
        </p>
      </div>

      {view === "practice" ? (
        <>
          {practice?.originalAudioRef ? (
            <PracticeMessage side="left" label="Willab · original">
              <MediaPlayer
                src={practice.originalAudioRef}
                startOffsetMs={practice.originalStartOffsetMs}
                durationMs={practice.originalDurationMs}
              />
            </PracticeMessage>
          ) : null}

          <div className="mt-3 flex flex-col gap-3">
            {practice?.attempts.map((item) => (
              <AttemptMessage key={item.id} attempt={item} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {mic.state.status === "recording" ? (
              <button
                type="button"
                onClick={() => void mic.stop()}
                className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-[13px] font-medium text-destructive-foreground"
              >
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden />
                Stop
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !practice || practice.attemptsRemaining <= 0}
                onClick={() => void mic.start()}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Mic className="h-4 w-4" aria-hidden />
                )}
                {practice?.attempts.length ? "Try again" : "Record my version"}
              </button>
            )}
            {practice?.strongestAttempt ? (
              <button
                type="button"
                disabled={busy || mic.state.status === "recording"}
                onClick={() => setView("final")}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-[13px] font-medium text-foreground disabled:opacity-50"
              >
                <Check className="h-4 w-4" aria-hidden />
                This feels right
              </button>
            ) : null}
          </div>
          {mic.state.status === "error" ? (
            <p className="mt-2 text-[12px] text-destructive">{mic.state.message}</p>
          ) : null}
          {practice ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              {practice.attemptsRemaining} of 3 attempts remaining
            </p>
          ) : null}
        </>
      ) : (
        <FinalChoice
          practice={practice}
          busy={busy}
          onAnswer={(answer) => void finish(answer)}
          onClose={closePractice}
        />
      )}

      {error ? <p className="mt-3 text-[12px] text-destructive">{error}</p> : null}
    </section>
  );
}

function PracticeMessage({
  side,
  label,
  children,
}: {
  side: "left" | "right";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mt-3 flex ${side === "right" ? "justify-end" : "justify-start"}`}>
      <div className="w-[92%] max-w-md rounded-2xl border border-border bg-muted/30 p-3">
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}

function AttemptMessage({ attempt }: { attempt: ConfidencePracticeAttempt }) {
  return (
    <>
      <PracticeMessage side="right" label={`You · attempt ${attempt.attemptIndex}`}>
        <MediaPlayer src={attempt.audioRef} startOffsetMs={0} durationMs={attempt.durationMs} />
      </PracticeMessage>
      <PracticeMessage side="left" label="Willab">
        <p className="text-[13px] leading-relaxed text-foreground">
          {attempt.assessment}
        </p>
      </PracticeMessage>
    </>
  );
}

function FinalChoice({
  practice,
  busy,
  onAnswer,
  onClose,
}: {
  practice: ConfidencePractice | null;
  busy: boolean;
  onAnswer: (answer: "yes" | "no") => void;
  onClose: () => void;
}) {
  const strongest = practice?.strongestAttempt;
  if (!practice || !strongest) return null;
  return (
    <div className="mt-4">
      <PracticeMessage side="right" label="Your strongest attempt">
        <MediaPlayer src={strongest.audioRef} startOffsetMs={0} durationMs={strongest.durationMs} />
      </PracticeMessage>
      <PracticeMessage side="left" label="Willab">
        <p className="text-[13px] leading-relaxed text-foreground">
          {practice.finalMessage}
        </p>
      </PracticeMessage>
      <p className="mt-3 text-[14px] font-semibold text-foreground">
        {practice.finalQuestion}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer("yes")}
          className="rounded-full bg-foreground px-5 py-2.5 text-[13px] font-medium text-background disabled:opacity-50"
        >
          Yes, keep this take
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer("no")}
          className="rounded-full border border-border px-5 py-2.5 text-[13px] font-medium text-foreground disabled:opacity-50"
        >
          No, not yet
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-full px-4 py-2.5 text-[13px] text-muted-foreground disabled:opacity-50"
        >
          Close practice
        </button>
      </div>
    </div>
  );
}
