"use client";

import { useState, useRef, useEffect } from "react";
import { homeworkApi, type SelfRatingResponse } from "@/lib/api/homework-client";
import type { HomeworkSessionStatus } from "@/lib/api/types-homework";
import type { Step } from "@/lib/api/types-homework";
import {
  isRecordingProcessingFailedError,
  isSelfRatingNotReadyError,
} from "@/lib/api/homework-errors";
import { toast } from "sonner";

export function useSelfRating({
  step,
  sessionId,
  setStep,
  setRecordingProcessingFailed,
  setReportRetryCount,
}: {
  step: Step;
  sessionId: string | null;
  setStep: React.Dispatch<React.SetStateAction<Step>>;
  setRecordingProcessingFailed: React.Dispatch<React.SetStateAction<boolean>>;
  setReportRetryCount: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [studentSpeechRatingSubmitted, setStudentSpeechRatingSubmitted] = useState(false);
  const [savingStudentRating, setSavingStudentRating] = useState(false);
  const [pendingRetrySelfRating, setPendingRetrySelfRating] = useState<
    { sessionId: string; rating: number } | { sessionId: string; skipped: true } | null
  >(null);
  const lastSelfRatingPayloadRef = useRef<
    { sessionId: string; rating: number } | { sessionId: string; skipped: true } | null
  >(null);
  const hasSetPendingRetryFrom409Ref = useRef(false);

  // Step-2 recording-processing-failed poll
  useEffect(() => {
    if (step !== 2 || !sessionId || sessionId === "mock-session") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const statusRes = await homeworkApi.getStatus();
        if (cancelled) return;
        const raw = statusRes as HomeworkSessionStatus & {
          session?: { recording_1_processing_status?: string };
          recording_1_processing_status?: string;
        };
        const processingFailed =
          raw?.recording_1_processing_status === "failed" ||
          (typeof raw?.session === "object" && raw.session?.recording_1_processing_status === "failed");
        if (processingFailed) setRecordingProcessingFailed(true);
      } catch {
        // ignore transient status errors on step 2
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, sessionId]);

  // When self-rating isn't accepted yet: poll GET session/status, then auto-submit self-rating.
  useEffect(() => {
    if ((step !== 2 && step !== 3) || !pendingRetrySelfRating) return;
    const { sessionId: sid } = pendingRetrySelfRating;
    const intervalMs = 5000;
    const maxWaitMs = 120000;
    const startedAt = Date.now();
    const poll = async () => {
      try {
        const statusRes = await homeworkApi.getStatus();
        const raw = statusRes as HomeworkSessionStatus & { recording_1_processing_status?: string };
        const processingStatus = raw?.recording_1_processing_status;
        const status = raw?.status ?? (raw as { session?: { status?: string } }).session?.status;
        if (processingStatus === "failed") {
          setRecordingProcessingFailed(true);
          setPendingRetrySelfRating(null);
          return;
        }
        const jobDone =
          (typeof processingStatus === "string" && processingStatus !== "pending") ||
          status === "completed" ||
          Date.now() - startedAt >= maxWaitMs;
        if (!jobDone) return;
        const payload = pendingRetrySelfRating;
        setPendingRetrySelfRating(null);
        if (payload && "rating" in payload) {
          await homeworkApi.submitSelfRating(sid, payload.rating);
        } else {
          await homeworkApi.submitSelfRatingSkipped(sid);
        }
        setStudentSpeechRatingSubmitted(true);
        setStep(3);
        setReportRetryCount((c) => c + 1);
      } catch {
        // keep polling
      }
    };
    const id = setInterval(poll, intervalMs);
    poll();
    return () => clearInterval(id);
  }, [step, pendingRetrySelfRating]);

  const handleRatingSelect = async (n: number) => {
    if (!sessionId || sessionId === "mock-session") return;
    setSavingStudentRating(true);
    try {
      lastSelfRatingPayloadRef.current = { sessionId, rating: n };
      const res: SelfRatingResponse = await homeworkApi.submitSelfRating(sessionId, n);
      setStudentSpeechRatingSubmitted(true);
      setStep(3);
      if (res.session_completed === false) {
        setPendingRetrySelfRating({ sessionId, rating: n });
      }
    } catch (e) {
      if (isRecordingProcessingFailedError(e)) {
        setRecordingProcessingFailed(true);
        toast.error("We couldn't process this recording. Please record again.");
        return;
      }
      if (isSelfRatingNotReadyError(e)) {
        setPendingRetrySelfRating({ sessionId, rating: n });
        setStudentSpeechRatingSubmitted(true);
        setStep(3);
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save rating. Try again.");
      }
    } finally {
      setSavingStudentRating(false);
    }
  };

  const handleRatingSkip = async () => {
    if (!sessionId || sessionId === "mock-session") {
      setStudentSpeechRatingSubmitted(true);
      setStep(3);
      return;
    }
    setSavingStudentRating(true);
    try {
      lastSelfRatingPayloadRef.current = { sessionId, skipped: true };
      const res: SelfRatingResponse = await homeworkApi.submitSelfRatingSkipped(sessionId);
      setStudentSpeechRatingSubmitted(true);
      setStep(3);
      if (res.session_completed === false) {
        setPendingRetrySelfRating({ sessionId, skipped: true });
      }
    } catch (e) {
      if (isRecordingProcessingFailedError(e)) {
        setRecordingProcessingFailed(true);
        toast.error("We couldn't process this recording. Please record again.");
        return;
      }
      if (isSelfRatingNotReadyError(e)) {
        setPendingRetrySelfRating({ sessionId, skipped: true });
        setStudentSpeechRatingSubmitted(true);
        setStep(3);
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save. Try again.");
      }
    } finally {
      setSavingStudentRating(false);
    }
  };

  return {
    studentSpeechRatingSubmitted,
    setStudentSpeechRatingSubmitted,
    savingStudentRating,
    setSavingStudentRating,
    pendingRetrySelfRating,
    setPendingRetrySelfRating,
    handleRatingSelect,
    handleRatingSkip,
    lastSelfRatingPayloadRef,
    hasSetPendingRetryFrom409Ref,
  };
}
