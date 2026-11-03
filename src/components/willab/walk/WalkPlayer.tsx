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
/*    chip  the speaker's own clip, small: a narrow orange pill on the right   */
/*          with its label above the compact player, when another example   */
/*          is the one to copy (N379 item 1)                                 */
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
  look?: "box" | "me" | "bare" | "chip";
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
      tone={look === "me" || look === "chip" ? "me" : "ink"}
      label={label}
      onError={onError}
    />
  );
  if (look === "bare") return <div data-walk-player>{player}</div>;
  if (look === "chip") {
    return (
      <div
        data-walk-player
        data-walk-chip
        data-row="me"
        className="ml-auto flex w-[62%] flex-col gap-1 rounded-[18px] bg-primary px-3 py-2 text-primary-foreground"
      >
        <span className="text-[13px] font-semibold text-white/[0.85]">{label}</span>
        {player}
      </div>
    );
  }
  return (
    <div
      data-walk-player
      data-walk-me={look === "me" ? "true" : undefined}
      data-row={look === "me" ? "me" : undefined}
      data-bubble={look === "me" ? "" : undefined}
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
