"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import SnippetWavePlayer from "../SnippetWavePlayer";

/* -------------------------------------------------------------------------- */
/*  WalkPlayer — the one player, in three looks (founder lock 2026-10-06, "one */
/*  player"; founder lock 2026-10-12, moment and feedback chat, section 1)     */
/*                                                                            */
/*    box   the plain white box with the voice in its ink tone (the paragraph */
/*          sheet, the coach panel)                                           */
/*    me    the speaker's own clip in the lens: an orange bubble on the right, */
/*          90% wide, 22px corners, white play button and white bars; the     */
/*          speaker's words above it where the feedback is about them (the    */
/*          clearer version, with <s> around what goes) or the try's label    */
/*    bare  the voice alone, for another speaker's clip inside a grey bubble  */
/*                                                                            */
/*  It is the app's own clip player (SnippetWavePlayer), so the walk does not */
/*  grow a second one.                                                        */
/* -------------------------------------------------------------------------- */

export default function WalkPlayer({
  seed,
  src,
  startOffsetMs,
  durationMs,
  label,
  words,
  look = "box",
  onError,
}: {
  seed: string;
  src: string | null;
  startOffsetMs?: number | null;
  durationMs?: number | null;
  /** The accessible name of the clip. */
  label: string;
  words?: ReactNode;
  look?: "box" | "me" | "bare";
  /** Told when the clip errors; a fresh link is asked of the host's
   *  MediaRefreshProvider on its own. */
  onError?: () => void;
}) {
  const player = (
    <SnippetWavePlayer
      seed={seed}
      src={src}
      startOffsetMs={startOffsetMs}
      durationMs={durationMs}
      size={look === "me" ? "default" : "compact"}
      tone={look === "me" ? "me" : "ink"}
      label={label}
      onError={onError}
    />
  );
  if (look === "bare") return <div data-walk-player>{player}</div>;
  return (
    <div
      data-walk-player
      data-walk-me={look === "me" ? "true" : undefined}
      className={cn(
        "flex flex-col",
        look === "me"
          ? "ml-auto w-[90%] gap-2 rounded-[22px] bg-primary px-[17px] py-[13px] text-primary-foreground"
          : "gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-3",
      )}
    >
      {words ? (
        <div
          className={cn(
            "leading-[1.45] [&_s]:decoration-[1.5px]",
            look === "me" ? "text-[16px] [&_s]:text-white/[0.72]" : "text-[16.5px] leading-[1.55] [&_s]:text-muted-foreground",
          )}
        >
          {words}
        </div>
      ) : null}
      {player}
    </div>
  );
}
