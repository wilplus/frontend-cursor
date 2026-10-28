"use client";

import type { ReactNode } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import { answerAudioUrl, type CallWhich, type Plan } from "@/services/api/plan";
import { PLAN_COPY } from "@/lib/willab/planCopy";
import PlanReadMore from "@/components/legal/PlanReadMore";
import PlanCard, { PlanBar } from "./PlanCard";
import { VoicePlayer } from "./VoicePlayer";
import { recordedPast } from "@/components/willab/afterTake";

/* The plan's rows in the Lounge thread (rules: the-plan.md §1 B, E, G, I;
   prototype version 27). The backend writes them as ordinary rows; their
   metadata says how each is drawn. A plan row with plain words is drawn as
   any of Will's bubbles, so it isn't here. */

export type PlanRowCtx = {
  plan: Plan | null;
  /** The newest "Today, one thing" bubble: the one that keeps Record Take N. */
  newestOne: string | null;
  recordHeld: boolean;
  onSeePlan: () => void;
  onChangePlan: () => void;
  onBook: (which: CallWhich) => void;
  onRecordNext: (arcId: string) => void;
};

type Meta = Record<string, unknown>;

function DayLine({ text }: { text: string }) {
  return <div className="self-center py-1.5 text-[12.5px] text-[#737373]">{text}</div>;
}

function WillBubble({ children }: { children: ReactNode }) {
  return (
    <div data-row="app" data-bubble className="mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-[15px] text-foreground">
      {children}
    </div>
  );
}

function VoiceBubble({ meta }: { meta: Meta }) {
  const id = String(meta.plan_voice);
  const ms = typeof meta.duration_ms === "number" ? meta.duration_ms : null;
  return (
    <div data-row="me" className="ml-auto rounded-2xl bg-[#FF640A] py-2 pl-2 pr-3" data-plan-voice>
      <VoicePlayer src={answerAudioUrl(id)} tone="orange" durationMs={ms} />
    </div>
  );
}

function RecordButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-plan-record
      className="mb-2.5 mt-[18px] flex h-8 w-fit items-center gap-1.5 rounded-full border border-[#E6E6E6] bg-white px-3.5 text-[14px] font-semibold text-[#121212] disabled:opacity-50"
    >
      <span className="h-2 w-2 rounded-full bg-record" aria-hidden />
      {label}
    </button>
  );
}

function OneThing({ message, ctx }: { message: LoungeMessage; ctx: PlanRowCtx }) {
  const meta = (message.metadata ?? {}) as Meta;
  const plan = ctx.plan;
  const arc = typeof meta.arc_id === "string" ? meta.arc_id : null;
  const take = typeof meta.take_index === "number" ? meta.take_index : null;
  const keeps = ctx.newestOne === message.client_id && arc !== null && take !== null;
  return (
    <WillBubble>
      <div className="whitespace-pre-wrap">{message.body}</div>
      {plan?.key_line ? (
        <div className="mb-2 mt-2.5 border-l-[3px] border-[#FF640A] py-0.5 pl-2.5 text-[15px] leading-[1.4]">“{plan.key_line}”</div>
      ) : null}
      {plan?.key_answer_id ? <VoicePlayer src={answerAudioUrl(plan.key_answer_id)} tone="grey" label={PLAN_COPY.howYouSaidIt} /> : null}
      {keeps ? (
        <RecordButton label={PLAN_COPY.recordTake((take ?? 0) + 1)} disabled={ctx.recordHeld} onClick={() => arc && ctx.onRecordNext(arc)} />
      ) : null}
    </WillBubble>
  );
}

function Hello({ message, ctx }: { message: LoungeMessage; ctx: PlanRowCtx }) {
  const meta = (message.metadata ?? {}) as Meta;
  return (
    <>
      {typeof meta.day_line === "string" ? <DayLine text={meta.day_line} /> : null}
      <WillBubble>
        <div className="whitespace-pre-wrap">{message.body}</div>
        {ctx.plan ? (
          <div className="mt-2.5">
            <PlanBar plan={ctx.plan} />
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

function SummaryCall({ ctx }: { ctx: PlanRowCtx }) {
  const call = ctx.plan?.calls.summary ?? null;
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

function Card({ message, ctx }: { message: LoungeMessage; ctx: PlanRowCtx }) {
  const meta = (message.metadata ?? {}) as Meta;
  if (!ctx.plan || meta.plan !== ctx.plan.id) return <></>;
  return <PlanCard plan={ctx.plan} onBook={ctx.onBook} onChange={ctx.onChangePlan} />;
}

/** The plan row's own drawing, or null when the row is drawn as any other. */
export function planRowFor(message: LoungeMessage, ctx: PlanRowCtx | undefined): ReactNode | null {
  const meta = (message.metadata ?? {}) as Meta;
  if (!ctx || typeof meta.plan !== "string") return null;
  if (meta.plan_voice) return <VoiceBubble meta={meta} />;
  if (meta.plan_card) return <Card message={message} ctx={ctx} />;
  if (meta.plan_hello) return <Hello message={message} ctx={ctx} />;
  if (meta.plan_one) return <OneThing message={message} ctx={ctx} />;
  if (meta.plan_summary_call) return <SummaryCall ctx={ctx} />;
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

/** The newest "Today, one thing" row's client id, when it is newer than any
 *  closing message ("Record Take N", N89): the chat has one record button,
 *  in the newest bubble (N167). None once its Take is recorded: the button
 *  waits for that Take's own closing message (N244). */
export function newestOneOf(messages: LoungeMessage[]): string | null {
  const recorded = recordedPast(messages);
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const meta = (messages[i].metadata ?? {}) as Meta;
    if (meta.plan_one) return recorded.has(messages[i].client_id) ? null : messages[i].client_id;
    if (meta.next_take === true) return null;
  }
  return null;
}
