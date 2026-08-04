"use client";

import { useEffect, useRef, useState } from "react";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  fetchCoachReflectionQueue,
  submitCoachVerdict,
  type CoachReflectionClip,
  type CoachVerdict,
} from "@/services/api/coachReflectionQueue";

/* -------------------------------------------------------------------------- */
/*  CoachReflectionQueue — the BLIND clip-verification card (F2 §1d)           */
/*                                                                            */
/*  The coach half of the Reflection Game, and the half that makes the loop    */
/*  close: until a clip gets a verdict here, it never reaches the student's    */
/*  Confident Voices library.                                                  */
/*                                                                            */
/*  BLIND BY CONSTRUCTION. The payload carries audio + transcript and nothing  */
/*  else — no machine flag, no student vote, no student identity. That is the  */
/*  point, not a gap: the verdict is only worth something as an independent    */
/*  third judgement, and a coach who saw the model's guess or the student's    */
/*  answer would be grading those instead of the audio. Never add a field      */
/*  here, and never render one that arrives unexpectedly.                      */
/*                                                                            */
/*  QUEUE PRIORITY (founder decision): text verification outranks clip         */
/*  verification. This card mounts BELOW the review-queue bubbles so a backed- */
/*  up coach clears text first.                                                */
/*                                                                            */
/*  IN-THREAD, NOT LAYERED — same LIVE-LOOP rule as ReflectionGamePrompt and   */
/*  LoungeSpeakerSexPrompt: it scrolls with the conversation and can never     */
/*  cover a running take. One clip at a time; the card collapses when the      */
/*  queue is clear. No counts, no "N remaining" (AC-9).                        */
/* -------------------------------------------------------------------------- */

/** Coach-facing copy. Neutral by design: the question is about the audio, and
 *  any framing that hints at what the machine or the student thought would
 *  break the blindness this whole lane exists to protect. */
const PROMPT = "Does this moment sound confident?";
const YES = "Confident";
const NO = "Not confident";
/** Existing shipped retry line, reused verbatim rather than minting copy. */
const RETRY = "Couldn't save that just now. Give it another go.";

export default function CoachReflectionQueue({
  isCoach,
  threadLoading,
  active,
}: {
  /** Render gate only — the real boundary is the BE's coach auth. */
  isCoach: boolean;
  /** True while the thread is still fetching — no card above a skeleton. */
  threadLoading: boolean;
  /** False while the Lab owns the screen — stay out of the record flow. */
  active: boolean;
}) {
  const [clips, setClips] = useState<CoachReflectionClip[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"idle" | "sending" | "failed">("idle");
  const fetchedRef = useRef(false);

  // One fetch per mount, once the thread has settled for a coach. [] (queue
  // clear / not a coach / lane unavailable) renders nothing.
  useEffect(() => {
    if (!isCoach || threadLoading || !active || fetchedRef.current) return;
    fetchedRef.current = true;
    let live = true;
    void fetchCoachReflectionQueue().then((c) => {
      if (live) setClips(c);
    });
    return () => {
      live = false;
    };
  }, [isCoach, threadLoading, active]);

  if (!active || !isCoach || !clips || clips.length === 0) return null;
  const clip = clips[idx];
  if (!clip) return null;

  function decide(verdict: CoachVerdict) {
    if (phase === "sending") return;
    setPhase("sending");
    void submitCoachVerdict(clip.clipId, verdict).then((ok) => {
      if (!ok) {
        setPhase("failed");
        return;
      }
      // Straight to the next clip: a verdict is a judgement, not a message
      // needing an acknowledgement, and a coach working a queue wants the
      // next one — not an interstitial between each.
      setPhase("idle");
      setIdx((i) => i + 1);
    });
  }

  return (
    <div
      className="mt-1 w-full rounded-2xl border border-border bg-card px-4 py-4"
      role="group"
      aria-label={PROMPT}
    >
      <div className="flex flex-col gap-3">
        <p className="text-[15px] font-medium text-foreground">{PROMPT}</p>
        <MediaPlayer
          src={clip.audioRef}
          startOffsetMs={clip.startOffsetMs}
          durationMs={clip.durationMs}
        />
        {clip.transcript ? (
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {clip.transcript}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => decide("confident")}
            disabled={phase === "sending"}
            className="rounded-full bg-foreground px-4 py-2 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {YES}
          </button>
          <button
            type="button"
            onClick={() => decide("not_confident")}
            disabled={phase === "sending"}
            className="rounded-full border border-border px-4 py-2 text-[14px] text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {NO}
          </button>
        </div>
        {phase === "failed" ? (
          <p className="text-[12px] text-muted-foreground">{RETRY}</p>
        ) : null}
      </div>
    </div>
  );
}
