"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import MediaPlayer from "@/components/results/MediaPlayer";
import ConfidenceLabelChips from "@/components/willab/ConfidenceLabelChips";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import type { ConfidenceRatingValue } from "@/services/api/stateRatings";
import type { DocumentSuggestion } from "@/services/api/idealText";
import {
  answerServiceFeedback,
  answerServicePracticePreference,
  confirmFeedbackRender,
  createServiceExerciseOffer,
  createServicePracticeSession,
  fetchServiceCoachGuidance,
  mlc3FirstClientPresentationEnabled,
  recordServiceCoachGuidanceEvent,
  recordServiceEvent,
  uploadServicePracticeAttempt,
  type FiveStateConfidence,
  type ServiceExerciseOffer,
  type ServiceCoachGuidance,
  type ServicePracticeAttempt,
  type ServicePracticeSession,
} from "@/services/api/mlc3FirstClient";

const CLIENT_VERSION = "mlc3-first-client-web-v1";

function freshId(): string {
  return globalThis.crypto?.randomUUID?.() ?? "";
}

function confidenceAnswer(value: ConfidenceRatingValue): FiveStateConfidence {
  if (value === "yes") return "confident_yes";
  if (value === "in_between") return "confident_in_between";
  if (value === "no") return "confident_no";
  if (value === "not_sure") return "confident_not_sure";
  return "confident_audio_unclear";
}

type Preference = "prefer_right" | "prefer_left" | "same" | "not_sure" |
  "audio_unusable";

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

export default function Mlc3FirstClientPractice({
  suggestion,
}: {
  suggestion: DocumentSuggestion;
}) {
  const identity = suggestion.firstClientService;
  const mic = useDualCaptureMic({ transcript: false });
  const feedbackRenderId = useRef(freshId());
  const offerRenderId = useRef(freshId());
  const practiceRenderId = useRef(freshId());
  const uploadedBlob = useRef<Blob | null>(null);
  const activeCapture = useRef<null | {
    idempotencyKey: string;
    startedAt: string;
    completedAt: string | null;
    audio: Blob | null;
  }>(null);
  const [renderReceiptId, setRenderReceiptId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceRatingValue | null>(null);
  const [offer, setOffer] = useState<ServiceExerciseOffer | null>(null);
  const [practice, setPractice] = useState<ServicePracticeSession | null>(null);
  const [attempts, setAttempts] = useState<ServicePracticeAttempt[]>([]);
  const [preference, setPreference] = useState<Preference | null>(null);
  const [preferenceSaved, setPreferenceSaved] = useState(false);
  const [coachGuidance, setCoachGuidance] = useState<ServiceCoachGuidance[]>([]);
  const [busy, setBusy] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exactPassage = suggestion.quote.trim();
  const feedbackKey = useMemo(
    () => identity
      ? `${identity.membershipId}:${identity.candidateId}:${identity.feedbackExposureId}`
      : "",
    [identity],
  );

  useEffect(() => {
    if (
      !mlc3FirstClientPresentationEnabled || !identity || !feedbackRenderId.current
    ) return;
    let cancelled = false;
    void confirmFeedbackRender(
      identity,
      feedbackRenderId.current,
      CLIENT_VERSION,
      `mlc3-feedback-render:${feedbackKey}:${feedbackRenderId.current}`,
    ).then((result) => {
      if (cancelled) return;
      if (result.ok) setRenderReceiptId(result.value.render_receipt_id);
      else setError(result.error ?? "This practice is not available yet.");
    });
    return () => { cancelled = true; };
  }, [feedbackKey, identity]);

  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    void fetchServiceCoachGuidance(
      identity.membershipId,
      `mlc3-guidance-delivery:${identity.membershipId}`,
    ).then((result) => {
      if (!cancelled && result.ok) setCoachGuidance(result.value);
    });
    return () => { cancelled = true; };
  }, [identity]);

  useEffect(() => {
    if (!offer || !offerRenderId.current) return;
    void recordServiceEvent(
      "offer",
      offer.id,
      "render_confirmed",
      offerRenderId.current,
      offer.exercise?.contentIdentitySha256 ?? identity?.contentIdentitySha256 ?? "",
      `mlc3-offer-render:${offer.id}:${offerRenderId.current}`,
    );
  }, [identity?.contentIdentitySha256, offer]);

  useEffect(() => {
    if (!practice || !practiceRenderId.current) return;
    void recordServiceEvent(
      "practice",
      practice.id,
      "render_confirmed",
      practiceRenderId.current,
      practice.contentIdentitySha256,
      `mlc3-practice-render:${practice.id}:${practiceRenderId.current}`,
    );
  }, [practice]);

  useEffect(() => {
    if (mic.state.status !== "stopped" || !practice) return;
    if (uploadedBlob.current === mic.state.audioBlob) return;
    uploadedBlob.current = mic.state.audioBlob;
    void uploadAttempt(mic.state.audioBlob);
    // Upload is an event transition driven by the recorder state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mic.state, practice]);

  if (!mlc3FirstClientPresentationEnabled || !identity) return null;

  async function answerConfidence(value: ConfidenceRatingValue) {
    if (!identity || !renderReceiptId || busy) return;
    setBusy(true);
    setError(null);
    const response = confidenceAnswer(value);
    const answered = await answerServiceFeedback(
      identity,
      renderReceiptId,
      response,
      `mlc3-feedback-response:${feedbackKey}:${response}`,
    );
    if (!answered.ok) {
      setBusy(false);
      setError(answered.error ?? "Couldn't save that. Try again.");
      return;
    }
    setConfidence(value);
    if (!answered.value.exercise_offer_allowed) {
      setBusy(false);
      return;
    }
    const created = await createServiceExerciseOffer(
      identity,
      answered.value.response_binding_id,
      `mlc3-service-offer:${answered.value.response_binding_id}`,
    );
    setBusy(false);
    if (!created.ok) {
      setError(created.error ?? "A matching exercise is not ready yet.");
      return;
    }
    setOffer(created.value);
  }

  async function openPractice() {
    if (!offer || !identity || !exactPassage || busy) return;
    setBusy(true);
    setError(null);
    const created = await createServicePracticeSession(
      offer.id,
      identity,
      `mlc3-practice-session:${offer.id}:${identity.candidateId}`,
    );
    if (!created.ok) {
      setBusy(false);
      setError(created.error ?? "Couldn't open the practice. Try again.");
      return;
    }
    const loaded = await import("@/services/api/mlc3FirstClient").then(
      ({ fetchServicePracticeSession }) => fetchServicePracticeSession(
        created.value.practice_session_id,
        `mlc3-practice-read:${created.value.practice_session_id}`,
      ),
    );
    setBusy(false);
    if (!loaded.ok) {
      setError(loaded.error ?? "Couldn't open the practice. Try again.");
      return;
    }
    setPractice(loaded.value);
  }

  async function startRecording() {
    if (activeCapture.current) {
      setError("Finish saving the previous recording first.");
      return;
    }
    const captureId = freshId();
    activeCapture.current = {
      idempotencyKey:
        `mlc3-practice-attempt:${practice?.id}:${captureId}`,
      startedAt: new Date().toISOString(),
      completedAt: null,
      audio: null,
    };
    setRetryPending(false);
    setError(null);
    await mic.start();
  }

  async function uploadAttempt(audio: Blob) {
    const capture = activeCapture.current;
    if (!practice || !capture || !practiceRenderId.current) return;
    capture.completedAt ??= new Date().toISOString();
    capture.audio ??= audio;
    setBusy(true);
    setError(null);
    const result = await uploadServicePracticeAttempt(
      practice,
      capture.audio,
      practiceRenderId.current,
      capture.startedAt,
      capture.completedAt,
      capture.idempotencyKey,
    );
    setBusy(false);
    mic.cancel();
    if (!result.ok) {
      setRetryPending(true);
      setError(result.error ?? "Couldn't save that recording. Try again.");
      return;
    }
    activeCapture.current = null;
    setRetryPending(false);
    setAttempts((current) => [...current, result.value]);
  }

  async function savePreference(value: Preference) {
    const selected = [...attempts].reverse().find((item) => item.ownerPair);
    if (!practice || !selected?.ownerPair || busy) return;
    setBusy(true);
    setError(null);
    const result = await answerServicePracticePreference(
      practice.id,
      selected.ownerPair.pairAssignmentId,
      value,
      `mlc3-owner-preference:${selected.ownerPair.pairAssignmentId}:${value}`,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't save that answer. Try again.");
      return;
    }
    setPreference(value);
    setPreferenceSaved(true);
  }

  const selectedAttempt = [...attempts].reverse().find((item) => item.ownerPair);
  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      {coachGuidance.length ? (
        <div className="mb-4 grid gap-3">
          {coachGuidance.map((item) => (
            <CoachGuidanceCard key={item.attachmentVersionId} item={item} />
          ))}
        </div>
      ) : null}
      {confidence === null ? (
        <ConfidenceLabelChips
          question="Does this sound confident to you?"
          value={confidence}
          disabled={!renderReceiptId || busy}
          saving={busy}
          error={error}
          ownerWording
          onPick={(value) => void answerConfidence(value)}
        />
      ) : offer?.outcome === "coach_exercise_requested" ? (
        <p className="text-sm text-muted-foreground">
          A matching exercise is not ready yet.
        </p>
      ) : offer?.exercise && !practice ? (
        <div>
          <p className="text-sm leading-relaxed text-foreground">
            {offer.exercise.instructionText}
          </p>
          <video
            src={offer.exercise.mediaUrl}
            controls
            playsInline
            preload="metadata"
            className="mt-3 max-h-52 w-full rounded-xl bg-black"
            onPlay={() => void recordServiceEvent(
              "offer", offer.id, "playback_started", offerRenderId.current,
              offer.exercise?.contentIdentitySha256 ?? "",
              `mlc3-offer-play:${offer.id}:${offerRenderId.current}`,
            )}
            onEnded={() => void recordServiceEvent(
              "offer", offer.id, "playback_completed", offerRenderId.current,
              offer.exercise?.contentIdentitySha256 ?? "",
              `mlc3-offer-complete:${offer.id}:${offerRenderId.current}`,
            )}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void openPractice()}
            className="mt-4 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
          >
            {busy ? "Opening…" : "Practise this moment"}
          </button>
        </div>
      ) : practice ? (
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
            {attempts.map((attempt) => (
              <MediaPlayer
                key={attempt.attemptId}
                src={attempt.audioRef}
                startOffsetMs={0}
                durationMs={attempt.durationMs}
              />
            ))}
          </div>
          {!selectedAttempt ? (
            <button
              type="button"
              disabled={busy}
              onClick={retryPending && activeCapture.current?.audio
                ? () => void uploadAttempt(activeCapture.current!.audio!)
                : mic.state.status === "recording"
                ? () => void mic.stop()
                : () => void startRecording()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                : mic.state.status === "recording"
                  ? <Square className="h-4 w-4" aria-hidden />
                  : <Mic className="h-4 w-4" aria-hidden />}
              {retryPending
                ? "Retry saving"
                : mic.state.status === "recording" ? "Stop" : "Record again"}
            </button>
          ) : !preferenceSaved ? (
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
                    disabled={busy}
                    aria-pressed={preference === value}
                    onClick={() => void savePreference(value)}
                    className="rounded-xl border border-border px-3 py-3 text-sm font-medium disabled:opacity-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Thank you.</p>
          )}
          {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
        </div>
      ) : busy ? (
        <p className="text-sm text-muted-foreground">Preparing…</p>
      ) : error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </section>
  );
}
