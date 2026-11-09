"use client";

import { useState, type ReactNode } from "react";
import type { CallWhich, Plan } from "@/services/api/plan";
import { fmtDay, fromIsoDay, isoDay, PLAN_COPY } from "@/lib/willab/planCopy";
import PlanCard, { usePlanCallsOn } from "./PlanCard";
import { MonthGrid } from "./MonthGrid";

/* The plan's two sheets (rules: the-plan.md §1 G5, H; the App Model's
   sheets, N564): "See your plan" opens the plan card (the level's name and
   its four marks), and "Change your plan" opens the talk's date (only for
   someone preparing a talk) and "I have a new event", hidden while a Take is
   still processing (H1, backend N242). No practice days (N564 item 2). A
   booked kickoff's mark on the date's month shows only while the calls are
   on (N315). */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-[22px] bg-white px-[18px] pb-[26px] pt-2.5 text-[#121212]">
        <div className="mx-auto mb-3 h-1 w-[38px] rounded bg-[#D9D9D9]" />
        <div className="mb-1 flex items-center justify-between text-[17px]">
          <b>{title}</b>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="#5C5C5C" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 border-b border-[#EFEFEF] px-0.5 py-[15px] text-left text-[15.5px] font-medium"
    >
      <span>{label}</span>
      <span className="text-right font-normal text-[#6B6B6B]">{value} ›</span>
    </button>
  );
}

function DeadlineView({ plan, onSave }: { plan: Plan; onSave: (day: string) => void }) {
  const callsOn = usePlanCallsOn();
  const deadline = fromIsoDay(plan.deadline);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [month, setMonth] = useState(new Date((deadline ?? today).getFullYear(), (deadline ?? today).getMonth(), 1));
  const kick = plan.calls.kickoff ? new Date(plan.calls.kickoff.starts_at) : null;
  const sum = plan.calls.summary ? new Date(plan.calls.summary.starts_at) : null;
  return (
    <MonthGrid
      large
      month={month}
      enabled={(day) => day > today && (!kick || day > kick) && (!sum || day < sum)}
      picked={null}
      deadline={deadline}
      kickoff={callsOn ? kick : null}
      onPick={(day) => onSave(isoDay(day))}
      onMonth={(s) => setMonth(new Date(month.getFullYear(), month.getMonth() + s, 1))}
    />
  );
}

export function ChangePlanSheet({
  plan,
  onClose,
  onDeadline,
  onNewEvent,
  newEventHeld,
}: {
  plan: Plan;
  onClose: () => void;
  onDeadline: (day: string) => void;
  onNewEvent: () => void;
  /** A Take is still processing: "I have a new event" is not shown (N242). */
  newEventHeld: boolean;
}) {
  const [view, setView] = useState<"main" | "deadline">("main");
  const deadline = fromIsoDay(plan.deadline);
  if (view === "deadline") {
    return (
      <Sheet title={PLAN_COPY.deadline} onClose={onClose}>
        <DeadlineView plan={plan} onSave={onDeadline} />
      </Sheet>
    );
  }
  return (
    <Sheet title={PLAN_COPY.yourPlan} onClose={onClose}>
      {/* The Deadline row only for someone preparing a talk (N564 item 6). */}
      {deadline ? <Row label={PLAN_COPY.deadline} value={fmtDay(deadline)} onClick={() => setView("deadline")} /> : null}
      {newEventHeld ? null : <Row label={PLAN_COPY.newEvent} value="" onClick={onNewEvent} />}
    </Sheet>
  );
}

export function SeePlanSheet({
  plan,
  onClose,
  onBook,
  onChange,
}: {
  plan: Plan;
  onClose: () => void;
  onBook: (which: CallWhich) => void;
  onChange: () => void;
}) {
  return (
    <Sheet title={PLAN_COPY.yourPlan} onClose={onClose}>
      <PlanCard plan={plan} onBook={onBook} onChange={onChange} />
    </Sheet>
  );
}
