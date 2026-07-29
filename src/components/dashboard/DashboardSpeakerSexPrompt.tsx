"use client";

import SpeakerSexPrompt from "@/components/willab/SpeakerSexPrompt";
import { useRecordingContext } from "@/components/dashboard/DashboardShell";

/**
 * Dashboard mount for the one-time speaker-sex ask.
 *
 * Exists only to keep SpeakerSexPrompt mount-agnostic: the prompt itself knows
 * nothing about the dashboard, and this wrapper holds the one dashboard-shaped
 * rule — never render on a recording screen. The shell collapses to a focused
 * recording layout while `isRecording`, and putting a profile question in the
 * middle of a take is precisely the interruption the LIVE LOOP fence forbids.
 *
 * `useRecordingContext` returns `isRecording: false` when no provider is above
 * it, so this stays safe if it is ever mounted outside the shell.
 */
export default function DashboardSpeakerSexPrompt() {
  const { isRecording } = useRecordingContext();
  if (isRecording) return null;
  return <SpeakerSexPrompt className="mb-6 w-full" />;
}
