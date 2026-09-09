"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  fetchServicePracticeSession,
  mlc3FirstClientPresentationEnabled,
  recordServiceEvent,
  uploadServicePracticeAttempt,
  type FiveStateConfidence,
  type ServiceCoachGuidance,
  type ServiceExerciseOffer,
  type ServicePracticeAttempt,
  type ServicePracticeSession,
} from "@/services/api/mlc3FirstClient";

const CLIENT_VERSION = "mlc3-first-client-web-v1";

export type PracticePreference =
  | "prefer_right"
  | "prefer_left"
  | "same"
  | "not_sure"
  | "audio_unusable";

type ActiveCapture = {
  idempotencyKey: string;
  startedAt: string;
  completedAt: string | null;
  audio: Blob | null;
};

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

export function usePracticeFlow(suggestion: DocumentSuggestion) {
  const identity = suggestion.firstClientService;
  const mic = useDualCaptureMic({ transcript: false });
  const feedbackRenderId = useRef(freshId()).current;
  const offerRenderId = useRef(freshId()).current;
  const practiceRenderId = useRef(freshId()).current;
  const uploadedBlob = useRef<Blob | null>(null);
  const activeCapture = useRef<ActiveCapture | null>(null);
  const [renderReceiptId, setRenderReceiptId] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceRatingValue | null>(null);
  const [offer, setOffer] = useState<ServiceExerciseOffer | null>(null);
  const [practice, setPractice] = useState<ServicePracticeSession | null>(null);
  const [attempts, setAttempts] = useState<ServicePracticeAttempt[]>([]);
  const [preference, setPreference] = useState<PracticePreference | null>(null);
  const [preferenceSaved, setPreferenceSaved] = useState(false);
  const [coachGuidance, setCoachGuidance] = useState<ServiceCoachGuidance[]>([]);
  const [busy, setBusy] = useState(false);
  const [retryPending, setRetryPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feedbackKey = useMemo(
    () => identity
      ? `${identity.membershipId}:${identity.candidateId}:${identity.feedbackExposureId}`
      : "",
    [identity],
  );

  useEffect(() => {
    if (!mlc3FirstClientPresentationEnabled || !identity || !feedbackRenderId) return;
    let cancelled = false;
    void confirmFeedbackRender(
      identity,
      feedbackRenderId,
      CLIENT_VERSION,
      `mlc3-feedback-render:${feedbackKey}:${feedbackRenderId}`,
    ).then((result) => {
      if (cancelled) return;
      if (result.ok) setRenderReceiptId(result.value.render_receipt_id);
      else setError(result.error ?? "This practice is not available yet.");
    });
    return () => { cancelled = true; };
  }, [feedbackKey, feedbackRenderId, identity]);

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
    if (!offer || !offerRenderId) return;
    void recordServiceEvent(
      "offer",
      offer.id,
      "render_confirmed",
      offerRenderId,
      offer.exercise?.contentIdentitySha256 ?? identity?.contentIdentitySha256 ?? "",
      `mlc3-offer-render:${offer.id}:${offerRenderId}`,
    );
  }, [identity?.contentIdentitySha256, offer, offerRenderId]);

  useEffect(() => {
    if (!practice || !practiceRenderId) return;
    void recordServiceEvent(
      "practice",
      practice.id,
      "render_confirmed",
      practiceRenderId,
      practice.contentIdentitySha256,
      `mlc3-practice-render:${practice.id}:${practiceRenderId}`,
    );
  }, [practice, practiceRenderId]);

  const uploadAttempt = useCallback(async (audio: Blob) => {
    const capture = activeCapture.current;
    if (!practice || !capture || !practiceRenderId) return;
    capture.completedAt ??= new Date().toISOString();
    capture.audio ??= audio;
    setBusy(true);
    setError(null);
    const result = await uploadServicePracticeAttempt(
      practice,
      capture.audio,
      practiceRenderId,
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
  }, [mic, practice, practiceRenderId]);

  useEffect(() => {
    if (mic.state.status !== "stopped" || !practice) return;
    if (uploadedBlob.current === mic.state.audioBlob) return;
    uploadedBlob.current = mic.state.audioBlob;
    void uploadAttempt(mic.state.audioBlob);
  }, [mic.state, practice, uploadAttempt]);

  const answerConfidence = useCallback(async (value: ConfidenceRatingValue) => {
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
  }, [busy, feedbackKey, identity, renderReceiptId]);

  const openPractice = useCallback(async () => {
    if (!offer || !identity || !suggestion.quote.trim() || busy) return;
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
    const loaded = await fetchServicePracticeSession(
      created.value.practice_session_id,
      `mlc3-practice-read:${created.value.practice_session_id}`,
    );
    setBusy(false);
    if (!loaded.ok) {
      setError(loaded.error ?? "Couldn't open the practice. Try again.");
      return;
    }
    setPractice(loaded.value);
  }, [busy, identity, offer, suggestion.quote]);

  const startRecording = useCallback(async () => {
    if (activeCapture.current) {
      setError("Finish saving the previous recording first.");
      return;
    }
    const captureId = freshId();
    activeCapture.current = {
      idempotencyKey: `mlc3-practice-attempt:${practice?.id}:${captureId}`,
      startedAt: new Date().toISOString(),
      completedAt: null,
      audio: null,
    };
    setRetryPending(false);
    setError(null);
    await mic.start();
  }, [mic, practice?.id]);

  const retryUpload = useCallback(() => {
    const audio = activeCapture.current?.audio;
    if (audio) void uploadAttempt(audio);
  }, [uploadAttempt]);

  const savePreference = useCallback(async (value: PracticePreference) => {
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
  }, [attempts, busy, practice]);

  const selectedAttempt = [...attempts].reverse().find((item) => item.ownerPair);
  return {
    active: mlc3FirstClientPresentationEnabled && Boolean(identity),
    identity,
    feedbackReady: Boolean(renderReceiptId),
    mic,
    offerRenderId,
    practiceRenderId,
    confidence,
    offer,
    practice,
    attempts,
    preference,
    preferenceSaved,
    coachGuidance,
    busy,
    retryPending,
    error,
    selectedAttempt,
    answerConfidence,
    openPractice,
    startRecording,
    retryUpload,
    savePreference,
  };
}
