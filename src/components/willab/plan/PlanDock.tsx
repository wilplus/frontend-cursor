"use client";

import { useState } from "react";
import RecordingStrip from "@/components/willab/walk/RecordingStrip";
import { useVoiceNote } from "@/components/willab/useVoiceNote";
import type { CallWhich, Plan } from "@/services/api/plan";
import { isoDay, PLAN_COPY } from "@/lib/willab/planCopy";
import PlanCalendar, { MonthGrid } from "./PlanCalendar";

/* The plan's footer, in place of "Type here" (rules: the-plan.md §1 B, D, F,
   E5, I; prototype version 27): the deadline's chips, Will's ask for the
   plan's own yes (N211), the voice answer's recorder (no Skip), the 1 to 10
   scale, the calls' calendar (full screen over the chat, N248), then only "Start your first recording". Each answer goes to the backend, which
   writes Will's next words into the thread. */

export type PlanActions = {
  deadline: (day: string | null) => void;
  answer: (audio: Blob, durationMs: number) => Promise<void>;
  rating: (value: number) => void;
  book: (which: CallWhich, start: string | null) => void;
  saveDeadline: (day: string) => void;
  startFirst: () => void;
  next: (choice: "keep_practising" | "new_event") => void;
  sameEvent: (yes: boolean) => void;
  /** Will's ask for the plan's own yes: "Yes, ask me" or "Not now" (N211). */
  consent: (yes: boolean) => void;
};

function Chip({ label, onClick, icon, dark }: { label: string; onClick: () => void; icon?: boolean; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[15px] font-medium ${
        dark
          ? "border-[#121212] bg-[#121212] text-white"
          : "border-[#DCDCDC] bg-white text-[#121212] hover:border-[#9A9A9A]"
      }`}
    >
      {icon ? (
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="#121212" strokeWidth="1.4">
          <rect x="2" y="3" width="12" height="11" rx="2" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
        </svg>
      ) : null}
      {label}
    </button>
  );
}

function DatePickSheet({ onPick, onClose }: { onPick: (day: string) => void; onClose: () => void }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={PLAN_COPY.pickDate}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[22px] bg-white px-[18px] pb-[26px] pt-2.5">
        <div className="mx-auto mb-3 h-1 w-[38px] rounded bg-[#D9D9D9]" />
        <MonthGrid
          large
          month={month}
          enabled={(day) => day > start}
          picked={null}
          onPick={(day) => onPick(isoDay(day))}
          onMonth={(s) => setMonth(new Date(month.getFullYear(), month.getMonth() + s, 1))}
        />
      </div>
    </div>
  );
}

function DeadlineChips({ actions }: { actions: PlanActions }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap justify-end gap-2" data-plan-dock="deadline">
      <Chip label={PLAN_COPY.pickDate} icon onClick={() => setOpen(true)} />
      <Chip label={PLAN_COPY.noDate} onClick={() => actions.deadline(null)} />
      {open ? (
        <DatePickSheet
          onClose={() => setOpen(false)}
          onPick={(day) => {
            setOpen(false);
            actions.deadline(day);
          }}
        />
      ) : null}
    </div>
  );
}

function VoiceAnswer({ actions }: { actions: PlanActions }) {
  const note = useVoiceNote({ maxSeconds: 300, onDone: ({ audio, durationMs }) => actions.answer(audio, durationMs) });
  if (note.phase === "idle") {
    return (
      <button
        type="button"
        onClick={() => void note.start()}
        data-plan-dock="record"
        className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-[#DCDCDC] bg-white text-[15.5px] font-medium text-[#121212]"
      >
        <span className="h-[9px] w-[9px] rounded-full bg-[#EF4444]" aria-hidden />
        {PLAN_COPY.recordAnswer}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2" data-plan-dock="recording">
      <div className="flex items-center justify-end gap-1.5 text-[13px] text-[#6B6B6B]">
        <span className="h-2 w-2 rounded-full bg-[#EF4444] motion-safe:animate-pulse" aria-hidden />
        {PLAN_COPY.yourAnswer}
      </div>
      <RecordingStrip elapsed={note.elapsedMs / 1000} />
      <button
        type="button"
        onClick={() => void note.send()}
        disabled={note.phase === "sending"}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-record text-[15px] font-semibold text-record-foreground disabled:opacity-60"
      >
        <span className="h-3 w-3 rounded-[3px] bg-white" aria-hidden />
        {PLAN_COPY.stop}
      </button>
    </div>
  );
}

function Scale({ lo, hi, onPick }: { lo: string; hi: string; onPick: (v: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2 py-1" data-plan-dock="scale">
      <div className="flex justify-between gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} of 10`}
            aria-pressed={picked === n}
            disabled={picked !== null}
            onClick={() => {
              setPicked(n);
              onPick(n);
            }}
            className={`h-8 w-8 rounded-full border-[1.5px] p-0 text-[13.5px] font-semibold ${
              picked === n
                ? "border-[#121212] bg-[#121212] text-white"
                : `border-[#DCDCDC] bg-white text-[#121212] ${picked !== null ? "opacity-45" : ""}`
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[12.5px] text-[#737373]">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}

function StartFirst({ onStart }: { onStart: () => void }) {
  return (
    <button
      type="button"
      onClick={onStart}
      data-plan-dock="start"
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-foreground text-[15px] font-medium text-background"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
      {PLAN_COPY.startFirst}
    </button>
  );
}

/** "What's next?" (I2); "I have a new event" is not shown while a Take is
 *  still processing (H1, backend N242). */
function NextChips({ actions, newEventHeld }: { actions: PlanActions; newEventHeld: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2" data-plan-dock="next">
      <Chip label={PLAN_COPY.keepPractising} onClick={() => actions.next("keep_practising")} />
      {newEventHeld ? null : <Chip label={PLAN_COPY.newEvent} onClick={() => actions.next("new_event")} />}
    </div>
  );
}

function SameEventChips({ actions }: { actions: PlanActions }) {
  return (
    <div className="flex flex-wrap justify-end gap-2" data-plan-dock="same_event">
      <Chip label={PLAN_COPY.yes} onClick={() => actions.sameEvent(true)} />
      <Chip label={PLAN_COPY.no} onClick={() => actions.sameEvent(false)} />
    </div>
  );
}

function ConsentChips({ actions }: { actions: PlanActions }) {
  return (
    <div className="flex flex-wrap justify-end gap-2" data-plan-dock="consent">
      <Chip label={PLAN_COPY.consentNo} onClick={() => actions.consent(false)} />
      <Chip label={PLAN_COPY.consentYes} dark onClick={() => actions.consent(true)} />
    </div>
  );
}

/** Which footer a plan shows, or null for the message box. */
export function dockFor(plan: Plan | null, booking: CallWhich | null): string | null {
  if (!plan || plan.waiting) return booking ? "book" : null;
  if (booking) return "book";
  if (plan.step === "consent") return "consent";
  if (plan.step === "deadline") return "deadline";
  if (plan.step === "why" || plan.step === "followup" || plan.step === "how_it_went") return "voice";
  if (plan.step === "stress" || plan.step === "ready") return plan.step;
  if (plan.step === "kickoff" || plan.step === "summary") return "call";
  if (plan.step === "whats_next") return "next";
  if (plan.step === "same_event") return "same_event";
  if (plan.status === "active" && !plan.first_take_done) return "start";
  return null;
}

export default function PlanDock({
  plan,
  busy,
  booking,
  onCloseBooking,
  actions,
  newEventHeld = false,
}: {
  plan: Plan;
  busy: boolean;
  /** A call booked later, from the plan's list ("Book"). */
  booking: CallWhich | null;
  onCloseBooking: () => void;
  actions: PlanActions;
  /** A Take is still processing: "I have a new event" is not shown (N242). */
  newEventHeld?: boolean;
}) {
  const kind = dockFor(plan, booking);
  // The calls' calendar is full screen over the chat (N248), so it stays
  // mounted while it slides away, and the footer under it stays empty.
  const which: CallWhich | null =
    kind === "book" ? booking : kind === "call" ? (plan.step === "kickoff" ? "kickoff" : "summary") : null;
  return (
    <>
      <PlanCalendar
        plan={plan}
        which={which}
        busy={busy}
        soon={kind === "book"}
        onBook={(call, start) => actions.book(call, start)}
        onSkip={(call) => (kind === "book" ? onCloseBooking() : actions.book(call, null))}
        onSaveDeadline={actions.saveDeadline}
      />
      <DockFooter kind={kind} plan={plan} busy={busy} actions={actions} newEventHeld={newEventHeld} />
    </>
  );
}

function DockFooter({
  kind,
  plan,
  busy,
  actions,
  newEventHeld,
}: {
  kind: string | null;
  plan: Plan;
  busy: boolean;
  actions: PlanActions;
  newEventHeld: boolean;
}) {
  if (!kind || kind === "book" || kind === "call" || busy) return null;
  if (kind === "deadline") return <DeadlineChips actions={actions} />;
  if (kind === "voice") return <VoiceAnswer key={`${plan.step}-${plan.id}`} actions={actions} />;
  if (kind === "stress") return <Scale key="stress" lo={PLAN_COPY.stressLo} hi={PLAN_COPY.stressHi} onPick={actions.rating} />;
  if (kind === "ready") return <Scale key="ready" lo={PLAN_COPY.readyLo} hi={PLAN_COPY.readyHi} onPick={actions.rating} />;
  if (kind === "next") return <NextChips actions={actions} newEventHeld={newEventHeld} />;
  if (kind === "same_event") return <SameEventChips actions={actions} />;
  if (kind === "consent") return <ConsentChips actions={actions} />;
  return <StartFirst onStart={actions.startFirst} />;
}
