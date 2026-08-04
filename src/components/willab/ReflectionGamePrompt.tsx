"use client";

import { useEffect, useRef, useState } from "react";
import MediaPlayer from "@/components/results/MediaPlayer";
import {
  fetchReflectionClips,
  voteReflectionClip,
  type ReflectionClip,
} from "@/services/api/reflectionGame";

/* -------------------------------------------------------------------------- */
/*  ReflectionGamePrompt — the game's one in-thread card (F2 §1, founder-      */
/*  approved flow 2026-08-03)                                                 */
/*                                                                            */
/*  The machine's clipped moment arrives as a QUESTION, never a claim: listen, */
/*  answer, "your coach will review this". All three strings are the founder's */
/*  approved copy, verbatim. By construction this card cannot know whether the */
/*  clip was flagged or a decoy — the payload has no such field — and it       */
/*  renders no counts, no streaks, no progress (AC-9).                        */
/*                                                                            */
/*  IN-THREAD, NOT LAYERED — same rule as LoungeSpeakerSexPrompt: it renders   */
/*  inside the thread's scroll container as ordinary conversation content, so  */
/*  it can never cover a running take (LIVE LOOP). The server caps serves at   */
/*  2/day; this card just shows what one fetch returned, one clip at a time,   */
/*  and collapses when they're done.                                           */
/* -------------------------------------------------------------------------- */

/** Founder-approved copy (2026-08-03) — change only with founder sign-off. */
const QUESTION = "How did this moment land for you?";
const VOTE_BEST = "That's my voice at its best";
const VOTE_NOT = "Not this one";
const INTERSTITIAL = "Thanks for your response. Your coach will review this.";
/** Existing shipped retry line (PieceSwapSheet / IdealTextActions), reused
 *  verbatim rather than minting new copy. */
const RETRY = "Couldn't save that just now. Give it another go.";

export default function ReflectionGamePrompt({
  signedIn,
  threadLoading,
  active,
}: {
  /** The game is signed-in only (votes need an owner). null = still unknown. */
  signedIn: boolean | null;
  /** True while the thread is still fetching — no card above a skeleton. */
  threadLoading: boolean;
  /** False while the Lab owns the screen — stay out of the record flow. */
  active: boolean;
}) {
  const [clips, setClips] = useState<ReflectionClip[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"idle" | "sending" | "thanks" | "failed">(
    "idle"
  );
  const fetchedRef = useRef(false);
  const thanksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (thanksTimer.current) clearTimeout(thanksTimer.current);
    },
    []
  );

  // One fetch per mount, once the thread has settled for a signed-in user.
  // [] (nothing pending / endpoint absent / migrations unrun) renders nothing.
  useEffect(() => {
    if (!signedIn || threadLoading || !active || fetchedRef.current) return;
    fetchedRef.current = true;
    let live = true;
    void fetchReflectionClips().then((c) => {
      if (live) setClips(c);
    });
    return () => {
      live = false;
    };
  }, [signedIn, threadLoading, active]);

  if (!active || !clips || clips.length === 0) return null;
  const clip = clips[idx];
  if (!clip) return null;

  function vote(v: "best" | "not_this") {
    if (phase === "sending" || phase === "thanks") return;
    setPhase("sending");
    void voteReflectionClip(clip.clipId, v).then((ok) => {
      if (!ok) {
        setPhase("failed");
        return;
      }
      setPhase("thanks");
      // The interstitial lingers, then the next clip (if the serve held a
      // second) takes the card; done → the card collapses for this visit.
      thanksTimer.current = setTimeout(() => {
        setPhase("idle");
        setIdx((i) => i + 1);
      }, 2400);
    });
  }

  return (
    <div
      className="mt-1 w-full rounded-2xl border border-border bg-card px-4 py-4"
      role="group"
      aria-label={QUESTION}
    >
      {phase === "thanks" ? (
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {INTERSTITIAL}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[15px] font-medium text-foreground">{QUESTION}</p>
          <MediaPlayer
            src={clip.audioRef}
            startOffsetMs={clip.startOffsetMs}
            durationMs={clip.durationMs}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => vote("best")}
              disabled={phase === "sending"}
              className="rounded-full bg-foreground px-4 py-2 text-[14px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              {VOTE_BEST}
            </button>
            <button
              type="button"
              onClick={() => vote("not_this")}
              disabled={phase === "sending"}
              className="rounded-full border border-border px-4 py-2 text-[14px] text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {VOTE_NOT}
            </button>
          </div>
          {phase === "failed" ? (
            <p className="text-[12px] text-muted-foreground">{RETRY}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
