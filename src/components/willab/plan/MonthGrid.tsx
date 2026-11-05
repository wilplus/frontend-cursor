"use client";

import { monthTitle } from "@/lib/willab/planCopy";

/* The plan's small calendar (rules: the-plan.md §1 F): the one the
   deadline's question, Change your plan and a chat's "When do you need to be
   ready?" open. The calls' full-screen calendar (PlanCalendar.tsx) shares
   its helpers. */

export const HEAD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function MonthGrid({
  month,
  enabled,
  picked,
  deadline,
  kickoff,
  onPick,
  onMonth,
  large = false,
}: {
  month: Date;
  enabled: (day: Date) => boolean;
  picked: Date | null;
  deadline?: Date | null;
  kickoff?: Date | null;
  onPick: (day: Date) => void;
  onMonth: (step: number) => void;
  large?: boolean;
}) {
  const lead = (month.getDay() + 6) % 7;
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const today = todayLocal();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: dim }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];
  const earliest = startOfMonth(today);
  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center justify-between font-semibold ${large ? "mb-2 text-[16px]" : "text-[15px]"}`}>
        <button
          type="button"
          aria-label="Earlier month"
          disabled={month <= earliest}
          onClick={() => onMonth(-1)}
          className={`${large ? "h-9 w-9" : "h-[30px] w-[30px]"} rounded-full text-[18px] disabled:opacity-30`}
        >
          ‹
        </button>
        <span>{monthTitle(month)}</span>
        <button
          type="button"
          aria-label="Later month"
          onClick={() => onMonth(1)}
          className={`${large ? "h-9 w-9" : "h-[30px] w-[30px]"} rounded-full text-[18px]`}
        >
          ›
        </button>
      </div>
      <div className={`grid grid-cols-7 text-center ${large ? "gap-1" : "gap-0.5"}`}>
        {HEAD.map((h) => (
          <div key={h} className="py-1 text-[12px] text-[#8A8A8A]">
            {h}
          </div>
        ))}
        {cells.map((day, i) =>
          day ? (
            <button
              key={i}
              type="button"
              disabled={!enabled(day)}
              aria-pressed={sameDay(day, picked)}
              onClick={() => onPick(day)}
              className={[
                "relative rounded-full font-medium disabled:cursor-default disabled:text-[#CFCFCF]",
                large ? "h-[42px] text-[15px]" : "h-[34px] text-[14px]",
                sameDay(day, picked) ? "bg-[#121212] text-white" : "hover:bg-[#F2F2F2]",
                sameDay(day, deadline ?? null) ? "font-bold text-[#C2410C] shadow-[inset_0_0_0_2px_#FF640A]" : "",
                sameDay(day, today) && !sameDay(day, picked) ? "shadow-[inset_0_0_0_1px_#D0D0D0]" : "",
              ].join(" ")}
            >
              {day.getDate()}
              {sameDay(day, kickoff ?? null) ? (
                <span className="absolute bottom-[3px] left-1/2 -ml-[2px] h-1 w-1 rounded-full bg-[#2E9D63]" aria-hidden />
              ) : null}
            </button>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
    </div>
  );
}
