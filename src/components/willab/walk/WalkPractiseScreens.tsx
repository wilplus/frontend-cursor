"use client";

import { useEffect, type ReactNode } from "react";
import { CHUNK_SHEET_COPY as COPY, WALK_COPY } from "../idealEditCopy";
import WalkLoading from "./WalkLoading";
import type { WalkNav } from "./WalkOverlay";
import WalkMessage from "./WalkMessage";
import WalkPlayer from "./WalkPlayer";
import WalkFooter from "./WalkFooter";
import RecordingBar from "../RecordingBar";
import { maxTries, type WalkStep } from "@/lib/willab/walkPlan";
import type { FeedbackWalkMoment, ReplayTries } from "@/lib/willab/feedbackWalkModel";
import { encourageLine, improvedLine, thanksLine, triesLeft, triesRecorded } from "@/lib/willab/walkPractise";
import type { WalkTry } from "./useWalkPractise";
import type { SayLine } from "@/lib/willab/walkLines";
import type { AiVoiceState } from "@/services/api/aiVoice";
import WalkAiVoice, { aiVoiceShown } from "./WalkAiVoice";
import { WalkSpeakerBubble } from "./WalkThread";
import type { WalkQuotes } from "./useWalkQuote";
import type { WalkQuote } from "@/services/api/walkQuote";
import { oneThingTryWords } from "@/lib/willab/walkThread";

/* -------------------------------------------------------------------------- */
/*  The practise loop's bubbles (build plan D-FW-16; founder lock 2026-10-12,  */
/*  moment and feedback chat, section 2.5): pure, from the step and what the  */
/*  controller (useWalkPractise) holds. Every loop is one thread in the walk's */
/*  chat (founder 2026-10-20, WIL-89): nothing here is a screen of its own.   */
/*                                                                            */
/*    practise    the served line (else Line A) with the words to say, before */
/*                the first try; the try as it records; the recorder in the   */
/*                dock: the one recording bar (N314), the trash then the      */
/*                strip with the red Stop inside it, and Skip under it        */
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
  /** ✕ or the trash on the recorder: the try thrown away, back to the step
   *  that opened the practise. */
  back: () => void;
  forward: () => void;
  /** The answer given to `step` earlier in this walk; null: none yet. */
  answered: (step: WalkStep) => string | null;
  answer: (step: WalkStep, value: string) => void;
  elapsed: number;
  /** The mic is live: Stop shows from here on (N350 item 5). */
  capturing: boolean;
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
  /** The Take's one quote from the speaker's notebook (backend N268). */
  quotes?: WalkQuotes;
};

/** The try's own voice as the speaker's orange bubble (lock 2026-10-12,
 *  section 2.5); the moment's voice until the try is kept. In the One thing
 *  walk its words are the words of the try (the locked prototype
 *  X4gDmGfHH7ivuoRZ9ufiy9, `record()`); in a Take served before N289,
 *  "Practise N" (C7). Either way the player is named "Practise N", so each
 *  try keeps its number (C7, 2026-10-21). */
function TryBubble({
  ctx,
  step,
  moment,
  attempt,
}: {
  ctx: PractiseScreenCtx;
  step: WalkStep;
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
  const said = oneThingTryWords(step, moment);
  return (
    <WalkPlayer
      look="me"
      seed={`try-${moment.index}-${attempt ?? 1}`}
      src={clip?.src ?? null}
      startOffsetMs={clip?.startOffsetMs}
      durationMs={clip?.durationMs}
      label={label}
      words={said ? <span data-walk-try-words>{said}</span> : <span>{label}</span>}
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
 *  2026-10-21). After "Keep my words", its own line (N268). */
function lineAbove(step: WalkStep, moment: FeedbackWalkMoment<unknown>): string | null {
  if (step.kind === "keep") return WALK_COPY.keepWords;
  const served = step.kind === "instruction" ? moment.exercise?.instruction : step.kind === "words" ? moment.clearer?.coachLine : null;
  return served ?? (moment.highest ? null : WALK_COPY.lineA);
}

/** The recorder's footer: the one recording bar (founder 2026-10-31, backend
 *  N314, locked), the trash on the left, then the Take's strip with the red
 *  Stop inside it, and Skip under it as the walk's grey link (the tempo
 *  step's dock). Stop shows once the mic is live, as in the tempo step
 *  (N350 item 5): while the mic opens, the trash and the strip alone. Stop
 *  sends the try; the trash throws it away, nothing uploaded and no try
 *  counted, back to the step that opened the practise, as ✕ does. Was: the
 *  strip, then Skip in the Back style beside a red Stop in the Finish-take
 *  style (N70); Stop from the moment the practise opened. */
function RecorderFooter({ ctx }: { ctx: PractiseScreenCtx }) {
  return (
    <WalkFooter links={[{ label: WALK_COPY.skip, onClick: ctx.skip, testId: "walk-skip" }]}>
      <RecordingBar elapsedMs={ctx.elapsed * 1000} onTrash={ctx.back} onStop={ctx.capturing ? ctx.stop : undefined} />
    </WalkFooter>
  );
}

/** The typing dots while the machine checks the try (founder 2026-10-20:
 *  the dots are the lens's only wait). */
function Checking() {
  return <WalkLoading />;
}

function ImprovedMessage({ ctx, step }: { ctx: PractiseScreenCtx; step: WalkStep }) {
  // The One thing walk's try that lands is its one line (N309 item 1).
  if (step.one) {
    return (
      <WalkMessage>
        <span>{improvedLine(ctx.plan, ctx.at(step), ctx.say)}</span>
      </WalkMessage>
    );
  }
  return (
    <WalkMessage>
      <span>{COPY.titlePraise}</span>
      <span>{improvedLine(ctx.plan, ctx.at(step), ctx.say)}</span>
    </WalkMessage>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10-14" as "14 October", the way the notebook dates a note. */
function dayLabel(on: string | null): string | null {
  const m = on ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(on) : null;
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : null;
}

/** Under a Clearer version's Good job, the speaker's own kept words (backend
 *  N268): the signed line, the words with their date; the first one ever
 *  shown says where it comes from, with "Not here". After "Not here", their
 *  answer and Will's "Noted." in its place. Read only when played again. */
function QuoteMessage({ ctx, step, moment }: { ctx: PractiseScreenCtx; step: WalkStep; moment: FeedbackWalkMoment<unknown> }) {
  const q = ctx.quotes?.quoteOf(moment.index) ?? null;
  if (!q) return null;
  if (ctx.quotes?.notHere) {
    return (
      <>
        <WalkSpeakerBubble>{WALK_COPY.quoteNotHere}</WalkSpeakerBubble>
        <WalkMessage>{WALK_COPY.quoteNotHereNoted}</WalkMessage>
      </>
    );
  }
  return <QuoteShown quote={q} quotes={ctx.quotes} readOnly={Boolean(step.readOnly || step.replay)} />;
}

function QuoteShown({ quote, quotes, readOnly }: { quote: WalkQuote; quotes?: WalkQuotes; readOnly: boolean }) {
  const shown = quotes?.shown;
  useEffect(() => {
    if (!readOnly) shown?.();
  }, [shown, readOnly]);
  const day = dayLabel(quote.said_on);
  return (
    <>
      <WalkMessage>
        <span data-walk-quote-line>{quote.line}</span>
        <span data-walk-quote className="mt-2 block border-t border-foreground/10 pt-2 font-medium">
          “{quote.quote}”
        </span>
        {day ? <span className="block text-[13px] text-muted-foreground">{day}</span> : null}
      </WalkMessage>
      {quote.first && !readOnly ? (
        <p data-walk-quote-first className="m-0 flex flex-wrap items-center gap-x-1 pl-1 text-[13px] text-muted-foreground">
          <span>{WALK_COPY.quoteFirst}</span>
          <button
            type="button"
            data-testid="walk-quote-not-here"
            onClick={quotes?.tapNotHere}
            className="min-h-11 px-2 font-semibold text-accent-foreground underline"
          >
            {WALK_COPY.quoteNotHere}
          </button>
        </p>
      ) : null}
    </>
  );
}

/** The "not yet": the AI clip in the voice Exercise or after a clearer
 *  version (founder 2026-10-18), else the encouragement. */
function EncourageMessage({ ctx, step, moment }: { ctx: PractiseScreenCtx; step: WalkStep; moment: FeedbackWalkMoment<unknown> }) {
  // The One thing walk's one miss: "Close. Once more." (N309 item 1).
  if (step.one) {
    return (
      <WalkMessage>
        <span>{encourageLine(ctx.plan, ctx.at(step), ctx.say)}</span>
      </WalkMessage>
    );
  }
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
  const more = triesLeft(step) && triesRecorded(ctx.plan, ctx.at(step)) < maxTries(step);
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
      // The One thing walk's fix already said what to say (N309): before
      // its first try only "Your words it is…" after "Keep mine". While it
      // records, nothing in the thread: the recording bar in the dock is
      // the only sign (the locked prototype's `record()`).
      if (step.one) {
        return (
          <>
            {firstTry && step.kind === "keep" ? (
              <WalkMessage>
                <span>{WALK_COPY.keepWords}</span>
              </WalkMessage>
            ) : null}
            {current ? null : <TryBubble ctx={ctx} step={step} moment={moment} attempt={step.attempt} />}
          </>
        );
      }
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
          {current ? <LiveTry attempt={step.attempt} /> : <TryBubble ctx={ctx} step={step} moment={moment} attempt={step.attempt} />}
        </>
      );
    case "processing":
      return current ? <Checking /> : null;
    case "improved":
      return (
        <>
          <ImprovedMessage ctx={ctx} step={step} />
          <QuoteMessage ctx={ctx} step={step} moment={moment} />
        </>
      );
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
