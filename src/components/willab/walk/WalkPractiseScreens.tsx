"use client";

import type { ReactNode } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import LoadingState from "../LoadingState";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import RecordingStrip from "./RecordingStrip";
import type { WalkStep, WalkStepKey } from "@/lib/willab/walkPlan";
import type { FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import { encourageLine, improvedLine, thanksLine, triesLeft } from "@/lib/willab/walkPractise";
import type { WalkTry } from "./useWalkPractise";
import type { SayLine } from "@/lib/willab/walkLines";
import type { AiVoiceState } from "@/services/api/aiVoice";
import WalkAiVoice, { AI_VOICE_MAX, aiOnExercise, aiShownBefore, inVoiceLane } from "./WalkAiVoice";

/* -------------------------------------------------------------------------- */
/*  The practise loop's screens (build plan D-FW-16; founder lock 2026-10-12,  */
/*  moment and feedback chat, section 2.5; prototype v31 `openRecorder` and    */
/*  the `try` step): pure, from the step and what the controller              */
/*  (useWalkPractise) holds.                                                  */
/*                                                                            */
/*    practise    the recorder without the slide: "Practise · Slide N" and ✕  */
/*                (back to the walk) on top, a grey bubble with the served    */
/*                line (else Line A), the words to say centred in the rest,   */
/*                the Take's strip (dot, clock, bar) and Skip / red Stop      */
/*    processing  the orange "Practise N" bubble, the breathing mark under it */
/*    improved    "Practise N", then "Good job" and a signed line; Next       */
/*    encourage   "Practise N", then "Practise" and the signed encouragement; */
/*                "Practise again" with the red dot, Skip                     */
/*    thanks      after the third try that is not praise: the signed move-on  */
/*                line; Next                                                  */
/*    late        a read that came late or not at all (O5): Next, and         */
/*                Practise again while a try is left                          */
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
  /** The signed line a screen says, never the one said just before
   *  (D-FW-3). Absent: the plan's own turn. */
  say?: SayLine;
  /** The AI version of the speaker's voice for a voice Exercise moment (N71). */
  aiVoiceOf?: (moment: number) => AiVoiceState | undefined;
  aiVoicePlayed?: (moment: number) => void;
};

const testId = (step: WalkStep) => `walk-screen-${step.key}`;

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
  const tried = ctx.tryOf(moment.index)?.audio ?? null;
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
 *  instruction, a clearer version's `rewriteMove`), else Line A. */
function lineAbove(step: WalkStep, moment: FeedbackWalkMoment<unknown>): string {
  if (step.kind === "instruction") return moment.exercise?.instruction ?? WALK_COPY.lineA;
  if (step.kind === "words") return moment.clearer?.coachLine ?? WALK_COPY.lineA;
  return WALK_COPY.lineA;
}

/** The recorder (lock 2026-10-12, section 2.5): "Practise · Slide N" and ✕,
 *  the bubble, the words centred in the space left, the strip and the pair. */
function Practise(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  const coach = step.kind === "instruction" && moment.exercise?.byCoach === true;
  return (
    <WalkOverlay
      testId={testId(step)}
      where={WALK_COPY.practiseWhere(moment.slideLabel ?? COPY.titlePractise)}
      onClose={ctx.back}
      footer={
        <div data-walk-footer className="flex flex-col px-5 pb-[max(30px,env(safe-area-inset-bottom))] pt-2">
          <RecordingStrip elapsed={ctx.elapsed} />
          {/* The recording screen's pair (N70): Skip as its Back, a red Stop
              as its Finish take, because a practise is one sentence. */}
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
      }
    >
      <WalkMessage coach={coach} wide>
        {lineAbove(step, moment)}
      </WalkMessage>
      <p data-walk-say className="my-auto text-[25px] font-semibold leading-[1.35]">
        {wordsToSay(step, moment)}
      </p>
    </WalkOverlay>
  );
}

/** The try is with the machine: its bubble stays, the mark breathes under it. */
function Processing(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay testId={testId(step)} nav={ctx.nav(step, moment)} onClose={ctx.close}>
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
      <div data-walk-loading className="flex justify-center py-5">
        <LoadingState placement="surface" />
      </div>
    </WalkOverlay>
  );
}

/** The answered footer: "✓ …" over a black Next. */
function Done({ ctx, line }: { ctx: PractiseScreenCtx; line: string }) {
  return (
    <WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }}>
      <p className="m-0 text-center text-[13px] text-muted-foreground">{line}</p>
    </WalkFooter>
  );
}

function Improved(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  const ok = () => {
    ctx.answer(step, "ok");
    ctx.forward();
  };
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ok, testId: "walk-forward" }} />}
    >
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
      <WalkMessage>
        <span>{COPY.titlePraise}</span>
        <span>{improvedLine(ctx.plan, ctx.at(step), ctx.say)}</span>
      </WalkMessage>
    </WalkOverlay>
  );
}

function Encourage(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  const given = ctx.answered(step);
  const again = () => {
    ctx.answer(step, "again");
    ctx.forward();
  };
  const skip = () => {
    ctx.answer(step, "skip");
    ctx.skip();
  };
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={
        given ? (
          <Done ctx={ctx} line={given === "again" ? WALK_COPY.answeredPractised : WALK_COPY.answeredSkipped} />
        ) : (
          <WalkFooter
            dot
            pill={{ label: COPY.pillPractiseAgain, onClick: again, testId: "walk-forward" }}
            links={[{ label: WALK_COPY.skip, onClick: skip, testId: "walk-skip" }]}
          />
        )
      }
    >
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
      {aiInstead(ctx, step, moment) ?? (
        <WalkMessage>
          <span>{COPY.titlePractise}</span>
          <span>{encourageLine(ctx.plan, ctx.at(step), ctx.say)}</span>
        </WalkMessage>
      )}
    </WalkOverlay>
  );
}

/** In the voice Exercise, a ready AI clip takes the encouragement's place,
 *  at most AI_VOICE_MAX per exercise (N71): L4 and L3 the first time after
 *  a try, L5 every later time. Anything else: the locked encouragement. */
function aiInstead(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  const at = ctx.at(step);
  const state = ctx.aiVoiceOf?.(moment.index);
  if (state?.clip?.state !== "ready" || !inVoiceLane(ctx.plan, at, moment.index)) return null;
  const onExercise = aiOnExercise(state);
  const shown = aiShownBefore(ctx.plan, at, moment.index, onExercise);
  if (shown >= AI_VOICE_MAX) return null;
  const first = shown === 0;
  return (
    <WalkAiVoice
      seed={`ai-${moment.index}-${step.attempt ?? 1}`}
      state={state}
      line={first ? WALK_COPY.aiVoiceFirst : WALK_COPY.aiVoiceAgain}
      then={first ? WALK_COPY.aiVoiceNow : undefined}
      onPlay={() => ctx.aiVoicePlayed?.(moment.index)}
    />
  );
}

/** After the third try that is not praise (CM3b A): the signed move-on line
 *  alone, and Next. */
function Thanks(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  const ok = () => {
    ctx.answer(step, "ok");
    ctx.forward();
  };
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ok, testId: "walk-forward" }} />}
    >
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
      <WalkMessage>{thanksLine(ctx.plan, ctx.at(step), ctx.say)}</WalkMessage>
    </WalkOverlay>
  );
}

/** A late or failed read (O5): the try is not reached yet. */
function Late(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={
        <WalkFooter
          pill={{ label: COPY.pagerNext, onClick: ctx.skip, testId: "walk-forward" }}
          links={
            triesLeft(step)
              ? [{ label: COPY.pillPractiseAgain, onClick: ctx.again, testId: "walk-again" }]
              : []
          }
        />
      }
    >
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
    </WalkOverlay>
  );
}

const SCREENS: Partial<
  Record<WalkStepKey, (ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) => ReactNode>
> = {
  practise: Practise,
  processing: Processing,
  improved: Improved,
  encourage: Encourage,
  thanks: Thanks,
  late: Late,
};

/** The practise loop's screen for `step`, or undefined when it is not one. */
export function renderPractiseScreen(
  ctx: PractiseScreenCtx,
  step: WalkStep,
  moment: FeedbackWalkMoment<unknown>,
): ReactNode | undefined {
  const draw = SCREENS[step.key];
  return draw ? draw(ctx, step, moment) : undefined;
}
