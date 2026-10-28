"use client";

import { useState } from "react";
import { answerAudioUrl, type CallWhich, type Plan } from "@/services/api/plan";
import { PLAN_COPY } from "@/lib/willab/planCopy";
import { VoicePlayer } from "./VoicePlayer";

/* The plan card (rules: docs/flows/the-plan.md §1 E; prototype version 27,
   planCard): the level, its line in the speaker's own words and voice, "Why
   this line?", then the plan in bullet points with the two calls. One
   typeface, three sizes; text colours that read on white (N161, N167). */

export function PlanList({ plan, onBook }: { plan: Plan; onBook?: (which: CallWhich) => void }) {
  return (
    <ul className="m-0 flex list-disc flex-col gap-1.5 pl-[18px] text-[15px] leading-[1.4] marker:text-[#9A9A9A]">
      <li>{plan.every_day ? PLAN_COPY.everyDay : PLAN_COPY.threeTimes(plan.days_text)}</li>
      {plan.pace_week ? <li>{PLAN_COPY.paceGame}</li> : null}
      <CallItem name={PLAN_COPY.kickoffCall} call={plan.calls.kickoff} onBook={onBook && (() => onBook("kickoff"))} />
      <li>
        {PLAN_COPY.yourDeadline}: <span className="font-semibold text-[#C2410C]">{plan.deadline_short}</span>
      </li>
      <CallItem name={PLAN_COPY.summaryCall} call={plan.calls.summary} onBook={onBook && (() => onBook("summary"))} />
    </ul>
  );
}

function CallItem({ name, call, onBook }: { name: string; call: Plan["calls"]["kickoff"]; onBook?: () => void }) {
  if (call) {
    return (
      <li>
        {name}: <span className="font-semibold text-[#1F7A4A]">{call.short}</span>
      </li>
    );
  }
  return (
    <li>
      {name}:{" "}
      <button
        type="button"
        onClick={onBook}
        disabled={!onBook}
        className="-mx-2 px-2 py-3 font-semibold text-[#121212] underline underline-offset-[3px]"
        data-plan-book
      >
        {PLAN_COPY.book}
      </button>
    </li>
  );
}

export function KeyLine({ plan }: { plan: Plan }) {
  const [why, setWhy] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      {plan.key_line ? (
        <div className="border-l-[3px] border-[#FF640A] py-0.5 pl-2.5 text-[15px] leading-[1.4]">“{plan.key_line}”</div>
      ) : null}
      {plan.key_answer_id ? <VoicePlayer src={answerAudioUrl(plan.key_answer_id)} label={PLAN_COPY.howYouSaidIt} tone="grey" /> : null}
      {plan.why_line ? (
        <div>
          <button
            type="button"
            onClick={() => setWhy((w) => !w)}
            aria-expanded={why}
            className="-mx-2 -my-3 px-2 py-3 text-[13px] text-[#6B6B6B] underline underline-offset-[3px]"
          >
            {PLAN_COPY.whyThisLine}
          </button>
          {why ? <div className="mt-1 text-[13px] leading-[1.45] text-[#4A4A4A]">{plan.why_line}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function PlanBar({ plan }: { plan: Plan }) {
  const total = Math.max(1, Math.min(plan.total, 24));
  return (
    <div className="flex gap-1" aria-hidden="true" data-plan-bar>
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={`relative h-2 flex-1 overflow-hidden rounded ${i < plan.done ? "bg-[#FF640A]" : "bg-[#EBEBEB]"}`}
        />
      ))}
    </div>
  );
}

export default function PlanCard({
  plan,
  label = PLAN_COPY.yourNextLevel,
  onBook,
  onChange,
}: {
  plan: Plan;
  label?: string;
  onBook?: (which: CallWhich) => void;
  onChange?: () => void;
}) {
  return (
    <div
      data-plan-card
      className="flex w-full flex-col gap-3 rounded-[18px] border border-[#E6E6E6] bg-white p-4 text-[#121212] shadow-[0_6px_20px_-14px_rgba(0,0,0,0.25)]"
    >
      <div className="flex flex-col gap-1.5">
        <div className="text-[13px] text-[#6B6B6B]">{label}</div>
        <div className="text-[15px] font-semibold">{plan.level_name}</div>
        <KeyLine plan={plan} />
      </div>
      <hr className="m-0 h-px border-0 bg-[#EDEDED]" />
      <div className="flex flex-col gap-1.5">
        <div className="text-[13px] text-[#6B6B6B]">{PLAN_COPY.planHeading}</div>
        <PlanList plan={plan} onBook={onBook} />
      </div>
      {onChange ? (
        <button
          type="button"
          onClick={onChange}
          className="-mx-2 -my-3 self-start px-2 py-3 text-[13px] text-[#6B6B6B] underline underline-offset-[3px]"
        >
          {PLAN_COPY.changeYourPlan}
        </button>
      ) : null}
    </div>
  );
}
