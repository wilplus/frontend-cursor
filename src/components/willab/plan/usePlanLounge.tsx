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
import PlanDock, { dockFor, type PlanActions } from "./PlanDock";
import { newestOneOf, PendingVoice, type PlanRowCtx } from "./PlanRows";
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
  /** The voice answer just sent, in the thread while it is heard (N275). */
  pending: ReactNode;
  rows: PlanRowCtx | undefined;
  /** The message box's display: hidden while the plan's footer replaces it. */
  composerDisplay: (base: string) => string;
  /** True while the empty Lounge's own button must wait for the plan. */
  holdsEmpty: boolean;
  /** A practice day's one thing holds the chat's one record button. */
  oneHoldsRecord: boolean;
  /** The principles wait while the speaker is onboarded (backend N243): until
   *  the plan is read, then while it says so. */
  holdsPrinciples: boolean;
};

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
    async (work: () => Promise<PlanState | null>) => {
      setBusy(true);
      setThinking(true);
      try {
        const got = await work();
        if (got) setState((s) => ({ ...(s ?? got), ...got, plan: got.plan ?? s?.plan ?? null }));
        await reload();
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
      book: (which, start) =>
        void run(async () => {
          const got = await bookCall(which, start);
          setBooking(null);
          return got?.state ?? null;
        }),
      saveDeadline: (day) => void run(() => changePlan({ deadline: day })),
      startFirst: () => onStartRecording?.(plan?.topic ?? null),
      next: (choice) => void run(() => nextPlan(choice)),
      sameEvent: (yes) => void run(() => sameEvent(yes)),
      consent: (yes) => void run(() => answerConsent(yes)),
    }),
    [run, onStartRecording, plan?.topic],
  );

  const kind = dockFor(plan, booking);
  const dock = plan ? (
    <div className="mb-2" data-plan-dock-slot>
      <PlanDock
        plan={plan}
        busy={busy}
        booking={booking}
        onCloseBooking={() => setBooking(null)}
        actions={actions}
        newEventHeld={recordHeld}
      />
    </div>
  ) : null;

  const openBook = (which: CallWhich) => {
    setSheet(null);
    setBooking(which);
  };
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
    pending: sent ? <PendingVoice src={sent.src} durationMs={sent.ms} /> : null,
    rows,
    composerDisplay: (base) => (kind ? "hidden" : base),
    holdsEmpty: signedIn && (state === null || plan !== null),
    oneHoldsRecord: newestOne !== null,
    holdsPrinciples: signedIn && (state === null || plan?.onboarding === true),
  };
}
