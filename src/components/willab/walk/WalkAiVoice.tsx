"use client";

import { CHUNK_SHEET_COPY, WALK_COPY } from "../idealEditCopy";
import LoadingState from "../LoadingState";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import type { WalkStep } from "@/lib/willab/walkPlan";
import { missLine } from "@/lib/willab/walkPractise";
import type { AiVoiceState } from "@/services/api/aiVoice";

/* -------------------------------------------------------------------------- */
/*  The AI version of your voice in the walk (founder lock 2026-10-12, N71;    */
/*  prototype https://claude.ai/artifact/G8Am3fR3f3SzAdTkwyUGKZ v8).           */
/*                                                                            */
/*  One grey app bubble: a signed line, the label (L1) and the one player,    */
/*  audio only, never the words; it never plays by itself. At most three per  */
/*  exercise. Only the voice Exercise: never praise, never a clearer version.*/
/*  The first "not yet" always says L4 then L3 (founder 2026-10-13, P3 B).    */
/* -------------------------------------------------------------------------- */

export const AI_VOICE_MAX = 3;

/** The Exercise screen takes the AI clip in the video's place. */
export const aiOnExercise = (state: AiVoiceState | undefined): boolean =>
  state?.demo === "ai_voice" && state.clip?.state === "ready" && Boolean(state.clip.url);

/** The Exercise screen waits on the clip: the breathing mark in the video's place. */
export const aiPendingOnExercise = (state: AiVoiceState | undefined): boolean =>
  state?.demo === "ai_voice" && state.clip?.state === "pending";

/** This "not yet" is in the voice Exercise lane: the practise before it on
 *  the same moment was the exercise's. */
export function inVoiceLane(plan: readonly WalkStep[], at: number, moment: number): boolean {
  for (let i = at - 1; i >= 0; i -= 1) {
    const s = plan[i];
    if (s?.key === "practise" && s.moment === moment) return s.kind === "instruction" || s.kind === "moment";
  }
  return false;
}

/** How many AI clips this exercise showed before step `at`. */
export function aiShownBefore(plan: readonly WalkStep[], at: number, moment: number, onExercise: boolean): number {
  let shown = onExercise ? 1 : 0;
  for (let i = 0; i < at; i += 1) {
    const s = plan[i];
    if (s?.key === "encourage" && s.moment === moment) shown += 1;
  }
  return shown;
}

/** What an AI bubble says around its clip; `lead` is the reading's line a
 *  "not yet" opens with (founder 2026-10-13, B). */
export type AiVoiceLines = { title?: string; lead?: string; line: string; then?: string };

/** The AI bubble step `at` shows in place of the locked one, for the screen
 *  and the chat alike: its lines, "pending" while the Exercise screen waits
 *  on the clip, or null (the locked screen). */
export function aiVoiceShown(
  plan: readonly WalkStep[],
  at: number,
  state: AiVoiceState | undefined,
): AiVoiceLines | "pending" | null {
  const step = plan[at];
  if (!step || step.moment == null) return null;
  if (step.key === "exVideo") {
    if (aiOnExercise(state)) return { title: CHUNK_SHEET_COPY.titleExercise, line: WALK_COPY.aiVoiceExercise, then: WALK_COPY.aiVoiceNow };
    return aiPendingOnExercise(state) ? "pending" : null;
  }
  if (step.key !== "encourage" || state?.clip?.state !== "ready" || !inVoiceLane(plan, at, step.moment)) return null;
  if (aiShownBefore(plan, at, step.moment, aiOnExercise(state)) >= AI_VOICE_MAX) return null;
  // The first "not yet" says L4 and L3, even after the Exercise's own clip;
  // every later one L5 (founder 2026-10-13, P3 B).
  // It opens with the line for the reading that went the wrong way, when one
  // clearly did (founder 2026-10-13, B).
  const lead = missLine(plan, at) ?? undefined;
  return aiShownBefore(plan, at, step.moment, false) === 0
    ? { lead, line: WALK_COPY.aiVoiceFirst, then: WALK_COPY.aiVoiceNow }
    : { lead, line: WALK_COPY.aiVoiceAgain };
}

export default function WalkAiVoice({
  seed,
  state,
  title,
  lead,
  line,
  then,
  onPlay,
}: {
  seed: string;
  lead?: string;
  /** "Exercise" on the Exercise screen. */
  title?: string;
  state: AiVoiceState | undefined;
  line: string;
  then?: string;
  onPlay?: () => void;
}) {
  const clip = state?.clip;
  return (
    <WalkMessage wide>
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
        <div className="flex justify-center py-3">
          <LoadingState placement="surface" />
        </div>
      )}
      {then ? <span className="mt-2.5">{then}</span> : null}
    </WalkMessage>
  );
}
