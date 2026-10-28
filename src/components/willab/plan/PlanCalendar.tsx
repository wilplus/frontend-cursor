"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { callSlots, type CallWhich, type Plan } from "@/services/api/plan";
import { fmtDay, fmtShort, fromIsoDay, isoDay, monthTitle, PLAN_COPY, weekdayName } from "@/lib/willab/planCopy";

/* The plan's calendars (rules: the-plan.md §1 F). MonthGrid is the small one
   the deadline's question and Change your plan open. PlanCalendar is the
   calls' (backend N248, prototype
   https://claude.ai/artifact/Gfnp8Fg8G2uXcqbCSNycgf): full screen over the
   chat once Will asks for a call. The month swipes; a day picked folds it
   into its week, which swipes too, with the day's times under it; "Skip" at
   the top, one "Book" at the bottom. "Edit" next to the deadline turns the
   same screen into the deadline's (N168). */

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

/* ── The calls' calendar, full screen ─────────────────────────────────────── */

const ROW = 58; // a week's row, px
const FOLD_MS = 400; // the month folding into the picked day's week
const RISE_MS = 1000; // Will's words are read before the calendar comes up
const TICK_MS = 650;
const SLIDE_MS = 520;
const SHEET_EASE = "cubic-bezier(.32,.72,0,1)";
const TRACK = "transform 420ms cubic-bezier(.22,.8,.2,1)";
const SUMMARY_MONTHS = 6;
const DEADLINE_MONTHS = 24;

type Mode = "call" | "dl";

const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
const fromMonthKey = (m: number) => new Date(Math.floor(m / 12), m % 12, 1);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
const span = (a: number, b: number) => Array.from({ length: Math.max(1, b - a + 1) }, (_, i) => a + i);

/** The months a calendar runs over: the kickoff's from this month to the
 *  deadline's, the summary call's from the day after the deadline, the
 *  deadline's own from this month on (F1, F2, F7). */
function monthsFor(mode: Mode, which: CallWhich, deadline: Date | null, today: Date): number[] {
  const now = monthKey(today);
  if (mode === "dl") return span(now, now + DEADLINE_MONTHS - 1);
  if (which === "summary") {
    const first = Math.max(now, deadline ? monthKey(addDays(deadline, 1)) : now);
    return span(first, first + SUMMARY_MONTHS - 1);
  }
  return span(now, deadline ? monthKey(addDays(deadline, -1)) : now + 2);
}

/** The Mondays of the weeks that touch those months. */
function weeksOf(months: number[]): Date[] {
  const last = addDays(fromMonthKey(months[months.length - 1] + 1), -1);
  const out: Date[] = [];
  for (let w = mondayOf(fromMonthKey(months[0])); w <= last; w = addDays(w, 7)) out.push(w);
  return out;
}

/** Where a page sits in a pager's list, or the nearest end when the list
 *  moved past it (the deadline changed). */
function nearest<T extends number | string>(list: T[], at: T): number {
  const i = list.indexOf(at);
  if (i >= 0) return i;
  return at < list[0] ? 0 : list.length - 1;
}

/** The kickoff before the deadline, the summary call after it (F1, F2). */
function fits(which: CallWhich, day: Date, deadline: Date | null): boolean {
  if (!deadline) return true;
  return which === "kickoff" ? day < deadline : day > deadline;
}

/** The call's open times by day, read a month at a time as the calendar shows
 *  it, and read again when the deadline moves. */
function useCallSlots(which: CallWhich | null, months: number[], deadline: string | null): Map<string, string[]> {
  const [got, setGot] = useState<Record<number, string[]>>({});
  const asked = useRef(new Set<number>());
  const round = useRef(0);
  const want = months.join(",");
  useEffect(() => {
    setGot({});
  }, [which]);
  useEffect(() => {
    round.current += 1;
    asked.current = new Set();
  }, [which, deadline]);
  useEffect(() => {
    if (!which || !want) return;
    const mine = round.current;
    for (const m of want.split(",").map(Number)) {
      if (asked.current.has(m)) continue;
      asked.current.add(m);
      void callSlots(which, fromMonthKey(m).toISOString(), fromMonthKey(m + 1).toISOString()).then((s) => {
        if (round.current === mine) setGot((g) => ({ ...g, [m]: s }));
      });
    }
  }, [which, want, deadline]);
  return useMemo(() => {
    const byDay = new Map<string, string[]>();
    for (const s of [...new Set(Object.values(got).flat())].sort()) {
      const key = isoDay(new Date(s));
      byDay.set(key, [...(byDay.get(key) ?? []), s]);
    }
    return byDay;
  }, [got]);
}

/** A row of pages one screen wide that swipes; the arrows and a tap still
 *  work. A swipe never taps the day it starts on. */
function Pager({
  index,
  count,
  still,
  onIndex,
  children,
}: {
  index: number;
  count: number;
  still: boolean;
  onIndex: (i: number) => void;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x0: number;
    y0: number;
    t0: number;
    w: number;
    axis: "x" | "y" | null;
  } | null>(null);
  const swiped = useRef(0);
  const at = (i: number, px = 0) => (px ? `translate3d(calc(${-i * 100}% + ${px}px),0,0)` : `translate3d(${-i * 100}%,0,0)`);
  const end = (x: number | null) => {
    const d = drag.current;
    const el = track.current;
    drag.current = null;
    if (!d || !el || d.axis !== "x") return;
    swiped.current = Date.now();
    const dx = x === null ? 0 : x - d.x0;
    const v = dx / Math.max(1, Date.now() - d.t0);
    let i = index;
    if ((dx < -d.w * 0.2 || (v < -0.35 && dx < -24)) && i < count - 1) i += 1;
    else if ((dx > d.w * 0.2 || (v > 0.35 && dx > 24)) && i > 0) i -= 1;
    el.style.transition = still ? "none" : TRACK;
    el.style.transform = at(i);
    if (i !== index) onIndex(i);
  };
  return (
    <div
      className="touch-pan-y overflow-hidden"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        drag.current = {
          x0: e.clientX,
          y0: e.clientY,
          t0: Date.now(),
          w: e.currentTarget.clientWidth || 1,
          axis: null,
        };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const el = track.current;
        if (!d || !el) return;
        const dx = e.clientX - d.x0;
        const dy = e.clientY - d.y0;
        if (!d.axis) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
          if (d.axis === "x") {
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // Capture only keeps the swipe when the finger leaves the row.
            }
            el.style.transition = "none";
          }
        }
        if (d.axis !== "x") return;
        const x = (index === 0 && dx > 0) || (index === count - 1 && dx < 0) ? dx / 3 : dx;
        el.style.transform = at(index, x);
      }}
      onPointerUp={(e) => end(e.clientX)}
      onPointerCancel={() => end(null)}
      onClickCapture={(e) => {
        if (Date.now() - swiped.current < 350) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div
        ref={track}
        className="flex items-start will-change-transform"
        style={{ transform: at(index), transition: still ? "none" : TRACK }}
      >
        {children}
      </div>
    </div>
  );
}

function Day({
  day,
  ok,
  picked,
  deadline,
  kickoff,
  today,
  onPick,
}: {
  day: Date;
  ok: boolean;
  picked: Date | null;
  deadline: Date | null;
  kickoff: Date | null;
  today: Date;
  onPick: (day: Date) => void;
}) {
  const sel = sameDay(day, picked);
  const isDeadline = sameDay(day, deadline);
  const tone = sel
    ? "bg-[#121212] font-semibold text-white"
    : isDeadline
      ? "font-bold text-[#C2410C] shadow-[inset_0_0_0_2px_#FF640A]"
      : ok
        ? "font-semibold text-[#121212]"
        : "font-normal text-[#C6C6C6]";
  return (
    <div className="flex h-[58px] items-center justify-center">
      <button
        type="button"
        data-plan-day={isoDay(day)}
        aria-label={`${weekdayName(day)} ${fmtDay(day)}`}
        aria-pressed={sel}
        aria-disabled={!ok}
        tabIndex={ok ? 0 : -1}
        onClick={() => ok && onPick(day)}
        className={[
          "relative h-12 w-12 rounded-full text-[19px] tabular-nums transition-colors duration-150",
          tone,
          ok ? "" : "pointer-events-none",
          !sel && !isDeadline && sameDay(day, today) ? "shadow-[inset_0_0_0_1px_#D0D0D0]" : "",
        ].join(" ")}
      >
        {day.getDate()}
        {sameDay(day, kickoff) ? (
          <span
            className={`absolute bottom-1.5 left-1/2 -ml-[2.5px] h-[5px] w-[5px] rounded-full ${sel ? "bg-white" : "bg-[#2E9D63]"}`}
            aria-hidden
          />
        ) : null}
      </button>
    </div>
  );
}

function MonthPage({ month, fold, cell }: { month: Date; fold: string | null; cell: (day: Date) => ReactNode }) {
  const lead = (month.getDay() + 6) % 7;
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <div className="w-full flex-none px-5">
      {Array.from({ length: 6 }, (_, r) => {
        // Six rows always, so the screen does not jump from month to month;
        // while folding, only the picked day's week keeps its height.
        const keep = fold === null || isoDay(addDays(month, r * 7 - lead)) === fold;
        return (
          <div
            key={r}
            className="grid grid-cols-7 overflow-hidden"
            style={{
              height: keep ? ROW : 0,
              opacity: keep ? 1 : 0,
              transition: `height ${FOLD_MS}ms ${SHEET_EASE}, opacity 240ms ease`,
            }}
          >
            {Array.from({ length: 7 }, (_, c) => {
              const n = r * 7 + c - lead + 1;
              return n >= 1 && n <= dim ? <div key={c}>{cell(new Date(month.getFullYear(), month.getMonth(), n))}</div> : <div key={c} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

function Chevron({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="#121212"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

function useLater(): (ms: number, fn: () => void) => void {
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
}

function useStill(): boolean {
  return useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
}

/** The sheet's motion: the call asked for comes up once Will has asked and the
 *  chat has caught up; after "Book" it waits for the plan's answer, then a
 *  tick and away, or stays for another try; after "Skip" it goes at once, and
 *  the next call comes up after Will's next ask. */
function useCallSheet({
  plan,
  which,
  busy,
  soon,
  onDraw,
}: {
  plan: Plan;
  which: CallWhich | null;
  busy: boolean;
  soon: boolean;
  onDraw: (which: CallWhich) => void;
}) {
  const [drawn, setDrawn] = useState<CallWhich | null>(null);
  const [rising, setRising] = useState(false);
  const [up, setUp] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const draw = useRef(onDraw);
  draw.current = onDraw;
  const later = useLater();

  const close = () => {
    setUp(false);
    setClosing(true);
    later(SLIDE_MS, () => {
      setClosing(false);
      setDone(false);
      setDrawn(null);
    });
  };

  // A call asked for and nothing up: draw it below the screen, then raise it.
  useEffect(() => {
    if (up || closing || rising || !which || busy) return;
    const t = window.setTimeout(
      () => {
        draw.current(which);
        setDrawn(which);
        setRising(true);
      },
      soon ? 0 : RISE_MS,
    );
    return () => window.clearTimeout(t);
  }, [up, closing, rising, which, busy, soon]);

  useEffect(() => {
    if (!rising) return;
    const t = window.setTimeout(() => {
      setRising(false);
      setUp(true);
    }, 30);
    return () => window.clearTimeout(t);
  }, [rising]);

  useEffect(() => {
    if (up) sheet.current?.focus({ preventScroll: true });
  }, [up]);

  // After "Book", once the plan has answered: a tick and away when the call
  // is booked, away when it is no longer asked for, else the times stay.
  useEffect(() => {
    if (!sending || busy) return;
    setSending(false);
    if (drawn && plan.calls[drawn]) {
      setDone(true);
      later(TICK_MS, close);
    } else if (which !== drawn) {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, busy]);

  // The call asked for changed on its own: this one goes, the next comes up.
  useEffect(() => {
    if (up && !sending && !done && which !== drawn) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [up, sending, done, which, drawn]);

  return {
    drawn,
    up,
    sending,
    done,
    sheet,
    close,
    send: () => setSending(true),
  };
}

function SheetTop({ dl, booked, onLeave }: { dl: boolean; booked: number; onLeave: () => void }) {
  return (
    <div className="flex h-[54px] flex-none items-center justify-between px-2">
      <button type="button" onClick={onLeave} data-plan-skip className="h-11 px-3 text-[17px] text-[#121212]">
        {dl ? PLAN_COPY.back : PLAN_COPY.skip}
      </button>
      {dl ? null : <span className="px-3 text-[14px] tabular-nums text-[#6B6B6B]">{PLAN_COPY.booked(booked)}</span>}
    </div>
  );
}

function MonthHeader({
  month,
  folded,
  index,
  count,
  onUnfold,
  onStep,
}: {
  month: number;
  /** Folded into a week: a tap on the month's name opens it again. */
  folded: boolean;
  index: number;
  count: number;
  onUnfold: () => void;
  onStep: (dir: number) => void;
}) {
  const heading = monthTitle(fromMonthKey(month));
  const cut = heading.lastIndexOf(" ");
  const name = (
    <>
      <span>{heading.slice(0, cut)}</span>
      <span className="font-medium text-[#9A9A9A]">{heading.slice(cut + 1)}</span>
    </>
  );
  return (
    <div className="mt-[30px] flex h-11 items-center justify-between pl-5 pr-2">
      {folded ? (
        <button
          type="button"
          onClick={onUnfold}
          aria-expanded={false}
          data-plan-month-open
          className="flex h-11 items-center gap-[7px] text-[21px] font-semibold tracking-[-0.012em]"
        >
          {name}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="#121212"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      ) : (
        <div aria-live="polite" className="flex items-baseline gap-[7px] text-[21px] font-semibold tracking-[-0.012em]">
          {name}
        </div>
      )}
      <div className="flex">
        <button
          type="button"
          aria-label={folded ? "Earlier week" : "Earlier month"}
          disabled={index <= 0}
          onClick={() => onStep(-1)}
          className="flex h-11 w-11 items-center justify-center rounded-full transition-opacity disabled:opacity-25"
        >
          <Chevron d="M12.5 4.5L7 10l5.5 5.5" />
        </button>
        <button
          type="button"
          aria-label={folded ? "Later week" : "Later month"}
          disabled={index >= count - 1}
          onClick={() => onStep(1)}
          className="flex h-11 w-11 items-center justify-center rounded-full transition-opacity disabled:opacity-25"
        >
          <Chevron d="M7.5 4.5L13 10l-5.5 5.5" />
        </button>
      </div>
    </div>
  );
}

function DeadlineLine({ deadline, kickoff, onEdit }: { deadline: Date | null; kickoff: boolean; onEdit: () => void }) {
  return (
    <div className="mt-2 flex min-h-[44px] flex-wrap items-center gap-x-[18px] pl-5 pr-3 text-[14px] text-[#6B6B6B]">
      <span className="inline-flex items-center">
        <i className="mr-2 inline-block h-2.5 w-2.5 rounded-full shadow-[inset_0_0_0_2px_#FF640A]" aria-hidden />
        {PLAN_COPY.yourDeadline}: {deadline ? fmtShort(deadline) : ""}
        <button
          type="button"
          onClick={onEdit}
          className="ml-1 h-11 px-2 font-semibold text-[#121212] underline underline-offset-[3px]"
          data-plan-edit-deadline
        >
          {PLAN_COPY.edit}
        </button>
      </span>
      {kickoff ? (
        <span className="inline-flex items-center">
          <i className="mr-2 inline-block h-[9px] w-[9px] rounded-full bg-[#2E9D63]" aria-hidden />
          {PLAN_COPY.kickoffShort}
        </span>
      ) : null}
    </div>
  );
}

/** The day's times in four even columns; they rise in, one after another. */
function Times({ times, time, onPick }: { times: string[]; time: string | null; onPick: (t: string) => void }) {
  return (
    <div className="mt-2.5 grid grid-cols-4 gap-2.5 px-5">
      {times.map((t, i) => (
        <button
          key={t}
          type="button"
          aria-pressed={time === t}
          data-plan-time={t}
          onClick={() => onPick(t)}
          style={{ animationDelay: `${40 + i * 16}ms` }}
          className={`h-12 rounded-full border text-[16px] font-medium tabular-nums transition-colors duration-150 motion-safe:animate-fade-in-up ${
            time === t ? "border-[#121212] bg-[#121212] text-white" : "border-[#E2E2E2] bg-white text-[#121212]"
          }`}
        >
          {hhmm(t)}
        </button>
      ))}
    </div>
  );
}

/** The one button at the bottom: pale until there is something to send, a
 *  spinner while it goes, a green tick once the call is booked. */
function ActButton({
  label,
  can,
  sending,
  done,
  onAct,
}: {
  label: string;
  can: boolean;
  sending: boolean;
  done: boolean;
  onAct: () => void;
}) {
  const tone = done ? "bg-[#2E9D63] text-white" : can || sending ? "bg-[#121212] text-white" : "bg-[#F0F0F0] text-[#A3A3A3]";
  return (
    <div className="flex-none px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2.5">
      <button
        type="button"
        onClick={onAct}
        disabled={!can}
        data-plan-act
        className={`flex h-[58px] w-full items-center justify-center rounded-full text-[17px] font-semibold transition-[background-color,color,transform] duration-200 active:scale-[.985] ${tone}`}
      >
        {done ? (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : sending ? (
          <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
        ) : (
          label
        )}
      </button>
    </div>
  );
}

/** Where the pagers stand: the month (or week) shown, and the months whose
 *  open times are read, the one shown and its two neighbours. */
function pagesOf(o: {
  dl: boolean;
  dayView: boolean;
  call: CallWhich;
  deadline: Date | null;
  today: Date;
  monthAt: number;
  dlMonthAt: number;
  weekAt: string;
}) {
  const callMonths = monthsFor("call", o.call, o.deadline, o.today);
  const months = o.dl ? monthsFor("dl", o.call, o.deadline, o.today) : callMonths;
  const weeks = weeksOf(callMonths);
  const weekKeys = weeks.map(isoDay);
  const mi = nearest(months, o.dl ? o.dlMonthAt : o.monthAt);
  const wi = nearest(weekKeys, o.weekAt);
  const shown = o.dayView ? monthKey(addDays(weeks[wi], 3)) : months[mi];
  const want = o.dl ? [] : [shown - 1, shown, shown + 1].filter((m) => callMonths.includes(m));
  return { months, weeks, weekKeys, mi, wi, shown, want };
}

/** The calls already booked, as days, and how many. */
function bookedOf(plan: Plan) {
  const at = (c: Plan["calls"]["kickoff"]) => (c ? new Date(c.starts_at) : null);
  const kick = at(plan.calls.kickoff);
  const sum = at(plan.calls.summary);
  const dayOf = (d: Date | null) => (d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : null);
  return {
    kick,
    kickDay: dayOf(kick),
    sumDay: dayOf(sum),
    count: (kick ? 1 : 0) + (sum ? 1 : 0),
  };
}

/** The title and the button's word: the call's, or the deadline's (N168). */
function wordsOf(dl: boolean, call: CallWhich) {
  if (dl) return { title: PLAN_COPY.yourDeadline, label: PLAN_COPY.save };
  return call === "kickoff"
    ? { title: PLAN_COPY.kickoffCall, label: PLAN_COPY.book }
    : { title: PLAN_COPY.summaryCall, label: PLAN_COPY.bookNow };
}

/** The dimmed chat and the sheet over it, full screen below the status bar. */
function SheetFrame({
  call,
  up,
  still,
  title,
  sheet,
  children,
}: {
  call: CallWhich;
  up: boolean;
  still: boolean;
  title: string;
  sheet: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50" data-plan-calendar={call}>
      <div
        aria-hidden
        className="absolute inset-0 bg-black"
        style={{
          opacity: up ? 0.3 : 0,
          transition: still ? "none" : `opacity ${SLIDE_MS}ms ease`,
        }}
      />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)_+_12px)] mx-auto flex max-w-md select-none flex-col overflow-hidden rounded-t-[14px] bg-white text-[#121212] outline-none"
        style={{
          transform: up ? "translateY(0)" : "translateY(105%)",
          transition: still ? "none" : `transform ${SLIDE_MS}ms ${SHEET_EASE}`,
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default function PlanCalendar({
  plan,
  which,
  busy,
  soon = false,
  onBook,
  onSkip,
  onSaveDeadline,
}: {
  plan: Plan;
  /** The call Will asks for; null once none is, and the calendar slides away. */
  which: CallWhich | null;
  busy: boolean;
  /** Opened by a tap ("Book" in the plan's list): it comes up at once. */
  soon?: boolean;
  onBook: (which: CallWhich, start: string) => void;
  onSkip: (which: CallWhich) => void;
  onSaveDeadline: (day: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("call");
  const [view, setView] = useState<"month" | "day">("month");
  const [monthAt, setMonthAt] = useState(0);
  const [weekAt, setWeekAt] = useState("");
  const [dlMonthAt, setDlMonthAt] = useState(0);
  const [picked, setPicked] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [fold, setFold] = useState<string | null>(null);
  const [dlPicked, setDlPicked] = useState<Date | null>(null);
  const [leftView, setLeftView] = useState<"month" | "day">("month");
  const later = useLater();
  const still = useStill();

  const today = todayLocal();
  const deadline = fromIsoDay(plan.deadline);
  const motion = useCallSheet({
    plan,
    which,
    busy,
    soon,
    onDraw: (w) => {
      setMode("call");
      setView("month");
      setMonthAt(monthsFor("call", w, deadline, today)[0]);
      setPicked(null);
      setTime(null);
      setFold(null);
      setDlPicked(null);
    },
  });
  const { drawn, up, sending, done } = motion;
  const call: CallWhich = drawn ?? which ?? "kickoff";
  const dl = mode === "dl";
  const dayView = view === "day" && !dl;
  const {
    months: pageMonths,
    weeks,
    weekKeys,
    mi,
    wi,
    shown: titleMonth,
    want,
  } = pagesOf({
    dl,
    dayView,
    call,
    deadline,
    today,
    monthAt,
    dlMonthAt,
    weekAt,
  });
  const byDay = useCallSlots(drawn ?? which, want, plan.deadline);

  // A day picked that no longer fits (the deadline moved) is cleared (F7).
  useEffect(() => {
    if (picked && !fits(call, picked, deadline)) {
      setPicked(null);
      setTime(null);
      setView("month");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.deadline, call]);

  if (!drawn || typeof document === "undefined") return null;

  const { kick, kickDay, sumDay, count: booked } = bookedOf(plan);
  const open = dl
    ? (day: Date) => day > today && (!kickDay || day > kickDay) && (!sumDay || day < sumDay)
    : (day: Date) => byDay.has(isoDay(day)) && fits(call, day, deadline);
  const idle = () => !sending && !done;

  const pickMonthDay = (day: Date) => {
    if (dl) return setDlPicked(day);
    if (fold !== null || !idle()) return;
    const monday = isoDay(mondayOf(day));
    setPicked(day);
    setTime(null);
    setFold(monday);
    later(FOLD_MS, () => {
      setView("day");
      setWeekAt(monday);
      setFold(null);
    });
  };
  const pickWeekDay = (day: Date) => {
    if (!idle() || sameDay(day, picked)) return;
    setPicked(day);
    setTime(null);
  };
  const unfold = () => {
    if (!idle()) return;
    const w = weeks[wi];
    setView("month");
    setMonthAt(monthKey(addDays(w, 3)));
    setFold(isoDay(w));
    later(40, () => setFold(null));
  };
  const step = (dir: number) => {
    if (dayView) return setWeekAt(weekKeys[Math.max(0, Math.min(weekKeys.length - 1, wi + dir))]);
    const m = pageMonths[Math.max(0, Math.min(pageMonths.length - 1, mi + dir))];
    return dl ? setDlMonthAt(m) : setMonthAt(m);
  };
  const skip = () => {
    if (!up || !idle()) return;
    motion.close();
    onSkip(drawn);
  };
  const edit = () => {
    if (!idle()) return;
    setLeftView(view);
    setMode("dl");
    setDlMonthAt(monthKey(deadline ?? today));
    setDlPicked(null);
  };
  const back = () => {
    setMode("call");
    setView(leftView);
    setDlPicked(null);
  };
  const save = () => {
    if (!dlPicked) return;
    const keep = !!picked && fits(call, picked, dlPicked);
    if (!keep) {
      setPicked(null);
      setTime(null);
    }
    back();
    if (!keep) setView("month");
    onSaveDeadline(isoDay(dlPicked));
  };
  const book = () => {
    if (!time || !idle() || busy) return;
    motion.send();
    onBook(drawn, time);
  };

  const { title, label } = wordsOf(dl, drawn);
  const can = dl ? !!dlPicked : !!time && !busy && idle();
  const dayCell = (day: Date, onPick: (day: Date) => void) => (
    <Day day={day} ok={open(day)} picked={dl ? dlPicked : picked} deadline={deadline} kickoff={kick} today={today} onPick={onPick} />
  );
  const near = (i: number, at: number) => Math.abs(i - at) <= 1;

  return (
    <SheetFrame call={drawn} up={up} still={still} title={title} sheet={motion.sheet}>
      <SheetTop dl={dl} booked={booked} onLeave={dl ? back : skip} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
        <h2 className="mx-5 mt-1.5 text-balance text-[31px] font-semibold leading-[37px] tracking-[-0.022em]">{title}</h2>
        <MonthHeader
          month={titleMonth}
          folded={dayView}
          index={dayView ? wi : mi}
          count={dayView ? weeks.length : pageMonths.length}
          onUnfold={unfold}
          onStep={step}
        />
        <div className="mt-2.5 grid grid-cols-7 px-5 text-center text-[13px] font-medium leading-6 text-[#8A8A8A]" aria-hidden>
          {HEAD.map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        {dayView ? (
          <Pager key="week" index={wi} count={weeks.length} still={still} onIndex={(i) => setWeekAt(weekKeys[i])}>
            {weeks.map((w, i) => (
              <div key={weekKeys[i]} className="grid w-full flex-none grid-cols-7 px-5">
                {near(i, wi) ? Array.from({ length: 7 }, (_, c) => <div key={c}>{dayCell(addDays(w, c), pickWeekDay)}</div>) : null}
              </div>
            ))}
          </Pager>
        ) : (
          <Pager
            key={mode}
            index={mi}
            count={pageMonths.length}
            still={still}
            onIndex={(i) => (dl ? setDlMonthAt(pageMonths[i]) : setMonthAt(pageMonths[i]))}
          >
            {pageMonths.map((m, i) =>
              near(i, mi) ? (
                <MonthPage key={m} month={fromMonthKey(m)} fold={fold} cell={(day) => dayCell(day, pickMonthDay)} />
              ) : (
                <div key={m} className="w-full flex-none" />
              ),
            )}
          </Pager>
        )}
        {dl ? null : <DeadlineLine deadline={deadline} kickoff={!!kick} onEdit={edit} />}
        {dayView && picked ? (
          <Times key={isoDay(picked)} times={byDay.get(isoDay(picked)) ?? []} time={time} onPick={(t) => idle() && setTime(t)} />
        ) : null}
      </div>
      <ActButton label={label} can={can} sending={sending} done={done} onAct={dl ? save : book} />
    </SheetFrame>
  );
}
