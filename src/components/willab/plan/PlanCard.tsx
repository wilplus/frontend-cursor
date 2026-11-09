"use client";

import type { CallWhich, Plan, PlanBarData } from "@/services/api/plan";
import { useRingState } from "@/hooks/useRingState";
import { PLAN_COPY } from "@/lib/willab/planCopy";

/* The plan card (rules: docs/flows/the-plan.md §1 E; the App Model's card,
   N564, N319 item 6): "Plan", the level's name, its four marks, the talk's
   date only for someone preparing a talk, and "Change your plan". No
   practice days (N564 item 2). The two calls are hidden, not removed
   (N315): their lines show only while the ring row "plan_calls" reaches the
   speaker. One typeface, three sizes; text colours that read on white
   (N161, N167). */

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
  // The talk's date, only for someone preparing a talk (N564 item 6).
  const date = plan.deadline ? plan.deadline_short : null;
  if (!callsOn && !date) return null;
  return (
    <ul className="m-0 flex list-disc flex-col gap-1.5 pl-[18px] text-[15px] leading-[1.4] marker:text-[#9A9A9A]">
      {callsOn ? (
        <CallItem name={PLAN_COPY.kickoffCall} call={plan.calls.kickoff} onBook={onBook && (() => onBook("kickoff"))} />
      ) : null}
      {date ? (
        <li data-plan-date>
          {PLAN_COPY.yourDeadline}: <span className="font-semibold text-[#C2410C]">{date}</span>
        </li>
      ) : null}
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

/** The plan's bar (N564 item 3): the level's name and its four marks, the
 *  done ones filled, on the plan card, the hello and the chat's bubble after
 *  the walk. What the speaker did, never a measure of the voice, never points,
 *  a score or a percentage (Never 1). */
export function PlanBar({ bar }: { bar: PlanBarData | null | undefined }) {
  if (!bar) return null;
  const of = Math.max(1, Math.min(bar.of || 4, 4));
  const done = Math.max(0, Math.min(bar.marks, of));
  return (
    <div className="flex flex-col gap-1.5" data-plan-bar>
      <div className="text-[15px] font-semibold text-[#121212]" data-plan-level>
        {bar.level_name}
      </div>
      <div className="flex gap-1.5" aria-hidden="true" data-plan-marks>
        {Array.from({ length: of }, (_, i) => (
          <i
            key={i}
            data-on={i < done ? "" : undefined}
            className={`h-2.5 flex-1 rounded-[5px] ${i < done ? "bg-[#FF640A]" : "bg-[#EBEBEB]"}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function PlanCard({
  plan,
  onBook,
  onChange,
}: {
  plan: Plan;
  onBook?: (which: CallWhich) => void;
  onChange?: () => void;
}) {
  return (
    <div
      data-plan-card
      className="flex w-full flex-col gap-3 rounded-[18px] border border-[#E6E6E6] bg-white p-4 text-[#121212] shadow-[0_6px_20px_-14px_rgba(0,0,0,0.25)]"
    >
      <div className="text-[13px] text-[#6B6B6B]">{PLAN_COPY.planHeading}</div>
      <PlanBar bar={plan.bar} />
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
