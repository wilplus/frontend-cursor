"use client";

import { useEffect, useState } from "react";
import { fetchRecordingBand, type RecordingBandState } from "@/services/api/tokens";
import { TOKENS_COPY, formatShortDate, formatTokens } from "./copy";

/* -------------------------------------------------------------------------- */
/*  RecordPriceNote — what the next take costs, ON the trigger, BEFORE it runs */
/*                                                                            */
/*  IT IS A NOTE. It renders text and nothing else: no disabled prop, no       */
/*  callback, no gate. It cannot stop a recording because it is not wired to   */
/*  anything that could, and that is deliberate.                               */
/*                                                                            */
/*  WHY THE ZERO-BALANCE STATE STILL LETS YOU RECORD:                          */
/*                                                                            */
/*  `can_record:false` is the cue to show the offer, NOT permission to block.  */
/*  Takes are charged AFTER transcription, silently and fail-open — they never */
/*  return a payment error — so a take started at zero balance still produces  */
/*  a transcript. Gating the record button on a balance read would break the   */
/*  live record→transcribe→coach→read loop over a billing number, and losing   */
/*  someone's take is worse than any billing inaccuracy. Same reason the       */
/*  length cap is advisory: an overrun uploads and is charged at the band the  */
/*  audio actually landed in.                                                  */
/*                                                                            */
/*  The empty state names BOTH routes: the plan and the renewal date. With a   */
/*  monthly reset, waiting is a legitimate choice, and hiding it to push an    */
/*  upgrade is a dark pattern.                                                 */
/*                                                                            */
/*  No price is ever explained by how well someone spoke. The only thing that  */
/*  moves it is a duration band, chosen before recording.                      */
/* -------------------------------------------------------------------------- */

export default function RecordPriceNote({ className }: { className?: string }) {
  const [band, setBand] = useState<RecordingBandState>({ kind: "unknown" });

  useEffect(() => {
    let cancelled = false;
    void fetchRecordingBand().then((b) => {
      if (!cancelled) setBand(b);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Off (no pricing) or unknown (unreadable) → say nothing. A price we are not
  // sure of is worse than no price, and neither state changes what the button
  // does.
  if (band.kind === "off" || band.kind === "unknown") return null;

  const text =
    band.kind === "priced"
      ? TOKENS_COPY.recordPrice(
          formatTokens(band.price),
          Math.floor(band.maxSeconds / 60)
        )
      : TOKENS_COPY.recordEmpty(formatShortDate(band.periodEndsAt));

  return (
    <p className={className ?? "mt-3 text-center text-[12px] text-muted-foreground"}>
      {text}
    </p>
  );
}
