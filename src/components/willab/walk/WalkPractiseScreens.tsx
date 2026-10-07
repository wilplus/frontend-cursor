"use client";

import type { ReactNode } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import WalkLoading from "./WalkLoading";
import RecordingStrip from "./RecordingStrip";
import type { WalkStep, WalkStepKey } from "@/lib/willab/walkPlan";
import type { FeedbackWalkMoment } from "@/lib/willab/feedbackWalkModel";
import { encourageLine, improvedLine, thanksLine, triesLeft } from "@/lib/willab/walkPractise";
import type { WalkTry } from "./useWalkPractise";

/* -------------------------------------------------------------------------- */
/*  The practise loop's screens (build plan D-FW-16; founder lock 2026-10-06,  */
/*  flow 7), drawn as the dev harness's stills draw them                      */
/*  (src/app/dev/feedback-walk/walkScreens): pure, from the step and what     */
/*  the controller (useWalkPractise) holds.                                   */
/*                                                                            */
/*    practise    no title, no slide bar, no helper text: the words to say    */
/*                and the Take's own recording strip, with Skip               */
/*    processing  the breathing voice mark only                               */
/*    improved    "Good job", the try's voice, a line of the signed bank      */
/*    encourage   "Practise", the try's voice, "It was better, …" or an NX3a  */
/*                line, Continue to the next try, Skip                        */
/*    thanks      after the third try that is not praise: a CM3b line, and    */
/*                the walk moves on                                           */
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
  total: number;
  close: () => void;
  forward: () => void;
  elapsed: number;
  stop: () => void;
  skip: () => void;
  again: () => void;
  tryOf: (moment: number) => WalkTry | undefined;
};

const testId = (step: WalkStep) => `walk-screen-${step.key}`;

/** The voice the screens after a try play: the try's own, else the moment's. */
function TryPlayer({ ctx, moment }: { ctx: PractiseScreenCtx; moment: FeedbackWalkMoment<unknown> }) {
  const tried = ctx.tryOf(moment.index)?.audio ?? null;
  const clip = tried
    ? { src: tried.url, startOffsetMs: 0, durationMs: tried.durationMs }
    : moment.clip
      ? { src: moment.clip.src, startOffsetMs: moment.clip.startOffsetMs, durationMs: moment.clip.durationMs }
      : null;
  if (!clip) return null;
  return (
    <WalkPlayer
      seed={`moment-${moment.index}`}
      src={clip.src}
      startOffsetMs={clip.startOffsetMs}
      durationMs={clip.durationMs}
      label={`${COPY.pagerMoment} ${moment.index + 1} ${COPY.pagerOf} ${ctx.total}`}
    />
  );
}

/** Practising: recording from the start; no title, no slide bar. */
function Practise(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  const say = step.kind === "words" ? moment.clearer?.say : moment.paragraphText;
  return (
    <WalkOverlay
      testId={testId(step)}
      onClose={ctx.close}
      footer={
        <WalkFooter links={[{ label: WALK_COPY.skip, onClick: ctx.skip, testId: "walk-skip" }]}>
          <RecordingStrip elapsed={ctx.elapsed} stopLabel={COPY.pillStop} onStop={ctx.stop} />
        </WalkFooter>
      }
    >
      <p data-walk-say className="m-0 text-[25px] font-semibold leading-[1.35]">
        {say}
      </p>
    </WalkOverlay>
  );
}

function Processing(ctx: PractiseScreenCtx, step: WalkStep) {
  return (
    <WalkOverlay testId={testId(step)} onClose={ctx.close} bare>
      <WalkLoading />
    </WalkOverlay>
  );
}

function Improved(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      title={COPY.titlePraise}
      footer={<WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      <TryPlayer ctx={ctx} moment={moment} />
      <WalkMessage>{improvedLine(ctx.plan, ctx.at(step))}</WalkMessage>
    </WalkOverlay>
  );
}

function Encourage(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      title={COPY.titlePractise}
      footer={
        <WalkFooter
          pill={{ label: COPY.pillContinue, onClick: ctx.forward, testId: "walk-forward" }}
          links={[{ label: WALK_COPY.skip, onClick: ctx.skip, testId: "walk-skip" }]}
        />
      }
    >
      <TryPlayer ctx={ctx} moment={moment} />
      <WalkMessage>{encourageLine(ctx.plan, ctx.at(step))}</WalkMessage>
    </WalkOverlay>
  );
}

/** After the third try that is not praise (CM3b A): the walk moves on.
 *  TODO(D-FW-18): it moves on to "Judgement time!"; until the judgements are
 *  drawn it goes to the plan's next screen. */
function Thanks(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      title={COPY.titlePractise}
      footer={<WalkFooter pill={{ label: COPY.pillContinue, onClick: ctx.forward, testId: "walk-forward" }} />}
    >
      <TryPlayer ctx={ctx} moment={moment} />
      <WalkMessage>{thanksLine(ctx.plan, ctx.at(step))}</WalkMessage>
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
      title={COPY.titlePractise}
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
      <TryPlayer ctx={ctx} moment={moment} />
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
