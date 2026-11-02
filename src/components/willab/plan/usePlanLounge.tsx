"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import {
  answerConsent,
  answerDeadline,
  askCoach,
  bookCall,
  changePlan,
  getPlan,
  nextPlan,
  rememberPlan,
  sameEvent,
  sendPlanAnswer,
  sendRating,
  startNewEvent,
  type CallWhich,
  type Plan,
  type PlanState,
} from "@/services/api/plan";
import { fmtWhen, PLAN_COPY } from "@/lib/willab/planCopy";
import PlanDock, { dockFor, PlanAsk, planAsks, usePlanVoice, type PlanActions } from "./PlanDock";
import { newestOneOf, PendingBooked, PendingVoice, type PlanRowCtx } from "./PlanRows";
import { followNewest } from "@/components/willab/usePinThreadBottom";
import { ChangePlanSheet, SeePlanSheet } from "./PlanSheet";

/* The plan in the Lounge (rules: docs/flows/the-plan.md; backend
   services/plan_flow.py). One hook the Lounge calls: it reads the plan when
   the Lounge opens (which may begin the questions, or write a practice
   day's hello), posts each answer, and reloads the thread the backend wrote
   to. Off for everyone the ring row "plan" doesn't reach (ring 5, N204): the
   backend answers enabled false, and the Lounge is as before. */

export type PlanLounge = {
  dock: ReactNode;
  sheets: ReactNode;
  /** The plan's answers in the thread, under Will's question: tap answers or
   *  the 1 to 10 scale (N319 item 1). */
  asks: ReactNode;
  /** The voice answer just sent, in the thread while it is heard (N275). */
  pending: ReactNode;
  rows: PlanRowCtx | undefined;
  /** The message box's display: hidden while the plan's footer replaces it
   *  ("Start your first recording", a call's calendar, the recording bar). */
  composerDisplay: (base: string) => string;
  /** The Lounge's mic: orange while the plan's voice question waits, and it
   *  records the answer; else what the Lounge would give it (Will's own). */
  mic: (otherwise: MicWaits) => MicWaits;
  /** "Type here" stays in the bar, faded and not focusable, while the plan
   *  asks (N319 item 3). */
  typingOff: boolean;
  /** Over the faded "Type here", in its box, before the first Take while
   *  the plan's voice question waits: what takes the tap, and the note the
   *  tap shows above the bar (N323 item 1); else null. */
  typingWait: ReactNode;
  /** The draft the bar reads: none while typing waits, so the mic shows. */
  draft: (typed: string) => string;
  /** True while the empty Lounge's own button must wait for the plan. */
  holdsEmpty: boolean;
  /** A practice day's one thing holds the chat's one record button. */
  oneHoldsRecord: boolean;
  /** The principles wait while the speaker is onboarded (backend N243): until
   *  the plan is read, then while it says so. */
  holdsPrinciples: boolean;
};

/** The Lounge's mic while someone waits for a spoken answer: its tap. */
type MicWaits = { onTap: () => void } | null;

/** How long the note under a tap on the faded "Type here" stays. */
export const TYPE_HERE_NOTE_MS = 2500;

/** The note under "Type here" is true only where the orange mic waits for
 *  a spoken answer before the first Take (N323 item 1). Pure. */
function typingNoteDue(kind: string | null, plan: Plan | null): boolean {
  return kind === "voice" && plan !== null && !plan.first_take_done;
}

/** Over the faded "Type here": a tap shows one short note above the bar,
 *  gone after a moment; another tap while it shows keeps the one note
 *  (N323 item 1). A disabled box takes no tap of its own, so a clear layer
 *  over it takes it. */
function TypingWait() {
  const [tapped, setTapped] = useState(0);
  useEffect(() => {
    if (tapped === 0) return;
    const gone = window.setTimeout(() => setTapped(0), TYPE_HERE_NOTE_MS);
    return () => window.clearTimeout(gone);
  }, [tapped]);
  return (
    <>
      <div aria-hidden data-type-here-wait className="absolute inset-0 cursor-not-allowed" onClick={() => setTapped((n) => n + 1)} />
      {tapped > 0 ? (
        <div
          role="status"
          data-type-here-note
          className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-foreground px-3.5 py-2 text-center text-[13.5px] leading-snug text-background"
        >
          {PLAN_COPY.typeHereNote}
        </div>
      ) : null}
    </>
  );
}

type Thread = { messages: LoungeMessage[]; loading: boolean; reload: () => Promise<void> | void };

function newestPlanRow(messages: LoungeMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (typeof messages[i].metadata?.plan === "string") return messages[i].client_id;
  }
  return null;
}

function newestTakeRow(messages: LoungeMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (typeof messages[i].metadata?.take_index === "number") return messages[i].client_id;
  }
  return null;
}

export function usePlanLounge({
  signedIn,
  thread,
  setThinking,
  onStartRecording,
  onRecordNext,
  recordHeld,
}: {
  signedIn: boolean;
  thread: Thread;
  setThinking: (on: boolean) => void;
  onStartRecording?: (topic: string | null) => void;
  onRecordNext: (arcId: string) => void;
  recordHeld: boolean;
}): PlanLounge {
  const [state, setState] = useState<PlanState | null>(null);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<CallWhich | null>(null);
  const [sheet, setSheet] = useState<"see" | "change" | null>(null);
  const [sent, setSent] = useState<{ src: string; ms: number } | null>(null);
  const [bookedLine, setBookedLine] = useState<string | null>(null);
  const { reload } = thread;

  const load = useCallback(async () => {
    const got = await getPlan();
    setState(got);
    if (got.wrote) await reload();
  }, [reload]);

  // Read when the Lounge opens, and again when the app comes back into view
  // (a new practice day's hello is written on the first open of that day).
  useEffect(() => {
    if (!signedIn || thread.loading) return;
    void load();
    const onShow = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, thread.loading]);

  // A plan row the backend wrote on its own (after a Take's walk): read the
  // plan again, so its footer follows.
  const newest = newestPlanRow(thread.messages);
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (!state?.enabled || !newest || newest === seen.current) return;
    const first = seen.current === null;
    seen.current = newest;
    if (!first && !busy) void getPlan().then(setState);
  }, [newest, state?.enabled, busy]);

  // A Take that lands in the thread: read the plan again, so the first Take
  // ends the onboarding, its footer gives way and the principles come back
  // (N243), without waiting for the app to be opened again.
  const newestTake = newestTakeRow(thread.messages);
  const seenTake = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!state?.enabled || busy || newestTake === seenTake.current) return;
    const first = seenTake.current === undefined;
    seenTake.current = newestTake;
    if (!first) void load();
  }, [newestTake, state?.enabled, busy, load]);

  const run = useCallback(
    async (work: () => Promise<PlanState | null>, quiet = false) => {
      setBusy(true);
      // A booking shows its bubble at once: no "Will is typing" (N281).
      if (!quiet) setThinking(true);
      try {
        const got = await work();
        if (got) setState((s) => ({ ...(s ?? got), ...got, plan: got.plan ?? s?.plan ?? null }));
        await reload();
        // The chat follows the newest bubble after an answer (N319 item 9).
        followNewest();
      } finally {
        setThinking(false);
        setBusy(false);
      }
    },
    [reload, setThinking],
  );

  const plan: Plan | null = state?.enabled ? state.plan : null;
  // The recording screens read it: "How do you feel?" before a plan's Takes.
  useEffect(() => rememberPlan(plan), [plan]);

  const actions: PlanActions = useMemo(
    () => ({
      deadline: (day) => void run(() => answerDeadline(day)),
      answer: async (audio, ms) => {
        const src = URL.createObjectURL(audio);
        setSent({ src, ms });
        try {
          await run(() => sendPlanAnswer(audio, ms));
        } finally {
          setSent(null);
          URL.revokeObjectURL(src);
        }
      },
      rating: (value) => void run(() => sendRating(value)),
      book: (which, start) => {
        setBooking(null);
        if (start) setBookedLine(PLAN_COPY.bookedAt(fmtWhen(start)));
        void run(async () => (await bookCall(which, start))?.state ?? null, !!start).finally(() => setBookedLine(null));
      },
      saveDeadline: (day) => void run(() => changePlan({ deadline: day })),
      startFirst: () => onStartRecording?.(plan?.topic ?? null),
      next: (choice) => void run(() => nextPlan(choice)),
      sameEvent: (yes) => void run(() => sameEvent(yes)),
      consent: (yes) => void run(() => answerConsent(yes)),
    }),
    [run, onStartRecording, plan?.topic],
  );

  const kind = dockFor(plan, booking);
  const asks = planAsks(kind);
  // A voice question: the Lounge's mic, orange while it waits (N319 item 1).
  const voice = usePlanVoice({ open: kind === "voice" && !busy && sent === null, onAnswer: actions.answer });
  // What stands in for the message box: the one button after the plan card,
  // a call's calendar, the recording bar while an answer is said. While the
  // plan asks, the Lounge's bar stays ("+", "Type here", the mic).
  const replaces = kind === "start" || kind === "book" || voice.recording;
  const openBook = (which: CallWhich) => {
    setSheet(null);
    setBooking(which);
  };
  const dock = plan ? (
    // In place of the message box (hidden then), nothing is under it: the
    // shell's padding alone, as under the message box (founder 2026-10-30).
    <div className={replaces ? undefined : "mb-2"} data-plan-dock-slot>
      <PlanDock plan={plan} busy={busy} booking={booking} onCloseBooking={() => setBooking(null)} actions={actions} />
      {voice.bar}
    </div>
  ) : null;
  const sheets = plan ? (
    <>
      {sheet === "see" ? (
        <SeePlanSheet plan={plan} onClose={() => setSheet(null)} onBook={openBook} onChange={() => setSheet("change")} />
      ) : null}
      {sheet === "change" ? (
        <ChangePlanSheet
          plan={plan}
          onClose={() => setSheet(null)}
          onDeadline={(day) => {
            setSheet(null);
            void run(() => changePlan({ deadline: day }));
          }}
          onDays={(days) => {
            setSheet(null);
            void run(() => changePlan({ days }));
          }}
          onAskCoach={() => {
            setSheet(null);
            void run(askCoach);
          }}
          onNewEvent={() => {
            setSheet(null);
            void run(startNewEvent);
          }}
          newEventHeld={recordHeld}
        />
      ) : null}
    </>
  ) : null;

  const newestOne = state?.enabled ? newestOneOf(thread.messages) : null;
  const rows: PlanRowCtx | undefined = state?.enabled
    ? {
        plan,
        newestOne,
        recordHeld,
        onSeePlan: () => setSheet("see"),
        onChangePlan: () => setSheet("change"),
        onBook: openBook,
        onRecordNext,
      }
    : undefined;

  return {
    dock,
    sheets,
    asks:
      plan && asks && !thread.loading ? (
        <PlanAsk plan={plan} busy={busy} booking={booking} actions={actions} onBookNow={openBook} newEventHeld={recordHeld} />
      ) : null,
    pending: sent ? (
      <PendingVoice src={sent.src} durationMs={sent.ms} />
    ) : bookedLine ? (
      <PendingBooked text={bookedLine} />
    ) : null,
    rows,
    composerDisplay: (base) => (replaces ? "hidden" : base),
    mic: (otherwise) => voice.waiting ?? otherwise,
    // Before the first Take Will needs to hear it, so "Type here" waits
    // (N319 item 3); after it a plan question takes no typed answer either
    // (until N319 the box was hidden). Before the first Take, where the
    // orange mic waits for the answer, a tap on it says why (N323 item 1).
    typingOff: asks,
    typingWait: typingNoteDue(kind, plan) ? <TypingWait /> : null,
    draft: (typed) => (asks ? "" : typed),
    holdsEmpty: signedIn && (state === null || plan !== null),
    oneHoldsRecord: newestOne !== null,
    holdsPrinciples: signedIn && (state === null || plan?.onboarding === true),
  };
}
