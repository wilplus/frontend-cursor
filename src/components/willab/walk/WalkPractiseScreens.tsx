"use client";

import type { ReactNode } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import LoadingState from "../LoadingState";
import WalkOverlay, { type WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import RecordingStrip from "./RecordingStrip";
import { WALK_MAX_TRIES, type WalkStep, type WalkStepKey } from "@/lib/willab/walkPlan";
import type { FeedbackWalkMoment, ReplayTries } from "@/lib/willab/feedbackWalkModel";
import { encourageLine, improvedLine, thanksLine, triesLeft, triesRecorded } from "@/lib/willab/walkPractise";
import type { WalkTry } from "./useWalkPractise";
import type { SayLine } from "@/lib/willab/walkLines";
import type { AiVoiceState } from "@/services/api/aiVoice";
import WalkAiVoice, { aiVoiceShown } from "./WalkAiVoice";

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
/*                the white outlined "Practise again" with the red dot alone  */
/*                (founder 2026-10-18: Next only after a Good job or the     */
/*                third try)                                                  */
/*    thanks      after the third try that is not praise: the signed move-on  */
/*                line; Next                                                  */
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
 *  instruction, a clearer version's `rewriteMove`), else Line A. */
function lineAbove(step: WalkStep, moment: FeedbackWalkMoment<unknown>): string {
  if (step.kind === "instruction") return moment.exercise?.instruction ?? WALK_COPY.lineA;
  if (step.kind === "words") return moment.clearer?.coachLine ?? WALK_COPY.lineA;
  return WALK_COPY.lineA;
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

/** The recorder (lock 2026-10-12, section 2.5): "Practise · Slide N" and ✕,
 *  the bubble, the words centred in the space left, the strip and the pair. */
function Practise(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  const coach = step.kind === "instruction" && moment.exercise?.byCoach === true;
  return (
    <WalkOverlay
      testId={testId(step)}
      where={WALK_COPY.practiseWhere(moment.slideLabel ?? COPY.titlePractise)}
      onClose={ctx.back}
      footer={<RecorderFooter ctx={ctx} />}
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

/** The breathing mark while the machine checks the try. */
function Checking() {
  return (
    <div data-walk-loading className="flex justify-center py-5">
      <LoadingState placement="surface" />
    </div>
  );
}

/** The try is with the machine: its bubble stays, the mark breathes under it. */
function Processing(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay testId={testId(step)} nav={ctx.nav(step, moment)} onClose={ctx.close}>
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
      <Checking />
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

/** A footer whose only action is Next, after `step` is answered "ok". */
function NextFooter({ ctx, step }: { ctx: PractiseScreenCtx; step: WalkStep }) {
  const ok = () => {
    ctx.answer(step, "ok");
    ctx.forward();
  };
  return <WalkFooter pill={{ label: COPY.pagerNext, onClick: ok, testId: "walk-forward" }} />;
}

function ImprovedMessage({ ctx, step }: { ctx: PractiseScreenCtx; step: WalkStep }) {
  return (
    <WalkMessage>
      <span>{COPY.titlePraise}</span>
      <span>{improvedLine(ctx.plan, ctx.at(step), ctx.say)}</span>
    </WalkMessage>
  );
}

function Improved(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={<NextFooter ctx={ctx} step={step} />}
    >
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
      <ImprovedMessage ctx={ctx} step={step} />
    </WalkOverlay>
  );
}

/** The white outlined "Practise again" alone under a "not yet" (founder
 *  2026-10-18): Next comes after a Good job or the third try. The recorder
 *  keeps its Skip. */
function EncourageFooter({ ctx, step }: { ctx: PractiseScreenCtx; step: WalkStep }) {
  const given = ctx.answered(step);
  const again = () => {
    ctx.answer(step, "again");
    ctx.forward();
  };
  if (given) return <Done ctx={ctx} line={given === "again" ? WALK_COPY.answeredPractised : WALK_COPY.answeredSkipped} />;
  return <WalkFooter dot outline pill={{ label: COPY.pillPractiseAgain, onClick: again, testId: "walk-forward" }} />;
}

/** The "not yet": the AI clip in the voice Exercise, else the encouragement. */
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

function Encourage(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={<EncourageFooter ctx={ctx} step={step} />}
    >
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
      <EncourageMessage ctx={ctx} step={step} moment={moment} />
    </WalkOverlay>
  );
}

/** In the voice Exercise, a ready AI clip takes the encouragement's place,
 *  at most AI_VOICE_MAX per exercise (N71): L4 and L3 the first time after
 *  a try, L5 every later time. Anything else: the locked encouragement. */
function aiInstead(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  const state = ctx.aiVoiceOf?.(moment.index);
  const ai = aiVoiceShown(ctx.plan, ctx.at(step), state);
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

/** After the third try that is not praise (CM3b A): the signed move-on line
 *  alone, and Next. */
function Thanks(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay
      testId={testId(step)}
      nav={ctx.nav(step, moment)}
      onClose={ctx.close}
      footer={<NextFooter ctx={ctx} step={step} />}
    >
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
      <WalkMessage>{thanksLine(ctx.plan, ctx.at(step), ctx.say)}</WalkMessage>
    </WalkOverlay>
  );
}

/** After a late read (O5): the white outlined Practise again while a try
 *  is left, the late ones counted, so a machine that never answers still
 *  ends on Next after the third (founder 2026-10-18); then Next. */
function LateFooter({ ctx, step }: { ctx: PractiseScreenCtx; step: WalkStep }) {
  const more = triesLeft(step) && triesRecorded(ctx.plan, ctx.at(step)) < WALK_MAX_TRIES;
  if (!more) return <WalkFooter pill={{ label: COPY.pagerNext, onClick: ctx.skip, testId: "walk-forward" }} />;
  return <WalkFooter dot outline pill={{ label: COPY.pillPractiseAgain, onClick: ctx.again, testId: "walk-again" }} />;
}

/** A late or failed read (O5): the try is not reached yet. */
function Late(ctx: PractiseScreenCtx, step: WalkStep, moment: FeedbackWalkMoment<unknown>) {
  return (
    <WalkOverlay testId={testId(step)} nav={ctx.nav(step, moment)} onClose={ctx.close} footer={<LateFooter ctx={ctx} step={step} />}>
      <TryBubble ctx={ctx} moment={moment} attempt={step.attempt} />
    </WalkOverlay>
  );
}

/* ---- the voice Exercise's thread (founder 2026-10-13, P1 A, P2 A) -------- */
/*  Each practise step's own bubbles, piled under the ones before in one      */
/*  overlay (FeedbackWalk draws it): the words to say in quotes, the try as   */
/*  it records and then its voice, the check, the answer. Only the current    */
/*  step has a footer.                                                        */

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
              <span>{lineAbove(step, moment)}</span>
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
    default:
      return null;
  }
}

/** The thread's footer while `step` is the current one. */
export function practiseThreadFooter(ctx: PractiseScreenCtx, step: WalkStep): ReactNode {
  switch (step.key) {
    case "practise":
      return <RecorderFooter ctx={ctx} />;
    case "improved":
    case "thanks":
      return <NextFooter ctx={ctx} step={step} />;
    case "encourage":
      return <EncourageFooter ctx={ctx} step={step} />;
    case "late":
      return <LateFooter ctx={ctx} step={step} />;
    default:
      return null;
  }
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
