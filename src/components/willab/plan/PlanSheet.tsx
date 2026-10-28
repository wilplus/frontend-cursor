"use client";

import { useState, type ReactNode } from "react";
import type { CallWhich, Plan } from "@/services/api/plan";
import { DAY_SHORT, fmtDay, fromIsoDay, isoDay, PLAN_COPY, WEEK_ORDER } from "@/lib/willab/planCopy";
import PlanCard from "./PlanCard";
import { MonthGrid } from "./PlanCalendar";

/* The plan's two sheets (rules: the-plan.md §1 G5, H; prototype version 27,
   openPlanView and openPlanSheet): "See your plan" opens the plan, and
   "Change your plan" opens the deadline, the practice days, the level (the
   coach's) and "I have a new event". */

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

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-2 w-full py-2 text-[14.5px] text-[#737373]">
      {PLAN_COPY.back}
    </button>
  );
}

function Pill({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-12 w-full items-center justify-center rounded-full bg-[#121212] text-[15px] font-medium text-white disabled:opacity-35"
    >
      {label}
    </button>
  );
}

function DaysView({ plan, onSave, onBack }: { plan: Plan; onSave: (days: number[]) => void; onBack: () => void }) {
  const [pick, setPick] = useState<number[]>(plan.days);
  if (plan.every_day) {
    return (
      <>
        <p className="mb-3.5 mt-2 text-[15px] leading-[1.45]">{PLAN_COPY.closeEveryDay}</p>
        <BackLink onClick={onBack} />
      </>
    );
  }
  const toggle = (d: number) => setPick((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  return (
    <>
      <p className="mb-3.5 mt-2 text-[15px] leading-[1.45]">{PLAN_COPY.pickThree}</p>
      <div className="mb-4 mt-2 flex flex-wrap gap-2">
        {WEEK_ORDER.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={pick.includes(d)}
            onClick={() => toggle(d)}
            className={`h-10 rounded-full border px-4 text-[15px] font-medium ${
              pick.includes(d) ? "border-[#121212] bg-[#121212] text-white" : "border-[#DCDCDC] bg-white"
            }`}
          >
            {DAY_SHORT[d]}
          </button>
        ))}
      </div>
      <Pill label={PLAN_COPY.save} disabled={pick.length !== 3} onClick={() => onSave(pick)} />
      <BackLink onClick={onBack} />
    </>
  );
}

function DeadlineView({ plan, onSave }: { plan: Plan; onSave: (day: string) => void }) {
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
      kickoff={kick}
      onPick={(day) => onSave(isoDay(day))}
      onMonth={(s) => setMonth(new Date(month.getFullYear(), month.getMonth() + s, 1))}
    />
  );
}

export function ChangePlanSheet({
  plan,
  onClose,
  onDeadline,
  onDays,
  onAskCoach,
  onNewEvent,
}: {
  plan: Plan;
  onClose: () => void;
  onDeadline: (day: string) => void;
  onDays: (days: number[]) => void;
  onAskCoach: () => void;
  onNewEvent: () => void;
}) {
  const [view, setView] = useState<"main" | "deadline" | "days" | "level">("main");
  const deadline = fromIsoDay(plan.deadline);
  if (view === "deadline") {
    return (
      <Sheet title={PLAN_COPY.deadline} onClose={onClose}>
        <DeadlineView plan={plan} onSave={onDeadline} />
      </Sheet>
    );
  }
  if (view === "days") {
    return (
      <Sheet title={PLAN_COPY.practiceDays} onClose={onClose}>
        <DaysView plan={plan} onSave={onDays} onBack={() => setView("main")} />
      </Sheet>
    );
  }
  if (view === "level") {
    return (
      <Sheet title={PLAN_COPY.yourLevel} onClose={onClose}>
        <p className="mb-3.5 mt-2 text-[15px] leading-[1.45]">{PLAN_COPY.levelIsCoachs}</p>
        <Pill label={PLAN_COPY.askCoach} onClick={onAskCoach} />
        <BackLink onClick={() => setView("main")} />
      </Sheet>
    );
  }
  return (
    <Sheet title={PLAN_COPY.yourPlan} onClose={onClose}>
      <Row label={PLAN_COPY.deadline} value={deadline ? fmtDay(deadline) : ""} onClick={() => setView("deadline")} />
      <Row
        label={PLAN_COPY.practiceDays}
        value={plan.every_day ? PLAN_COPY.everyDayShort : plan.days_text}
        onClick={() => setView("days")}
      />
      <Row label={PLAN_COPY.yourLevel} value={plan.level_name ?? ""} onClick={() => setView("level")} />
      <Row label={PLAN_COPY.newEvent} value="" onClick={onNewEvent} />
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
      <PlanCard plan={plan} label={PLAN_COPY.thisWeeksLevel} onBook={onBook} onChange={onChange} />
    </Sheet>
  );
}
