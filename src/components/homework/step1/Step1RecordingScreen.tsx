"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AudioRecorder from "@/components/recording/AudioRecorder";
import StepFlowWrapper from "@/components/homework/shared/StepFlowWrapper";
import CoachMessageBanner from "@/components/homework/shared/CoachMessageBanner";
import UploadingSpinner from "@/components/homework/shared/UploadingSpinner";
import type { LiveCoachSnapshot, UserSniperProfile } from "@/lib/sniper/types";
import { DEFAULT_TASK_PROMPT } from "@/lib/api/homework-utils";

const RECORDING_1_DURATION_MIN = 30;

interface Step1RecordingScreenProps {
  task: string;
  sessionId: string | null;
  uploading: string | null;
  statusUnknown: boolean;
  sniperProfile: UserSniperProfile | null;
  loading: boolean;
  error: string | null;
  coachMessage: string | null;
  onRecordingComplete: (blob: Blob, duration: number) => void;
  onSniperSnapshot: (snapshot: LiveCoachSnapshot) => void;
  onTranscript: (t: string) => void;
  onAbandon: () => void;
  onStartOver: () => void;
  resetting: boolean;
}

export default function Step1RecordingScreen({
  task,
  sessionId,
  uploading,
  statusUnknown,
  sniperProfile,
  loading,
  error: _error,
  coachMessage,
  onRecordingComplete,
  onSniperSnapshot,
  onAbandon,
  onStartOver,
}: Step1RecordingScreenProps) {
  void _error;
  const isUploadingRec1 = uploading === "1" || uploading === 1 as unknown as string;

  if (isUploadingRec1) {
    return (
      <StepFlowWrapper step={1}>
        <CoachMessageBanner message={coachMessage} />
        <UploadingSpinner label="Sending first recording" />
      </StepFlowWrapper>
    );
  }

  const taskEmpty = sessionId && !task.trim();
  const showStatusUnknownBlock = statusUnknown;
  const showTaskUnavailableBlock = taskEmpty && !statusUnknown;

  return (
    <StepFlowWrapper step={1}>
      <CoachMessageBanner message={coachMessage} />
      {sessionId === "mock-session" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          Preview mode — backend not connected. Recording will not be saved until you implement{" "}
          <code className="text-xs">POST /v2/homework/start</code>.
        </div>
      )}
      {showStatusUnknownBlock && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
          <p>Session could not be restored. Start over to begin a new session.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onStartOver}
          >
            Start over
          </Button>
        </div>
      )}
      {showTaskUnavailableBlock && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
          <p>Task unavailable. Start over to begin a new session.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onStartOver}
          >
            Start over
          </Button>
        </div>
      )}
      {!showStatusUnknownBlock && !showTaskUnavailableBlock && (
        <AudioRecorder
          prompt={task.trim() || DEFAULT_TASK_PROMPT}
          onRecordingComplete={onRecordingComplete}
          onSniperSnapshot={onSniperSnapshot}
          stopAndSend
          uploading={isUploadingRec1}
          minDurationSeconds={RECORDING_1_DURATION_MIN}
          sniperMode
          sniperProfile={sniperProfile}
        />
      )}
      {sessionId && sessionId !== "mock-session" && (
        <div className="mt-[1px] flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onAbandon}
            disabled={loading}
          >
            Abandon session
          </Button>
        </div>
      )}
    </StepFlowWrapper>
  );
}
