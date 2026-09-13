"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { useDualCaptureMic } from "@/hooks/useDualCaptureMic";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  fetchConfidentMomentExerciseCorrelation,
  newConfidentMomentIdentity,
  type ConfidentMomentExerciseCorrelation,
} from "@/services/api/confidentMomentBundles";
import {
  answerServicePracticePreference,
  confirmPracticeSelfSpeaker,
  createCorrelatedServicePracticeSession,
  fetchServiceExerciseOffer,
  fetchServicePracticeSession,
  recordServiceEvent,
  uploadServicePracticeAttempt,
  type ServiceExerciseOffer,
  type ServicePracticeAttempt,
  type ServicePracticeSession,
} from "@/services/api/mlc3FirstClient";

type Capture = { key: string; startedAt: string; completedAt: string | null; blob: Blob | null };

export default function ConfidentMomentExercisePanel({
  bundleId,
  attachmentId,
  sourceAudioUrl,
  sourcePlaybackState,
  onLoadSourcePlayback,
  onCancelSourcePlayback,
  onPracticeSourceReady,
}: {
  bundleId: string;
  attachmentId: string;
  sourceAudioUrl: string | null;
  sourcePlaybackState: "idle" | "loading" | "ready" | "completed" | "failed" | "terminal";
  onLoadSourcePlayback: () => void;
  onCancelSourcePlayback: () => void;
  onPracticeSourceReady: (source: {
    attachmentId: string;
    practiceAttemptId: string;
    sourceTargetSpeakerBindingId: string;
    practiceTargetSpeakerBindingId: string;
  }) => void;
}) {
  const mic = useDualCaptureMic({ transcript: false });
  const correlationKey = useRef(`bundle-exercise:${bundleId}:${attachmentId}`);
  const offerRenderId = useRef(newConfidentMomentIdentity());
  const practiceRenderId = useRef(newConfidentMomentIdentity());
  const capture = useRef<Capture | null>(null);
  const uploaded = useRef<Blob | null>(null);
  const [correlation, setCorrelation] = useState<ConfidentMomentExerciseCorrelation | null>(null);
  const [offer, setOffer] = useState<ServiceExerciseOffer | null>(null);
  const [practice, setPractice] = useState<ServicePracticeSession | null>(null);
  const [attempts, setAttempts] = useState<ServicePracticeAttempt[]>([]);
  const [busy, setBusy] = useState(true);
  const [retryUpload, setRetryUpload] = useState(false);
  const [error, setError] = useState(false);
  const [preferenceSaved, setPreferenceSaved] = useState(false);
  const [correlationRetryRequired, setCorrelationRetryRequired] = useState(false);
  const [correlationAttempt, setCorrelationAttempt] = useState(0);
  const [exercisePlaybackState, setExercisePlaybackState] = useState<
    "pending" | "saving" | "confirmed" | "failed"
  >("pending");
  const [playableComparisonClips, setPlayableComparisonClips] = useState<Set<number>>(
    () => new Set(),
  );

  useEffect(() => {
    let active = true;
    setBusy(true);
    setCorrelationRetryRequired(false);
    setError(false);
    void (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await fetchConfidentMomentExerciseCorrelation(bundleId, attachmentId);
        if (!active) return;
        if (result.kind === "retry" && attempt === 0) continue;
        if (result.kind === "retry") { setCorrelationRetryRequired(true); setBusy(false); return; }
        if (result.kind !== "ok") { setError(true); setBusy(false); return; }
        setCorrelation(result.value);
        if (result.value.status === "not_supplied") { setBusy(false); return; }
        const loaded = await fetchServiceExerciseOffer(result.value.offerId, correlationKey.current);
        if (!active) return;
        if (!loaded.ok) { setError(true); setBusy(false); return; }
        setOffer(loaded.value);
        setBusy(false);
        return;
      }
    })();
    return () => { active = false; };
  }, [attachmentId, bundleId, correlationAttempt]);

  useEffect(() => {
    if (!offer?.exercise) return;
    void recordServiceEvent("offer", offer.id, "render_confirmed", offerRenderId.current,
      offer.exercise.contentIdentitySha256, `mlc3-offer-render:${offer.id}:${offerRenderId.current}`);
  }, [offer]);

  useEffect(() => {
    if (!practice) return;
    void recordServiceEvent("practice", practice.id, "render_confirmed", practiceRenderId.current,
      practice.contentIdentitySha256, `mlc3-practice-render:${practice.id}:${practiceRenderId.current}`);
  }, [practice]);

  const confirmExercisePlayback = useCallback(async () => {
    if (!offer?.exercise || exercisePlaybackState === "saving" || exercisePlaybackState === "confirmed") return;
    setExercisePlaybackState("saving");
    const result = await recordServiceEvent(
      "offer",
      offer.id,
      "playback_completed",
      offerRenderId.current,
      offer.exercise.contentIdentitySha256,
      `mlc3-offer-complete:${offer.id}:${offerRenderId.current}`,
    );
    setExercisePlaybackState(result.ok ? "confirmed" : "failed");
  }, [exercisePlaybackState, offer]);

  const upload = useCallback(async (blob: Blob) => {
    const current = capture.current;
    if (!practice || !current) return;
    current.completedAt ??= new Date().toISOString();
    current.blob ??= blob;
    setBusy(true);
    const result = await uploadServicePracticeAttempt(practice, current.blob, practiceRenderId.current,
      current.startedAt, current.completedAt, current.key);
    setBusy(false);
    mic.cancel();
    if (!result.ok) { setRetryUpload(true); setError(true); return; }
    capture.current = null;
    setRetryUpload(false);
    setError(false);
    setAttempts((items) => [...items, result.value]);
  }, [mic, practice]);

  useEffect(() => {
    if (mic.state.status !== "stopped" || !practice || uploaded.current === mic.state.audioBlob) return;
    uploaded.current = mic.state.audioBlob;
    void upload(mic.state.audioBlob);
  }, [mic.state, practice, upload]);

  const pendingSpeaker = [...attempts].reverse().find((item) => item.speakerConfirmationRequired && !item.ownerPair);
  const paired = [...attempts].reverse().find((item) => item.ownerPair);
  const comparisonClips = paired?.ownerPair && sourceAudioUrl
    ? [paired.ownerPair.leftClip, paired.ownerPair.rightClip].map((clip) => ({
        clip,
        src: clip === "after" ? paired.audioRef : sourceAudioUrl,
      }))
    : null;

  useEffect(() => {
    setPlayableComparisonClips(new Set());
  }, [paired?.ownerPair?.pairAssignmentId, sourceAudioUrl]);

  if (busy && !offer && !practice) return <p className="text-sm text-muted-foreground">Preparing…</p>;
  if (correlationRetryRequired && !offer) return (
    <button type="button" className="rounded-full border border-border px-4 py-2 text-sm" onClick={() => setCorrelationAttempt((value) => value + 1)}>
      Try again
    </button>
  );
  // Structural not_supplied is intentionally invisible and nonsemantic.
  if (correlation?.status === "not_supplied") return null;
  if (error && !offer) return null;
  if (!offer?.exercise) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-primary/20 p-4">
      <p className="text-sm leading-relaxed">{offer.exercise.instructionText}</p>
      <video
        src={offer.exercise.mediaUrl}
        controls
        playsInline
        preload="metadata"
        className="max-h-52 w-full rounded-xl bg-black"
        onPlay={() => void recordServiceEvent("offer", offer.id, "playback_started", offerRenderId.current,
          offer.exercise!.contentIdentitySha256, `mlc3-offer-play:${offer.id}:${offerRenderId.current}`)}
        onEnded={() => void confirmExercisePlayback()}
      />
      {exercisePlaybackState === "saving" ? (
        <p className="text-xs text-muted-foreground">Confirming playback…</p>
      ) : exercisePlaybackState === "failed" ? (
        <button
          type="button"
          className="rounded-full border border-border px-4 py-2 text-sm"
          onClick={() => void confirmExercisePlayback()}
        >
          Try again
        </button>
      ) : null}
      {!practice ? (
        <button type="button" disabled={busy || exercisePlaybackState !== "confirmed"} className="rounded-full bg-foreground px-5 py-2.5 text-sm text-background disabled:opacity-40" onClick={() => void (async () => {
          if (correlation?.status !== "available") return;
          setBusy(true);
          const created = await createCorrelatedServicePracticeSession(offer.id, correlation.sourceAcquisitionReceiptId,
            `mlc3-practice-session:${offer.id}:${correlation.sourceAcquisitionReceiptId}`);
          const loaded = created.ok ? await fetchServicePracticeSession(created.value.practice_session_id,
            `mlc3-practice-read:${created.value.practice_session_id}`) : created;
          setBusy(false);
          if (!loaded.ok) { setError(true); return; }
          setPractice(loaded.value);
        })}>Practise this moment</button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">{practice.exactPassage}</p>
          {!paired ? attempts.map((attempt) => (
            <MediaPlayer key={attempt.attemptId} src={attempt.audioRef} startOffsetMs={0} durationMs={attempt.durationMs} />
          )) : null}
          {!pendingSpeaker && !paired ? (
            <button type="button" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm text-background" onClick={() => {
              if (retryUpload && capture.current?.blob) { void upload(capture.current.blob); return; }
              if (mic.state.status === "recording") { void mic.stop(); return; }
              const id = newConfidentMomentIdentity();
              capture.current = { key: `mlc3-practice-attempt:${practice.id}:${id}`, startedAt: new Date().toISOString(), completedAt: null, blob: null };
              void mic.start();
            }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mic.state.status === "recording" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {retryUpload ? "Retry saving" : mic.state.status === "recording" ? "Stop" : "Record again"}
            </button>
          ) : null}
          {pendingSpeaker ? (
            <div className="flex gap-2">
              <button type="button" disabled={busy} className="rounded-full bg-foreground px-4 py-2 text-sm text-background" onClick={() => void (async () => {
                setBusy(true);
                const result = await confirmPracticeSelfSpeaker(pendingSpeaker.attemptId, `mlc3-practice-speaker:${pendingSpeaker.attemptId}`);
                setBusy(false);
                if (!result.ok) { setError(true); return; }
                setAttempts((items) => items.map((item) => item.attemptId === pendingSpeaker.attemptId ? { ...item, speakerConfirmationRequired: false, ownerPair: result.value.ownerPair } : item));
                if (correlation?.status === "available") {
                  onPracticeSourceReady({
                    attachmentId,
                    practiceAttemptId: pendingSpeaker.attemptId,
                    sourceTargetSpeakerBindingId: correlation.sourceTargetSpeakerBindingId,
                    practiceTargetSpeakerBindingId: result.value.speakerTarget.targetBindingId,
                  });
                }
              })}>This is my voice</button>
              <button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={() => setAttempts((items) => items.map((item) => item.attemptId === pendingSpeaker.attemptId ? { ...item, speakerConfirmationRequired: false } : item))}>Cancel</button>
            </div>
          ) : null}
          {paired?.ownerPair && !sourceAudioUrl ? (
            sourcePlaybackState === "loading" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Loading the first recording…</span>
                <button type="button" className="rounded-full border px-3 py-1.5" onClick={onCancelSourcePlayback}>Cancel</button>
              </div>
            ) : sourcePlaybackState === "terminal" ? (
              <p className="text-sm text-muted-foreground">The first recording is unavailable, so this comparison cannot be answered.</p>
            ) : (
              <button type="button" className="rounded-full border border-border px-4 py-2 text-sm" onClick={onLoadSourcePlayback}>
                {sourcePlaybackState === "failed" ? "Try loading again" : "Load both recordings"}
              </button>
            )
          ) : null}
          {paired?.ownerPair && comparisonClips ? (
            <div className="space-y-3" data-owner-pair-assignment={paired.ownerPair.pairAssignmentId}>
              <div className="grid gap-3 sm:grid-cols-2">
                {comparisonClips.map((entry, index) => (
                  <div key={`${paired.ownerPair!.pairAssignmentId}:${entry.clip}`} className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Recording {index + 1}</p>
                    <audio
                      src={entry.src}
                      controls
                      preload="metadata"
                      className="w-full"
                      onCanPlay={() => setPlayableComparisonClips((current) => {
                        const next = new Set(current);
                        next.add(index);
                        return next;
                      })}
                      onError={() => setPlayableComparisonClips((current) => {
                        const next = new Set(current);
                        next.delete(index);
                        return next;
                      })}
                    />
                  </div>
                ))}
              </div>
              {!preferenceSaved ? <>
                <p className="text-sm font-medium">Did the exercise help?</p>
                <div className="flex flex-wrap gap-2">
              {([[paired.ownerPair.rightClip === "after" ? "prefer_right" : "prefer_left", "Yes"],['same','Same'],[paired.ownerPair.rightClip === "after" ? "prefer_left" : "prefer_right",'No'],['not_sure','Not sure'],['audio_unusable','Audio unclear']] as const).map(([answer, label]) => (
                <button key={answer} type="button" disabled={busy || comparisonClips.length !== 2 || playableComparisonClips.size !== 2} className="rounded-full border px-3 py-2 text-sm" onClick={() => void (async () => {
                  setBusy(true);
                  const result = await answerServicePracticePreference(practice.id, paired.ownerPair!.pairAssignmentId, answer, `mlc3-owner-preference:${paired.ownerPair!.pairAssignmentId}:${answer}`);
                  setBusy(false);
                  if (result.ok) setPreferenceSaved(true); else setError(true);
                })()}>{label}</button>
              ))}
                </div>
              </> : <p className="text-sm text-muted-foreground">Thank you.</p>}
            </div>
          ) : null}
          {error ? <p className="text-xs text-destructive">Couldn&apos;t complete that step.</p> : null}
        </div>
      )}
    </section>
  );
}
