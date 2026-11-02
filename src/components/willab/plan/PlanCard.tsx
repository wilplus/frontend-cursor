"use client";

import type { CallWhich, Plan } from "@/services/api/plan";
import { useRingState } from "@/hooks/useRingState";
import { PLAN_COPY } from "@/lib/willab/planCopy";

/* The plan card (rules: docs/flows/the-plan.md §1 E; the prototype's card,
   https://claude.ai/artifact/X4gDmGfHH7ivuoRZ9ufiy9, N319 item 6): the plan
   only. "Plan", its bar, the practice days, the deadline and "Change your
   plan". The level shows where it acts (the practice day's hello, "See your
   plan"), not here. The two calls are hidden, not removed (N315): their lines
   show only while the ring row "plan_calls" reaches the speaker. One
   typeface, three sizes; text colours that read on white (N161, N167). */

/** The rings panel's row for the plan's coach calls (backend
 *  rings.PLAN_CALLS, N315). With no row they are off for everyone. */
export const PLAN_CALLS_FEATURE = "plan_calls";

/** Whether the plan's coach calls show: the backend's ring decision, as the
 *  tempo step reads its own. Off while that read is in flight or failed. */
export function usePlanCallsOn(): boolean {
  return useRingState()?.featuresOn.has(PLAN_CALLS_FEATURE) === true;
}

function PlanList({ plan, onBook }: { plan: Plan; onBook?: (which: CallWhich) => void }) {
  const callsOn = usePlanCallsOn();
  return (
    <ul className="m-0 flex list-disc flex-col gap-1.5 pl-[18px] text-[15px] leading-[1.4] marker:text-[#9A9A9A]">
      <li>{plan.every_day ? PLAN_COPY.everyDay : PLAN_COPY.threeTimes(plan.days_text)}</li>
      {callsOn ? (
        <CallItem name={PLAN_COPY.kickoffCall} call={plan.calls.kickoff} onBook={onBook && (() => onBook("kickoff"))} />
      ) : null}
      <li>
        {PLAN_COPY.yourDeadline}: <span className="font-semibold text-[#C2410C]">{plan.deadline_short}</span>
      </li>
      {callsOn ? (
        <CallItem name={PLAN_COPY.summaryCall} call={plan.calls.summary} onBook={onBook && (() => onBook("summary"))} />
      ) : null}
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

/** One part per practice, filled with what the speaker did, never a measure
 *  of the voice: on the plan card, the practice day's hello, and the chat's
 *  progress bubble after the walk (N319 item 7). */
export function PlanBar({ plan }: { plan: Pick<Plan, "done" | "total"> }) {
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
  levelLabel,
  onBook,
  onChange,
}: {
  plan: Plan;
  /** "See your plan" names this week's level above the plan (N319 item 6). */
  levelLabel?: string;
  onBook?: (which: CallWhich) => void;
  onChange?: () => void;
}) {
  return (
    <div
      data-plan-card
      className="flex w-full flex-col gap-3 rounded-[18px] border border-[#E6E6E6] bg-white p-4 text-[#121212] shadow-[0_6px_20px_-14px_rgba(0,0,0,0.25)]"
    >
      {levelLabel && plan.level_name ? (
        <>
          <div className="flex flex-col gap-1.5" data-plan-level>
            <div className="text-[13px] text-[#6B6B6B]">{levelLabel}</div>
            <div className="text-[15px] font-semibold">{plan.level_name}</div>
          </div>
          <hr className="m-0 h-px border-0 bg-[#EDEDED]" />
        </>
      ) : null}
      <div className="text-[15px] font-semibold">{PLAN_COPY.planHeading}</div>
      <PlanBar plan={plan} />
      <PlanList plan={plan} onBook={onBook} />
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
