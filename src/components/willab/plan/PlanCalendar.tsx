"use client";

import { useEffect, useMemo, useState } from "react";
import { callSlots, type CallWhich, type Plan } from "@/services/api/plan";
import { fmtShort, fromIsoDay, isoDay, monthTitle, PLAN_COPY } from "@/lib/willab/planCopy";

/* The calendar in the footer (rules: the-plan.md §1 F; prototype version 27,
   bookCalls): the kickoff call before the deadline, the summary call after
   it, the deadline marked; a day, then a time, then Book. "Edit" next to the
   deadline turns the same calendar into the deadline's (N168). */

const HEAD = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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

function Pair({
  close,
  act,
  onClose,
  onAct,
  canAct,
}: {
  close: string;
  act: string;
  onClose: () => void;
  onAct: () => void;
  canAct: boolean;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onClose}
        className="flex h-11 flex-1 items-center justify-center rounded-full border border-[#EBEBEB] bg-white text-[15px] text-[#121212]"
      >
        {close}
      </button>
      <button
        type="button"
        onClick={onAct}
        disabled={!canAct}
        className="flex h-11 flex-1 items-center justify-center rounded-full bg-[#121212] text-[15px] font-medium text-white disabled:opacity-35"
      >
        {act}
      </button>
    </div>
  );
}

function DeadlineEdit({
  plan,
  onBack,
  onSave,
}: {
  plan: Plan;
  onBack: () => void;
  onSave: (day: string) => void;
}) {
  const deadline = fromIsoDay(plan.deadline);
  const [month, setMonth] = useState(startOfMonth(deadline ?? todayLocal()));
  const [picked, setPicked] = useState<Date | null>(null);
  const kick = plan.calls.kickoff ? new Date(plan.calls.kickoff.starts_at) : null;
  const sum = plan.calls.summary ? new Date(plan.calls.summary.starts_at) : null;
  const today = todayLocal();
  const ok = (day: Date) => day > today && (!kick || day > kick) && (!sum || day < sum);
  return (
    <div className="flex flex-col gap-2" data-plan-deadline-edit>
      <div className="text-[15px] font-semibold">{PLAN_COPY.yourDeadline}</div>
      <MonthGrid
        month={month}
        enabled={ok}
        picked={picked}
        deadline={deadline}
        kickoff={kick}
        onPick={setPicked}
        onMonth={(s) => setMonth(new Date(month.getFullYear(), month.getMonth() + s, 1))}
      />
      <Pair close={PLAN_COPY.back} act={PLAN_COPY.save} onClose={onBack} onAct={() => picked && onSave(isoDay(picked))} canAct={!!picked} />
    </div>
  );
}

export default function PlanCalendar({
  plan,
  which,
  busy,
  onBook,
  onSkip,
  onSaveDeadline,
}: {
  plan: Plan;
  which: CallWhich;
  busy: boolean;
  onBook: (start: string) => void;
  onSkip: () => void;
  onSaveDeadline: (day: string) => void;
}) {
  const kickoff = which === "kickoff";
  const deadline = fromIsoDay(plan.deadline);
  const today = todayLocal();
  const firstMonth = startOfMonth(kickoff || !deadline ? today : deadline);
  const [month, setMonth] = useState(firstMonth);
  const [mode, setMode] = useState<"call" | "dl">("call");
  const [slots, setSlots] = useState<string[]>([]);
  const [picked, setPicked] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const from = startOfMonth(month);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    void callSlots(which, from.toISOString(), to.toISOString()).then((s) => {
      if (live) setSlots(s);
    });
    return () => {
      live = false;
    };
  }, [which, month, plan.deadline]);

  const byDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of slots) {
      const key = isoDay(new Date(s));
      m.set(key, [...(m.get(key) ?? []), s]);
    }
    return m;
  }, [slots]);

  // A day picked that no longer fits (the deadline moved) is cleared.
  useEffect(() => {
    if (picked && !byDay.has(isoDay(picked))) {
      setPicked(null);
      setTime(null);
    }
  }, [byDay, picked]);

  if (mode === "dl") {
    return (
      <DeadlineEdit
        plan={plan}
        onBack={() => setMode("call")}
        onSave={(day) => {
          setMode("call");
          onSaveDeadline(day);
        }}
      />
    );
  }

  const booked = (plan.calls.kickoff ? 1 : 0) + (plan.calls.summary ? 1 : 0);
  const kick = plan.calls.kickoff ? new Date(plan.calls.kickoff.starts_at) : null;
  const times = picked ? byDay.get(isoDay(picked)) ?? [] : [];
  return (
    <div className="flex flex-col gap-2" data-plan-calendar={which}>
      <div className="flex items-baseline justify-between text-[15px] font-semibold">
        <span>{kickoff ? PLAN_COPY.kickoffCall : PLAN_COPY.summaryCall}</span>
        <span className="text-[12.5px] font-medium text-[#6B6B6B]">{PLAN_COPY.booked(booked)}</span>
      </div>
      <MonthGrid
        month={month}
        enabled={(day) => byDay.has(isoDay(day))}
        picked={picked}
        deadline={deadline}
        kickoff={kick}
        onPick={(day) => {
          setPicked(day);
          setTime(null);
        }}
        onMonth={(s) => setMonth(new Date(month.getFullYear(), month.getMonth() + s, 1))}
      />
      <div className="flex flex-wrap gap-3.5 text-[12px] text-[#6B6B6B]">
        <span>
          <i className="mr-[5px] inline-block h-[9px] w-[9px] rounded-full align-[-1px] shadow-[inset_0_0_0_2px_#FF640A]" />
          {PLAN_COPY.yourDeadline}: {deadline ? fmtShort(deadline) : ""}
          <button
            type="button"
            onClick={() => setMode("dl")}
            className="ml-1.5 px-1.5 py-3 font-semibold text-[#121212] underline underline-offset-[3px]"
            data-plan-edit-deadline
          >
            {PLAN_COPY.edit}
          </button>
        </span>
        {kick ? (
          <span>
            <i className="mr-[5px] inline-block h-[9px] w-[9px] rounded-full bg-[#2E9D63] align-[-1px]" />
            {PLAN_COPY.kickoffShort}
          </span>
        ) : null}
      </div>
      {picked ? (
        <div className="flex flex-wrap gap-1.5">
          {times.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={time === t}
              onClick={() => setTime(t)}
              className={`h-[34px] rounded-full border px-3 text-[14px] ${
                time === t ? "border-[#121212] bg-[#121212] text-white" : "border-[#DCDCDC] bg-white text-[#121212]"
              }`}
            >
              {hhmm(t)}
            </button>
          ))}
        </div>
      ) : null}
      <Pair
        close={PLAN_COPY.skip}
        act={kickoff ? PLAN_COPY.book : PLAN_COPY.bookNow}
        onClose={onSkip}
        onAct={() => time && onBook(time)}
        canAct={!!time && !busy}
      />
    </div>
  );
}
