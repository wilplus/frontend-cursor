"use client";

import { useEffect, useState } from "react";
import { WALK_COPY } from "../idealEditCopy";
import TypingDots, { CHUNK_DELAY_MS, TypingGlyph } from "../TypingDots";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import { aiClipLines, linesOf, type WalkBankKey } from "@/lib/willab/walkLines";
import type { WalkStep } from "@/lib/willab/walkPlan";
import type { AiVoiceState } from "@/services/api/aiVoice";

/* -------------------------------------------------------------------------- */
/*  The AI version of your voice in the walk (founder lock 2026-10-12, N71;    */
/*  prototype https://claude.ai/artifact/G8Am3fR3f3SzAdTkwyUGKZ v8).           */
/*                                                                            */
/*  One short grey bubble (founder 2026-10-23, N120: "make it shorter focused */
/*  on one only thing"): a one-word opener, one tip for the problem the clip  */
/*  fixes quoting the speaker's phrase and ending ", like this:", the label   */
/*  (L1) and the one player, then "Your turn."; after a try not yet better    */
/*  "Close." opens it and "Try again." closes it (`aiClipLines`, the signed   */
/*  AI_CLIP_BANK). It never plays by itself. At most three per exercise. The  */
/*  voice Exercise, a clearer version's not yet (founder 2026-10-18, "words   */
/*  first, then voice": the clip says the accepted words) and a praised       */
/*  moment's practise (N122). L2 to L5 and the sentence under the player      */
/*  (L14 to L18) are no longer said.                                          */
/*                                                                            */
/*  The Exercise bubble is there at once (founder 2026-10-15): the Lounge's   */
/*  typing dots alone first, then the bubble lands with the dots where the    */
/*  player goes, and the player takes their place when the clip is ready.    */
/*  No white box: the dots stand on the bubble's own grey.                    */
/* -------------------------------------------------------------------------- */

export const AI_VOICE_MAX = 3;

/** The Exercise screen takes the AI clip in the video's place. */
export const aiOnExercise = (state: AiVoiceState | undefined): boolean =>
  state?.demo === "ai_voice" && state.clip?.state === "ready" && Boolean(state.clip.url);

/** The Exercise screen waits on the clip: the typing dots in the video's
 *  place, from the moment it is asked for (whatever `demo` says meanwhile). */
export const aiPendingOnExercise = (state: AiVoiceState | undefined): boolean =>
  state?.clip?.state === "pending";

const VOICE_KINDS: ReadonlySet<string> = new Set(["instruction", "moment", "words", "keep"]);

/** This "not yet" may bring the AI clip: the practise before it on the same
 *  moment was the voice Exercise's, or a clearer version's (founder
 *  2026-10-18). */
export function inVoiceLane(plan: readonly WalkStep[], at: number, moment: number): boolean {
  for (let i = at - 1; i >= 0; i -= 1) {
    const s = plan[i];
    if (s?.key === "practise" && s.moment === moment) return Boolean(s.kind && VOICE_KINDS.has(s.kind));
  }
  return false;
}

/** The Exercise screen showed this moment's clip: only a voice Exercise has
 *  that screen, so a clearer version's first clip is its first not yet. */
const shownOnExercise = (plan: readonly WalkStep[], moment: number, state: AiVoiceState | undefined): boolean =>
  aiOnExercise(state) && plan.some((s) => s.key === "exVideo" && s.moment === moment);

/** How many AI clips this exercise showed before step `at`. */
export function aiShownBefore(plan: readonly WalkStep[], at: number, moment: number, onExercise: boolean): number {
  let shown = onExercise ? 1 : 0;
  for (let i = 0; i < at; i += 1) {
    const s = plan[i];
    if (s?.key === "encourage" && s.moment === moment) shown += 1;
  }
  return shown;
}

/** What an AI bubble says around its clip: `lead`, the Take's most
 *  confident moment's own line in the opener's place (C2); `line`, the
 *  opener and the tip; `then`, "Your turn." or "Try again.". */
export type AiVoiceLines = { title?: string; lead?: string; line: string; then?: string };

/** The signed line a bubble takes from a bank: the walk's own turn of the
 *  bank for the bubble's screen; without one, the bank's first line. */
export type AiSay = (bank: WalkBankKey) => string;
const firstLine: AiSay = (bank) => linesOf(bank)[0];

/** The AI bubble step `at` shows in place of the locked one, for the screen
 *  and the chat alike: its lines, "pending" while the Exercise screen waits
 *  on the clip, or null (the locked screen). `own`: the Take's most
 *  confident moment's own line, on its Exercise (N109). */
export function aiVoiceShown(
  plan: readonly WalkStep[],
  at: number,
  state: AiVoiceState | undefined,
  say: AiSay = firstLine,
  own: string | null = null,
): AiVoiceLines | "pending" | null {
  const step = plan[at];
  if (!step || step.moment == null) return null;
  if (step.key === "exVideo") {
    if (aiOnExercise(state)) return aiClipLines(say, state?.clip, false, own);
    return aiPendingOnExercise(state) ? "pending" : null;
  }
  if (step.key !== "encourage" || state?.clip?.state !== "ready" || !inVoiceLane(plan, at, step.moment)) return null;
  if (aiShownBefore(plan, at, step.moment, shownOnExercise(plan, step.moment, state)) >= AI_VOICE_MAX) return null;
  // The same clip each time, in the same short bubble: "Close.", a tip,
  // the clip, "Try again." (founder 2026-10-23, N120).
  return aiClipLines(say, state.clip, true);
}

/** The AI bubble step `at` will show once its clip is in: its lines while
 *  the clip is still being made, as when it is ready; null when no clip is
 *  coming (founder 2026-10-20: the chat posts a step once, so it posts the
 *  bubble the clip will make). */
export function aiVoiceComing(
  plan: readonly WalkStep[],
  at: number,
  state: AiVoiceState | undefined,
  say: AiSay = firstLine,
  own: string | null = null,
): AiVoiceLines | null {
  const clip = state?.clip;
  if (!state || !clip || (clip.state !== "ready" && clip.state !== "pending")) return null;
  const asReady: AiVoiceState = { ...state, clip: { ...clip, state: "ready", url: clip.url ?? "coming" } };
  const lines = aiVoiceShown(plan, at, asReady, say, own);
  return lines && lines !== "pending" ? lines : null;
}

/** The bubble's tip is known: the clip is final, or the server has named
 *  what it fixes (N120). The chat posts the bubble once, so it waits for
 *  this, never posting a bubble the walk will word differently. */
export const aiTipKnown = (state: AiVoiceState | undefined): boolean =>
  state?.clip?.state !== "pending" || Boolean(state.clip.problem);

/** The bubbles that already landed in this page's life: a screen drawn
 *  again (the stage's leaving copy, ‹ and ›) shows its bubble at once. */
const landed = new Set<string>();

/** The two beats of the Exercise bubble's arrival: the typing dots alone,
 *  then the bubble, once per seed. */
function useArrival(seed: string, arrive: boolean): boolean {
  const [shown, setShown] = useState(!arrive || landed.has(seed));
  useEffect(() => {
    if (shown) return;
    const timer = setTimeout(() => {
      landed.add(seed);
      setShown(true);
    }, CHUNK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shown, seed]);
  return shown;
}

export default function WalkAiVoice({
  seed,
  state,
  title,
  lead,
  line,
  then,
  arrive = false,
  onPlay,
}: {
  seed: string;
  lead?: string;
  /** "Exercise" on the Exercise screen. */
  title?: string;
  state: AiVoiceState | undefined;
  line: string;
  then?: string;
  /** The Exercise screen: the typing dots first, then the bubble lands. */
  arrive?: boolean;
  onPlay?: () => void;
}) {
  const clip = state?.clip;
  const shown = useArrival(seed, arrive);
  if (!shown) {
    return (
      <div data-walk-ai-typing className="flex">
        <TypingDots label={WALK_COPY.aiVoiceLabel} />
      </div>
    );
  }
  return (
    <WalkMessage wide className={arrive ? "walk-bubble-in" : undefined}>
      {title ? <span>{title}</span> : null}
      {lead ? <span>{lead}</span> : null}
      <span>{line}</span>
      <span data-walk-ai-voice className="mt-2 flex items-center gap-[7px] text-[14px] font-semibold">
        <span
          aria-hidden
          className="inline-flex h-[17px] w-[17px] items-center justify-center rounded-[5px] bg-foreground text-[9.5px] font-bold text-background"
        >
          {WALK_COPY.aiVoiceBadge}
        </span>
        {WALK_COPY.aiVoiceLabel}
      </span>
      {clip?.state === "ready" && clip.url ? (
        <div onClickCapture={onPlay} className="mt-2">
          <WalkPlayer look="bare" seed={seed} src={clip.url} durationMs={clip.durationMs} label={WALK_COPY.aiVoiceLabel} />
        </div>
      ) : (
        <div data-walk-ai-waiting className="mt-2 flex min-h-8 items-center justify-center">
          <TypingGlyph />
        </div>
      )}
      {then ? <span className="mt-2.5">{then}</span> : null}
    </WalkMessage>
  );
}
