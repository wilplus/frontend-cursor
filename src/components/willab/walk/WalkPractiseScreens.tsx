"use client";

import type { ReactNode } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import WalkLoading from "./WalkLoading";
import type { WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import RecordingStrip from "./RecordingStrip";
import { WALK_MAX_TRIES, type WalkStep } from "@/lib/willab/walkPlan";
import type { FeedbackWalkMoment, ReplayTries } from "@/lib/willab/feedbackWalkModel";
import { encourageLine, improvedLine, thanksLine, triesLeft, triesRecorded } from "@/lib/willab/walkPractise";
import type { WalkTry } from "./useWalkPractise";
import type { SayLine } from "@/lib/willab/walkLines";
import type { AiVoiceState } from "@/services/api/aiVoice";
import WalkAiVoice, { aiVoiceShown } from "./WalkAiVoice";

/* -------------------------------------------------------------------------- */
/*  The practise loop's bubbles (build plan D-FW-16; founder lock 2026-10-12,  */
/*  moment and feedback chat, section 2.5): pure, from the step and what the  */
/*  controller (useWalkPractise) holds. Every loop is one thread in the walk's */
/*  chat (founder 2026-10-20, WIL-89): nothing here is a screen of its own.   */
/*                                                                            */
/*    practise    the served line (else Line A) with the words to say, before */
/*                the first try; the try as it records; the recorder in the   */
/*                dock: the Take's strip (dot, clock, bar) and Skip / red Stop */
/*    processing  the typing dots under the try while it is checked          */
/*    improved    "Good job" and a signed line                                */
/*    encourage   the AI clip's short bubble, or the signed encouragement     */
/*    thanks      after the third try that is not praise: the move-on line    */
/*    late        a read that came late or not at all (O5): Practise again    */
/*                while a try is left, else Next                              */
/*                                                                            */
/*  Every word is signed (CHUNK_SHEET_COPY, WALK_COPY, WALK_LINE_BANK). No    */
/*  number, lane or score is drawn: the clock is a clock, the try a position  */
/*  that is never shown (AC-9).                                               */
/* -------------------------------------------------------------------------- */

export type PractiseScreenCtx = {
  plan: readonly WalkStep[];
  at: (step: WalkStep) => number;
  nav: (step: WalkStep, moment: FeedbackWalkMoment<unknown>) => WalkNav;
  close: () => void;
  /** ✕ on the recorder: back to the step that opened the practise. */
  back: () => void;
  forward: () => void;
  /** The answer given to `step` earlier in this walk; null: none yet. */
  answered: (step: WalkStep) => string | null;
  answer: (step: WalkStep, value: string) => void;
  elapsed: number;
  stop: () => void;
  skip: () => void;
  again: () => void;
  tryOf: (moment: number) => WalkTry | undefined;
  /** The tries a practise played again already had, by moment: each try's
   *  voice by its number (walk first, 2026-10-14). */
  replayTries?: Readonly<Record<number, ReplayTries>>;
  /** The signed line a screen says, never the one said just before
   *  (D-FW-3). Absent: the plan's own turn. */
  say?: SayLine;
  /** The AI version of the speaker's voice for a voice Exercise moment (N71). */
  aiVoiceOf?: (moment: number) => AiVoiceState | undefined;
  aiVoicePlayed?: (moment: number) => void;
};

/** The try's own voice as the speaker's orange bubble, "Practise N" above it
 *  (lock 2026-10-12, section 2.5); the moment's voice until the try is kept. */
function TryBubble({
  ctx,
  moment,
  attempt,
}: {
  ctx: PractiseScreenCtx;
  moment: FeedbackWalkMoment<unknown>;
  attempt?: number;
}) {
  const own = ctx.tryOf(moment.index);
  const played = attempt != null ? ctx.replayTries?.[moment.index]?.audios?.[attempt] : undefined;
  const tried = (attempt != null ? own?.audios?.[attempt] : undefined) ?? played ?? own?.audio ?? null;
  const clip = tried
    ? { src: tried.url, startOffsetMs: 0, durationMs: tried.durationMs }
    : moment.clip
      ? { src: moment.clip.src, startOffsetMs: moment.clip.startOffsetMs, durationMs: moment.clip.durationMs }
      : null;
  const label = WALK_COPY.practiseN(attempt ?? 1);
  return (
    <WalkPlayer
      look="me"
      seed={`try-${moment.index}-${attempt ?? 1}`}
      src={clip?.src ?? null}
      startOffsetMs={clip?.startOffsetMs}
      durationMs={clip?.durationMs}
      label={label}
      words={<span>{label}</span>}
    />
  );
}

/** The words a practise asks for: a clearer version's accepted words, the
 *  speaker's own sentence kept, an exercise's passage, or the moment said
 *  again. */
function wordsToSay(step: WalkStep, moment: FeedbackWalkMoment<unknown>): string | undefined {
  if (step.kind === "words") return moment.clearer?.say;
  if (step.kind === "keep") return moment.clearer?.said;
  if (step.kind === "instruction") return moment.exercise?.say;
  return moment.paragraphText;
}

/** The bubble above the words to say: the served line (an exercise's
 *  instruction, a clearer version's `rewriteMove`), else Line A; on the
 *  Take's confident moment itself no Line A, the words alone (founder
 *  2026-10-21). */
function lineAbove(step: WalkStep, moment: FeedbackWalkMoment<unknown>): string | null {
  const served = step.kind === "instruction" ? moment.exercise?.instruction : step.kind === "words" ? moment.clearer?.coachLine : null;
  return served ?? (moment.highest ? null : WALK_COPY.lineA);
}

/** The recorder's footer (N70): the Take's strip, then Skip as its Back
 *  and a red Stop as its Finish take, because a practise is one sentence. */
function RecorderFooter({ ctx }: { ctx: PractiseScreenCtx }) {
  return (
    <div data-walk-footer className="flex flex-col px-5 pb-[max(30px,env(safe-area-inset-bottom))] pt-2">
      <RecordingStrip elapsed={ctx.elapsed} />
      <div className="mt-2.5 flex gap-2.5">
        <button
          type="button"
          data-testid="walk-skip"
          onClick={ctx.skip}
          className="flex h-12 flex-1 items-center justify-center rounded-2xl border-[1.5px] border-border bg-background text-[15px] font-semibold text-foreground"
        >
          {WALK_COPY.skip}
        </button>
        <button
          type="button"
          data-testid="walk-stop"
          onClick={ctx.stop}
          aria-label={COPY.pillStop}
          className="flex h-12 flex-1 shrink-0 items-center justify-center gap-2 rounded-2xl bg-record text-[15px] font-semibold text-record-foreground"
        >
          <span className="h-3 w-3 shrink-0 rounded-[2px] bg-current" aria-hidden />
          {COPY.pillStop}
        </button>
      </div>
    </div>
  );
}

/** The typing dots while the machine checks the try (founder 2026-10-20:
 *  the dots are the lens's only wait). */
function Checking() {
  return <WalkLoading />;
}

function ImprovedMessage({ ctx, step }: { ctx: PractiseScreenCtx; step: WalkStep }) {
  return (
    <WalkMessage>
      <span>{COPY.titlePraise}</span>
      <span>{improvedLine(ctx.plan, ctx.at(step), ctx.say)}</span>
    </WalkMessage>
  );
}

/** The "not yet": the AI clip in the voice Exercise or after a clearer
 *  version (founder 2026-10-18), else the encouragement. */
function EncourageMessage({ ctx, step, moment }: { ctx: PractiseScreenCtx; step: WalkStep; moment: FeedbackWalkMoment<unknown> }) {
  return (
    aiInstead(ctx, step, moment) ?? (
      <WalkMessage>
        <span>{COPY.titlePractise}</span>
        <span>{encourageLine(ctx.plan, ctx.at(step), ctx.say)}</span>
      </WalkMessage>
    )
  );
}

/** In the voice Exercise, a praised moment's practise and after a clearer
 *  version's try (founder 2026-10-18), a ready AI clip takes the
 *  encouragement's place, at most AI_VOICE_MAX per exercise (N71), in the
 *  short bubble: "Close.", a tip, the clip, "Try again." (N120). Anything
 *  else: the locked encouragement. */
function aiInstead(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  const state = ctx.aiVoiceOf?.(moment.index);
  const say = ctx.say;
  const ai = aiVoiceShown(ctx.plan, ctx.at(step), state, say ? (bank) => say(step, bank) : undefined);
  if (!ai || ai === "pending") return null;
  return (
    <WalkAiVoice
      seed={`ai-${moment.index}-${step.attempt ?? 1}`}
      state={state}
      {...ai}
      onPlay={() => ctx.aiVoicePlayed?.(moment.index)}
    />
  );
}

/** After a late read (O5): the white outlined Practise again while a try
 *  is left, the late ones counted, so a machine that never answers still
 *  ends on Next after the third (founder 2026-10-18); then Next. A try the
 *  server could not hear offers both at once, Practise again and Next
 *  (founder 2026-10-21: "record once more or move on"). */
function LateFooter({ ctx, step }: { ctx: PractiseScreenCtx; step: WalkStep }) {
  const more = triesLeft(step) && triesRecorded(ctx.plan, ctx.at(step)) < WALK_MAX_TRIES;
  if (!more) return <WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.skip, testId: "walk-forward" }} />;
  return (
    <WalkFooter
      dot
      outline
      pill={{ label: COPY.pillPractiseAgain, onClick: ctx.again, testId: "walk-again" }}
      second={step.kind === "unheard" ? { label: COPY.pagerNext, onClick: ctx.skip, testId: "walk-forward" } : null}
    />
  );
}

/* ---- the practise thread (founder 2026-10-13, P1 A, P2 A; 2026-10-20) ---- */
/*  Each practise step's own bubbles, piled under the ones before in one      */
/*  part of the chat (FeedbackWalk draws it): the words to say in quotes, the */
/*  try as it records and then its voice, the check, the answer. Only the     */
/*  current step has a footer.                                                */

/** The speaker's try while it records: their orange bubble, a dot pulsing. */
function LiveTry({ attempt }: { attempt?: number }) {
  return (
    <div data-walk-live-try className="flex justify-end">
      <span className="inline-flex items-center gap-2.5 rounded-[22px] bg-primary px-[17px] py-[13px] text-[16px] font-semibold text-primary-foreground">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary-foreground motion-safe:animate-pulse" />
        {WALK_COPY.practiseN(attempt ?? 1)}
      </span>
    </div>
  );
}

/** A practise step's bubbles in the thread. */
export function practiseThreadItem(
  ctx: PractiseScreenCtx,
  step: WalkStep,
  moment: FeedbackWalkMoment<unknown>,
  current: boolean,
  firstTry = true,
): ReactNode {
  switch (step.key) {
    case "practise":
      return (
        <>
          {/* What to say, before the first try only (founder 2026-10-13). */}
          {firstTry ? (
            <WalkMessage coach={step.kind === "instruction" && moment.exercise?.byCoach === true} wide>
              {lineAbove(step, moment) ? <span>{lineAbove(step, moment)}</span> : null}
              <span>
                “<span data-walk-say>{wordsToSay(step, moment)}</span>”
              </span>
            </WalkMessage>
          ) : null}
          {current ? <LiveTry attempt={step.attempt} /> : <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />}
        </>
      );
    case "processing":
      return current ? <Checking /> : null;
    case "improved":
      return <ImprovedMessage ctx={ctx} step={step} />;
    case "encourage":
      return <EncourageMessage ctx={ctx} step={step} moment={moment} />;
    case "thanks":
      return <WalkMessage>{thanksLine(ctx.plan, ctx.at(step), ctx.say)}</WalkMessage>;
    case "late":
      // A try the server could not hear says so; a late read draws nothing.
      return step.kind === "unheard" ? <WalkMessage>{WALK_COPY.unheard}</WalkMessage> : null;
    default:
      return null;
  }
}

/** The try's own footer while `step` is the current one: the recorder, or
 *  Practise again / Next after a late read; none while the try is checked.
 *  Every other step of the thread has the thread's footer (FeedbackWalk). */
export function practiseThreadFooter(ctx: PractiseScreenCtx, step: WalkStep): ReactNode {
  if (step.key === "practise") return <RecorderFooter ctx={ctx} />;
  if (step.key === "late") return <LateFooter ctx={ctx} step={step} />;
  return null;
}
