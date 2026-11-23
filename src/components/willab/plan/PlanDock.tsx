"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ComposerMic, ComposerRecording } from "../chats/ChatComposer";
import { useVoiceNote } from "@/components/willab/useVoiceNote";
import { TapRow } from "@/components/willab/WillQuestion";
import type { CallWhich, Plan } from "@/services/api/plan";
import { isoDay, PLAN_COPY } from "@/lib/willab/planCopy";
import { afterChatBoot } from "@/lib/chatBoot";
import { MonthGrid } from "./MonthGrid";

// The calls' calendar opens only on "Book now" or "Book": off the boot
// bundle, fetched once the chat has painted (afterChatBoot), so a tap still
// finds it ready.
const PlanCalendar = dynamic(() => import("./PlanCalendar"), { ssr: false, loading: () => null });
const warmCalendar = () => void import("./PlanCalendar").catch(() => undefined);

/* The plan's questions, asked the after-walk way (rules: the-plan.md §1 B,
   D, F, E5, I; backend N319 items 1 to 3, on the prototype version 39).
   While the plan asks, the Lounge's bar stays ("+", "Type here", the mic):
   - a choice (the deadline, the plan's own yes, a call, what's next, a new
     project's question) is tap answers on the right of the thread, drawn as
     Will's after the walk (orange pills, the likely one filled); the plan's
     "Not now" and "Skip" are grey words, and "Yes" comes last (`PlanAsk`,
     N467);
   - the 1 to 10 scale keeps its shape, in the thread under its question,
     the picked number orange (`PlanAsk`);
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

export function DatePickSheet({ onPick, onClose }: { onPick: (day: string) => void; onClose: () => void }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={PLAN_COPY.pickDate}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[22px] bg-white dark:bg-card px-[18px] pb-[26px] pt-2.5">
        <div className="mx-auto mb-3 h-1 w-[38px] rounded bg-[#D9D9D9] dark:bg-white/15" />
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
                ? "border-primary bg-primary text-primary-foreground"
                : `border-[#DCDCDC] dark:border-border bg-white dark:bg-card text-[#121212] dark:text-foreground ${picked !== null ? "opacity-45" : ""}`
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[12.5px] text-[#737373] dark:text-muted-foreground">
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
  const taps = (labels: string[], onTap: (label: string) => void) => (
    <TapRow labels={labels} onTap={onTap} dataAttr={{ "data-plan-ask": kind }} />
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
    // "Not now" a grey word, "Yes, ask me" filled orange (N467 item 4).
    return taps([PLAN_COPY.consentNo, PLAN_COPY.consentYes], (label) => actions.consent(label === PLAN_COPY.consentYes));
  }
  if (kind === "call") {
    const asked: CallWhich = plan.step === "kickoff" ? "kickoff" : "summary";
    // "Skip" a grey word on the left, "Book now" on the right (N325 item 2,
    // N467 item 4).
    return taps([PLAN_COPY.skip, PLAN_COPY.bookNow], (label) =>
      label === PLAN_COPY.bookNow ? onBookNow(asked) : actions.book(asked, null),
    );
  }
  if (kind === "next") {
    const labels = newEventHeld ? [PLAN_COPY.keepPractising] : [PLAN_COPY.keepPractising, PLAN_COPY.newEvent];
    return taps(labels, (label) => actions.next(label === PLAN_COPY.newEvent ? "new_event" : "keep_practising"));
  }
  // "Yes" last, so the filled answer is the likely one (N467 item 7).
  if (kind === "same_event") return taps([PLAN_COPY.no, PLAN_COPY.yes], (label) => actions.sameEvent(label === PLAN_COPY.yes));
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

/** Record a guided answer and send it through that question's existing path. */
export function usePlanVoice({
  open,
  onAnswer,
}: {
  open: boolean;
  onAnswer: (audio: Blob, durationMs: number) => Promise<void>;
}) {
  const note = useVoiceNote({ maxSeconds: 300, onDone: ({ audio, durationMs }) => onAnswer(audio, durationMs) });
  const recording: ComposerRecording | undefined = note.phase === "recording" ? {
    elapsedMs: note.elapsedMs,
    discard: note.cancel,
    stop: note.send,
    attrs: { "data-plan-voice-recording": "" },
  } : undefined;
  return {
    waiting: open && note.phase === "idle" ? { onTap: () => void note.start() } : null,
    recording,
  };
}

export function willComposerMic({
  hear, next, held, onRecord, onFirst,
}: {
  hear: { onTap: () => void } | null;
  next: { arcId: string; takeIndex: number } | null;
  held: boolean;
  onRecord: (arcId: string, takeIndex: number) => void;
  onFirst: () => void;
}): ComposerMic {
  if (hear) return { label: PLAN_COPY.recordAnswer, start: hear.onTap, attrs: { "data-will-hear": "" } };
  if (next) return {
    label: PLAN_COPY.recordTake(next.takeIndex + 1),
    start: () => onRecord(next.arcId, next.takeIndex),
    disabled: held,
    attrs: { "data-record-next": "" },
  };
  return { label: PLAN_COPY.startFirst, start: onFirst, disabled: held, attrs: { "data-start-first": "" } };
}

/** Which step of the plan is open, or null for none: a question ("deadline",
 *  "consent", "voice", "stress", "ready", "call", "next", "same_event"),
 *  "start" (its first Take is next: the bar's "Start your first recording")
 *  or "book" (a call's calendar). */
export function dockFor(plan: Plan | null, booking: CallWhich | null): string | null {
  // The speaking way in asks its own questions until Take 1's walk is done
  // (backend N572, N592): nothing of the plan's own in the meantime.
  if (!plan || plan.waiting || (plan.way_in && !plan.way_in.walk_done)) return booking ? "book" : null;
  if (booking) return "book";
  // The first Take is the onboarding (backend N401 item 1): no question in
  // the chat, the one button at once.
  if (plan.first_take) return "start";
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

/** The plan's footer, only where it stands in for the bar: the calls'
 *  calendar, full screen over the chat, for "Book now" under Will's ask or
 *  "Book" in the plan's list (N248, N281). "Start your first recording"
 *  and a practice day's "Record Take N" are the composer
 *  (`willComposerMic`, backend N483 item 2). */
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
  const which = kind === "book" ? booking : null;
  // Drawn from the first "Book" on, so it can slide away after it.
  const [opened, setOpened] = useState(false);
  if (which && !opened) setOpened(true);
  useEffect(() => afterChatBoot(warmCalendar), []);
  if (!opened) return null;
  return (
    <>
      <PlanCalendar
        plan={plan}
        which={which}
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
    </>
  );
}
