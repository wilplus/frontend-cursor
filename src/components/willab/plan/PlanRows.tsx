"use client";

import type { ReactNode } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { answerAudioUrl, type CallWhich, type Plan, type PlanBarData } from "@/services/api/plan";
import { PLAN_COPY } from "@/lib/willab/planCopy";
import PlanReadMore from "@/components/legal/PlanReadMore";
import PlanCard, { PlanBar, usePlanCallsOn } from "./PlanCard";
import { VoicePlayer } from "./VoicePlayer";
import { recordedPast } from "@/components/willab/afterTake";
import { TypingGlyph } from "@/components/willab/TypingDots";
import { wayInRowFor, type WayInRowCtx } from "./WayIn";
import { DayLine } from "./dayLines";

/* The plan's rows in the Lounge thread (rules: the-plan.md §1 B, E, G, I;
   prototype version 27). The backend writes them as ordinary rows; their
   metadata says how each is drawn. A plan row with plain words is drawn as
   any of Will's bubbles, so it isn't here. */

export type PlanRowCtx = WayInRowCtx & {
  plan: Plan | null;
  onSeePlan: () => void;
  onChangePlan: () => void;
  onBook: (which: CallWhich) => void;
};

type Meta = Record<string, unknown>;


function WillBubble({ children }: { children: ReactNode }) {
  return (
    <div data-row="app" data-bubble className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
      {children}
    </div>
  );
}

/** The speaker's voice answer, and under it the words Will heard, as a
 *  phone's voice message writes them out (N275): they see what was taken. */
function VoiceBubble({ message }: { message: LoungeMessage }) {
  const meta = (message.metadata ?? {}) as Meta;
  const id = String(meta.plan_voice);
  const ms = typeof meta.duration_ms === "number" ? meta.duration_ms : null;
  const words = (message.body ?? "").trim();
  return (
    <div data-row="me" className="ml-auto max-w-[85%] rounded-2xl bg-[#FF640A] py-2 pl-2 pr-3" data-plan-voice>
      <VoicePlayer src={answerAudioUrl(id)} tone="orange" durationMs={ms} />
      {words ? (
        <div data-plan-voice-words className="mt-1.5 whitespace-pre-wrap pl-1 text-[15px] leading-[1.4] text-white">
          {words}
        </div>
      ) : null}
    </div>
  );
}

/** A tap on the 1 to 10 scale, said back without its number (backend N339):
 *  the speaker's turn, a small grey bubble on their side, a lock and the
 *  backend's word ("Answered"). The lock says the number stays hidden; the
 *  number itself is never in the row (N178). */
function LockedAnswer({ message }: { message: LoungeMessage }) {
  return (
    <div
      data-row="me"
      data-plan-answered
      className="ml-auto inline-flex w-max items-center gap-1.5 rounded-full border-[1.5px] border-[#E6E6E6] bg-white py-1 pl-2.5 pr-3 text-[13.5px] text-[#737373]"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      {message.body}
    </div>
  );
}

/** The answer just sent, while it is heard: its bubble at once, playing
 *  from the phone, and the dots where its words will be (N275). */
export function PendingVoice({ src, durationMs }: { src: string; durationMs: number }) {
  return (
    <div data-row="me" className="ml-auto max-w-[85%] rounded-2xl bg-[#FF640A] py-2 pl-2 pr-3" data-plan-voice-pending>
      <VoicePlayer src={src} tone="orange" durationMs={durationMs} />
      <TypingGlyph className="mb-1 mt-2.5 pl-1.5 [&>span]:bg-white/80" />
    </div>
  );
}

/** A call just booked: Will's "Booked: {when}." at once, while the booking
 *  is saved; the thread's own row takes its place (N281). */
export function PendingBooked({ text }: { text: string }) {
  return (
    <div data-row="app" data-bubble className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground" data-plan-booked-pending>
      {text}
    </div>
  );
}

/** Today's one thing: its words, the key line and "How you said it". No
 *  bubble carries a button (N294 item 7): while it is the newest, its
 *  "Record Take N" stands under the chat, alone (`newestOneOf`,
 *  `RecordTakeButton`). */
function OneThing({ message, ctx }: { message: LoungeMessage; ctx: PlanRowCtx }) {
  const plan = ctx.plan;
  return (
    <WillBubble>
      <div className="whitespace-pre-wrap">{message.body}</div>
      {plan?.key_line ? (
        <div className="mb-2 mt-2.5 border-l-[3px] border-[#FF640A] py-0.5 pl-2.5 text-[15px] leading-[1.4]">“{plan.key_line}”</div>
      ) : null}
      {plan?.key_answer_id ? <VoicePlayer src={answerAudioUrl(plan.key_answer_id)} tone="grey" label={PLAN_COPY.howYouSaidIt} /> : null}
    </WillBubble>
  );
}

/** The bar a row carries, as the backend drew it when it wrote the row. */
function barOf(value: unknown): PlanBarData | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Partial<PlanBarData>;
  return typeof b.level_name === "string" && typeof b.marks === "number" ? (b as PlanBarData) : null;
}

/** The hello (G4, G5; N564): "Hi {name}, good to see you back!", the plan's
 *  bar (the level's name and its four marks, as when it was written) and
 *  "See your plan". */
function Hello({ message, ctx }: { message: LoungeMessage; ctx: PlanRowCtx }) {
  const meta = (message.metadata ?? {}) as Meta;
  const bar = barOf(meta.plan_bar) ?? ctx.plan?.bar ?? null;
  return (
    <>
      {typeof meta.day_line === "string" ? <DayLine text={meta.day_line} /> : null}
      <WillBubble>
        <div className="whitespace-pre-wrap">{message.body}</div>
        {bar ? (
          <div className="mt-2.5" data-plan-hello-bar>
            <PlanBar bar={bar} />
          </div>
        ) : null}
        <button
          type="button"
          onClick={ctx.onSeePlan}
          className="-mx-2 -mb-1.5 block px-2 py-3 text-[13px] text-[#6B6B6B] underline underline-offset-[3px]"
        >
          {PLAN_COPY.seeYourPlan}
        </button>
      </WillBubble>
    </>
  );
}

/** Will's ask for the plan's own yes: his words, then Read more (N211). The
 *  two buttons are the footer's. */
function ConsentAsk({ message }: { message: LoungeMessage }) {
  return (
    <WillBubble>
      <div className="whitespace-pre-wrap">
        {message.body} <PlanReadMore />
      </div>
    </WillBubble>
  );
}

/** The summary call at the plan's end (I2): one of the plan's calls, hidden
 *  with them (N315); a row written while they were on draws nothing. */
function SummaryCall({ ctx }: { ctx: PlanRowCtx }) {
  const callsOn = usePlanCallsOn();
  const call = ctx.plan?.calls.summary ?? null;
  if (!callsOn) return null;
  return (
    <div className="flex w-full flex-col gap-2.5 rounded-[18px] border border-[#E6E6E6] bg-white p-4 shadow-[0_6px_20px_-14px_rgba(0,0,0,0.25)]" data-plan-summary-call>
      <div className="text-[18px] font-semibold">{PLAN_COPY.yourSummaryCall}</div>
      {call ? <div className="text-[14.5px] leading-[1.4] text-[#4A4A4A]">{call.text}</div> : null}
      <div className="text-[14.5px] leading-[1.4] text-[#4A4A4A]">{PLAN_COPY.summaryCallWhat}</div>
      {call ? null : (
        <button
          type="button"
          onClick={() => ctx.onBook("summary")}
          className="flex h-12 w-full items-center justify-center rounded-full bg-foreground text-[15px] font-medium text-background"
        >
          {PLAN_COPY.chooseDate}
        </button>
      )}
    </div>
  );
}

/** The plan's bar in the chat after the walk, under the goodbye (N319 item
 *  7, N564 item 3): Will's grey bubble with the level's name and its four
 *  marks, as the backend drew them when it wrote the row. A row from before
 *  N564 ("{n} of {total} practices done.") keeps its words, without a bar. */
function Progress({ message }: { message: LoungeMessage }) {
  const meta = (message.metadata ?? {}) as Meta;
  const bar = barOf(meta.bar);
  return (
    <div data-row="app" data-bubble data-plan-progress className="mr-auto flex min-w-[70%] max-w-[85%] flex-col gap-2 rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
      {bar ? <PlanBar bar={bar} /> : <div>{message.body}</div>}
    </div>
  );
}

function Card({ message, ctx }: { message: LoungeMessage; ctx: PlanRowCtx }) {
  const meta = (message.metadata ?? {}) as Meta;
  if (!ctx.plan || meta.plan !== ctx.plan.id) return <></>;
  return <PlanCard plan={ctx.plan} onBook={ctx.onBook} onChange={ctx.onChangePlan} />;
}

/** The plan row's own drawing, or null when the row is drawn as any other. */
export function planRowFor(message: LoungeMessage, ctx: PlanRowCtx | undefined): ReactNode | null {
  const meta = (message.metadata ?? {}) as Meta;
  if (!ctx || typeof meta.plan !== "string") return null;
  // The speaking way in's beats (backend N572, N592): its own drawing, or
  // any of Will's bubbles.
  if (typeof meta.way_in === "string") return wayInRowFor(message, ctx);
  if (meta.plan_voice) return <VoiceBubble message={message} />;
  if (meta.plan_answered === "rating") return <LockedAnswer message={message} />;
  if (meta.plan_card) return <Card message={message} ctx={ctx} />;
  if (meta.plan_hello) return <Hello message={message} ctx={ctx} />;
  if (meta.plan_one) return <OneThing message={message} ctx={ctx} />;
  if (meta.plan_summary_call) return <SummaryCall ctx={ctx} />;
  if (meta.plan_progress) return <Progress message={message} />;
  if (meta.plan_ask === "consent") return <ConsentAsk message={message} />;
  if (typeof meta.day_line === "string") {
    return (
      <>
        <DayLine text={meta.day_line} />
        <WillBubble>
          <div className="whitespace-pre-wrap">{message.body}</div>
        </WillBubble>
      </>
    );
  }
  return null;
}

/** The Take the newest "Today, one thing" row offers, when that row is newer
 *  than any closing message ("Record Take N", N89): the chat has one record
 *  button, and while that bubble is the newest it is "Record Take N" under
 *  the chat, alone, the plan's black button with the red dot (N294 item 7,
 *  N296 state 4; was inside the bubble, N167). None once a newer Take is
 *  recorded, in any project (N244, N251), or when the row names no Take. */
export function newestOneOf(messages: LoungeMessage[]): { arcId: string; takeIndex: number } | null {
  const recorded = recordedPast(messages);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const meta = (messages[i].metadata ?? {}) as Meta;
    if (meta.plan_one) {
      if (recorded.has(messages[i].client_id)) return null;
      return typeof meta.arc_id === "string" && typeof meta.take_index === "number" ? { arcId: meta.arc_id, takeIndex: meta.take_index } : null;
    }
    if (meta.next_take === true) return null;
  }
  return null;
}
