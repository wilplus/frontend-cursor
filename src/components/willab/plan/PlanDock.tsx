"use client";

import { useState } from "react";
import { X } from "lucide-react";
import RecordingBar from "@/components/willab/RecordingBar";
import { useVoiceNote } from "@/components/willab/useVoiceNote";
import { TapRow } from "@/components/willab/WillQuestion";
import type { CallWhich, Plan } from "@/services/api/plan";
import { isoDay, PLAN_COPY } from "@/lib/willab/planCopy";
import PlanCalendar, { MonthGrid } from "./PlanCalendar";

/* The plan's questions, asked the after-walk way (rules: the-plan.md §1 B,
   D, F, E5, I; backend N319 items 1 to 3, on the prototype version 39).
   While the plan asks, the Lounge's bar stays ("+", "Type here", the mic):
   - a choice (the deadline, the plan's own yes, a call, what's next, a new
     project's question) is tap answers on the right of the thread, drawn as
     Will's after the walk (orange outlined pills); the plan's "Not now" is
     grey and quieter (`PlanAsk`);
   - the 1 to 10 scale keeps its shape, in the thread under its question
     (`PlanAsk`);
   - a voice question (why it matters, the key line, the follow-ups, "How
     did it go?") turns the Lounge's mic orange; a tap records with the one
     recording bar (backend N314), Stop sends the answer (`usePlanVoice`).
   In the footer, only what stands in for the message box (`PlanDock`):
   "Start your first recording", the one button after the plan card (N319
   item 2), a practice day's "Record Take N", alone (N294 item 7) with its
   grey ✕ (N395), and the calls' calendar, full screen over the chat (N248, N281).
   Each answer goes to the backend, which writes Will's next words into the
   thread. */

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

/** The steps that ask a question: the Lounge's bar stays under it, and
 *  "Type here" waits (N319 items 1 and 3). */
const ASKING = new Set(["deadline", "consent", "voice", "stress", "ready", "call", "next", "same_event"]);

/** Does the plan ask a question now (its answer in the thread, or by the
 *  mic)? */
export function planAsks(kind: string | null): boolean {
  return kind !== null && ASKING.has(kind);
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

function Scale({ lo, hi, onPick }: { lo: string; hi: string; onPick: (v: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2 py-1">
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

/** The plan's answers in the thread, under Will's question (N319 item 1):
 *  his tap answers' pills on the right, or the 1 to 10 scale, right side,
 *  full width. Gone while the answer is on its way; the speaker's answer
 *  and Will's next words then land in the thread. */
export function PlanAsk({
  plan,
  busy,
  booking,
  actions,
  onBookNow,
  newEventHeld = false,
}: {
  plan: Plan;
  busy: boolean;
  booking: CallWhich | null;
  actions: PlanActions;
  /** "Book now" under Will's ask for a call: its calendar opens (N281). */
  onBookNow: (which: CallWhich) => void;
  /** A Take is still processing: "I have a new event" is not shown (H1, N242). */
  newEventHeld?: boolean;
}) {
  const kind = dockFor(plan, booking);
  const [picking, setPicking] = useState(false);
  if (busy || !kind) return null;
  const taps = (labels: string[], onTap: (label: string) => void, quiet?: string[]) => (
    <TapRow labels={labels} quiet={quiet} onTap={onTap} dataAttr={{ "data-plan-ask": kind }} />
  );
  if (kind === "deadline") {
    // "Pick a date" opens the date sheet; a day picked answers at once.
    return (
      <>
        {taps([PLAN_COPY.pickDate, PLAN_COPY.noDate], (label) =>
          label === PLAN_COPY.pickDate ? setPicking(true) : actions.deadline(null),
        )}
        {picking ? (
          <DatePickSheet
            onClose={() => setPicking(false)}
            onPick={(day) => {
              setPicking(false);
              actions.deadline(day);
            }}
          />
        ) : null}
      </>
    );
  }
  if (kind === "consent") {
    // "Yes, ask me" orange outlined; "Not now" grey and quieter (N319 item 1).
    return taps([PLAN_COPY.consentNo, PLAN_COPY.consentYes], (label) => actions.consent(label === PLAN_COPY.consentYes), [
      PLAN_COPY.consentNo,
    ]);
  }
  if (kind === "call") {
    const asked: CallWhich = plan.step === "kickoff" ? "kickoff" : "summary";
    // "Skip" on the left, grey and quieter; "Book now" on the right, orange
    // outlined (N325 item 2).
    return taps(
      [PLAN_COPY.skip, PLAN_COPY.bookNow],
      (label) => (label === PLAN_COPY.bookNow ? onBookNow(asked) : actions.book(asked, null)),
      [PLAN_COPY.skip],
    );
  }
  if (kind === "next") {
    const labels = newEventHeld ? [PLAN_COPY.keepPractising] : [PLAN_COPY.keepPractising, PLAN_COPY.newEvent];
    return taps(labels, (label) => actions.next(label === PLAN_COPY.newEvent ? "new_event" : "keep_practising"));
  }
  if (kind === "same_event") return taps([PLAN_COPY.yes, PLAN_COPY.no], (label) => actions.sameEvent(label === PLAN_COPY.yes));
  if (kind === "stress" || kind === "ready") {
    const [lo, hi] = kind === "stress" ? [PLAN_COPY.stressLo, PLAN_COPY.stressHi] : [PLAN_COPY.readyLo, PLAN_COPY.readyHi];
    return (
      <div className="ml-auto w-full" data-plan-ask={kind}>
        <Scale key={kind} lo={lo} hi={hi} onPick={actions.rating} />
      </div>
    );
  }
  return null;
}

/** A voice question (why it matters, the key line, the follow-ups, "How did
 *  it go?"): while it waits the Lounge's mic is orange, as after the walk
 *  (N319 item 1, the walk's page B14 state 2); a tap records with the one
 *  recording bar (backend N314): the trash, then the walk's strip with Stop
 *  inside it. Stop sends the answer through the plan's answer path; the
 *  trash throws it away. No Skip. */
export function usePlanVoice({
  open,
  onAnswer,
}: {
  open: boolean;
  onAnswer: (audio: Blob, durationMs: number) => Promise<void>;
}) {
  const note = useVoiceNote({ maxSeconds: 300, onDone: ({ audio, durationMs }) => onAnswer(audio, durationMs) });
  const recording = note.phase === "recording";
  return {
    /** The question waits: the mic is orange and records the answer. */
    waiting: open && note.phase === "idle" ? { onTap: () => void note.start() } : null,
    recording,
    /** The recording bar, in the message box's place while the answer is said. */
    bar: recording ? (
      <div data-plan-voice-recording="">
        <RecordingBar elapsedMs={note.elapsedMs} onTrash={note.cancel} onStop={note.send} />
      </div>
    ) : null,
  };
}

/** The plan's black button with the red dot, "Start your first recording";
 *  the same piece carries the chat's "Record Take N" (`RecordTakeButton`). */
function RecordDockButton({
  label,
  onClick,
  disabled = false,
  dataAttr,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  dataAttr: Record<string, string>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...dataAttr}
      className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-foreground text-[15px] font-medium text-background disabled:opacity-50"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
      {label}
    </button>
  );
}

/** The chat's one "Record Take N", alone under the chat, the plan's black
 *  button with the red dot (backend N294 item 7, N296 state 4): the next
 *  Take after a Take's goodbye, or a practice day's while today's one thing
 *  is the newest (`usePlanLounge` `one`). Held, greyed, while a Take is
 *  still landing, as the "+" is; a tap opens that Take's text the way its
 *  own button does (from Take 2 on, the sharing question first). 24 px
 *  under the last bubble, with a grey ✕ on its right, no background and no
 *  outline, that closes it (N395, `useRecordTake`). */
export function RecordTakeButton({
  next,
  held,
  onRecord,
  onClose,
}: {
  next: NextTake | null;
  held: boolean;
  onRecord: (arcId: string) => void;
  onClose: () => void;
}) {
  if (!next) return null;
  return (
    <div className="flex items-center gap-1.5 pt-4">
      <div className="min-w-0 flex-1">
        <RecordDockButton
          label={PLAN_COPY.recordTake(next.takeIndex + 1)}
          onClick={() => onRecord(next.arcId)}
          disabled={held}
          dataAttr={{ "data-record-next": "" }}
        />
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        data-record-next-close=""
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

type NextTake = { arcId: string; takeIndex: number };

/** The chat's "Record Take N" as it shows now, and its ✕ (backend N395).
 *  Closed, that Take's button gives its place back to the bar ("+", "Type
 *  here", the mic) until the chat is opened again, or until a newer Take's
 *  goodbye offers the next one. Only the open chat remembers it; nothing
 *  goes to the backend, and the plan and the goodbye are unchanged. */
export function useRecordTake<T extends NextTake>(next: T | null): { next: T | null; close: () => void } {
  const [closed, setClosed] = useState<string | null>(null);
  const key = next ? `${next.arcId}:${next.takeIndex}` : null;
  return { next: key !== null && key === closed ? null : next, close: () => setClosed(key) };
}

/** Which step of the plan is open, or null for none: a question ("deadline",
 *  "consent", "voice", "stress", "ready", "call", "next", "same_event"),
 *  "start" (the one button after the plan card) or "book" (a call's
 *  calendar). */
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

/** The plan's footer, only where it stands in for the message box: "Start
 *  your first recording" after the plan card (E5, N319 item 2) and the
 *  calls' calendar, full screen over the chat, for "Book now" under Will's
 *  ask or "Book" in the plan's list (N248, N281). A practice day's "Record
 *  Take N" is the chat's one `RecordTakeButton` (G6). */
export default function PlanDock({
  plan,
  busy,
  booking,
  onCloseBooking,
  actions,
}: {
  plan: Plan;
  busy: boolean;
  /** The call whose calendar is open: "Book now" under Will's ask, or
   *  "Book" in the plan's list. */
  booking: CallWhich | null;
  onCloseBooking: () => void;
  actions: PlanActions;
}) {
  const kind = dockFor(plan, booking);
  // Will's ask for a call: "Skip" on its calendar moves on, as under the ask;
  // a call booked later from the plan's list just closes (N281).
  const asked: CallWhich | null = plan.step === "kickoff" || plan.step === "summary" ? plan.step : null;
  return (
    <>
      <PlanCalendar
        plan={plan}
        which={kind === "book" ? booking : null}
        busy={busy}
        onBook={(call, start) => {
          onCloseBooking();
          actions.book(call, start);
        }}
        onSkip={(call) => {
          onCloseBooking();
          if (call === asked) actions.book(call, null);
        }}
        onSaveDeadline={actions.saveDeadline}
      />
      {kind === "start" && !busy ? (
        <RecordDockButton label={PLAN_COPY.startFirst} onClick={actions.startFirst} dataAttr={{ "data-plan-dock": "start" }} />
      ) : null}
    </>
  );
}
