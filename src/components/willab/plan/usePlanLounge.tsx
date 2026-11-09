"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import {
  answerConsent,
  answerDeadline,
  bookCall,
  changePlan,
  getPlan,
  nextPlan,
  planReadFailed,
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
import type { FirstTakeSlide } from "@/lib/willab/firstTake";
import PlanDock, { dockFor, PlanAsk, planAsks, usePlanVoice, type PlanActions } from "./PlanDock";
import { TapRow } from "@/components/willab/WillQuestion";
import { NOT_NOW } from "@/lib/willab/leaveWords";
import { newestOneOf, PendingBooked, PendingVoice, type PlanRowCtx } from "./PlanRows";
import { followNewest } from "@/components/willab/usePinThreadBottom";
import { ChangePlanSheet, SeePlanSheet } from "./PlanSheet";
import { useWayIn } from "./WayIn";
import { firstTakeWayIn, recordWaits } from "@/lib/willab/wayIn";

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
  /** The bar's display: hidden while the plan's footer replaces it (a
   *  call's calendar, the recording bar while an answer is said). */
  composerDisplay: (base: string) => string;
  /** The plan's spoken question waits: "Record your answer" in the bar's
   *  middle records it (backend N483 item 2); null once "Not now" under it
   *  is tapped, until the chat is opened again. */
  hear: { onTap: () => void } | null;
  /** No typing while the plan asks: Will needs the answer as a tap or in
   *  your voice (N319 item 3). */
  typingOff: boolean;
  /** The plan's own first recording (its topic, and on a first-Take plan its
   *  slides) while its first Take is not recorded: what "Start your first
   *  recording" in the bar's middle starts (N483 item 2). */
  startFirst: (() => void) | null;
  /** True while the empty Lounge's own button must wait for the plan. */
  holdsEmpty: boolean;
  /** A practice day's one thing holds the chat's one record button. */
  oneHoldsRecord: boolean;
  /** A practice day's Take, while today's one thing holds that button and
   *  the plan stands nothing else under the chat: the Lounge draws it as
   *  its one "Record Take N" (G6, N294 item 7). */
  one: { arcId: string; takeIndex: number } | null;
  /** The principles wait while the speaker is onboarded (backend N243): until
   *  the plan is read, then while it says so. */
  holdsPrinciples: boolean;
  /** The plan's topic, read from what was said: the real talk's set-up after
   *  the first Take (backend N401 item 4). */
  topic: string | null;
  /** The speaking way in (backend N572, N573, N592): "Send" for the bar's
   *  middle while the first choice has picks, else null. */
  barMiddle: ReactNode;
  /** The way in waits for typed words: the box stays open. */
  wordsWait: boolean;
  /** Typed words for the way in when it waits for them; false otherwise. */
  say: (words: string) => boolean;
  /** "Record Take 2" stays faded until Take 1's walk is done (N592 item 3). */
  recordWaits: boolean;
  /** The Take being processed is the way in's Take 1: the thin row on top
   *  of the chat, not the full wait, and the walk waits for a tap (N453). */
  firstTakeWayIn: boolean;
  /** The plan says Take 1's walk is ready (backend `walk_ready`). */
  wayInWalkReady: boolean;
};

/** How the plan's one button starts a recording: the first Take's five
 *  questions (backend N401), or the real talk's set-up after that Take. */
export type PlanStart = { firstTake?: FirstTakeSlide[] | null; afterFirstTake?: boolean };


type Thread = { messages: LoungeMessage[]; loading: boolean; reload: () => Promise<void> | void };

/** Back in the app sooner than this after the plan was last read, it is not
 *  read again: a tab switch and back is not a new day. */
const READ_ON_RETURN_AFTER_MS = 30_000;

/** The plan's spoken question (backend N483 item 2): while it waits,
 *  "Record your answer" in the bar's middle records it (`voice.waiting`),
 *  and "Not now", a grey word under the question (`notNow`, N467 rule 3),
 *  leaves it until the chat is opened again. Was the orange mic (N319 item
 *  1). */
function usePlanHear(
  plan: Plan | null,
  kind: string | null,
  open: boolean,
  onAnswer: (audio: Blob, durationMs: number) => Promise<void>,
) {
  const key = kind === "voice" && plan ? `${plan.id}:${plan.step}` : null;
  const [left, setLeft] = useState<string | null>(null);
  const voice = usePlanVoice({ open: open && key !== null && key !== left, onAnswer });
  const notNow = voice.waiting ? (
    <TapRow labels={[NOT_NOW]} onTap={() => setLeft(key)} dataAttr={{ "data-plan-not-now": "" }} />
  ) : null;
  return { voice, notNow };
}

/** The plan's own first recording while its first Take is not recorded,
 *  else null (N483 item 2). */
function firstStart(plan: Plan | null, start: () => void): (() => void) | null {
  return plan && !plan.first_take_done ? start : null;
}

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
  recordHeld,
  onOpenFeedback,
  onJoinQuestions,
  onWords,
}: {
  signedIn: boolean;
  thread: Thread;
  setThinking: (on: boolean) => void;
  onStartRecording?: (topic: string | null, start?: PlanStart) => void;
  /** A Take is being processed (or is still landing). */
  recordHeld: boolean;
  /** "Open your feedback ›" in the way in: Take 1's walk (N592 item 1). */
  onOpenFeedback?: () => void;
  /** "Your questions for people who join ›" (N572 item 1). */
  onJoinQuestions?: () => void;
  /** "Something else" opens the box for one's own words (N573 item 1). */
  onWords?: () => void;
}): PlanLounge {
  const [state, setState] = useState<PlanState | null>(null);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<CallWhich | null>(null);
  const [sheet, setSheet] = useState<"see" | "change" | null>(null);
  const [sent, setSent] = useState<{ src: string; ms: number } | null>(null);
  const [bookedLine, setBookedLine] = useState<string | null>(null);
  const { reload } = thread;
  // When the plan was last read, failed reads not counted.
  const readAt = useRef(0);

  const load = useCallback(async () => {
    const got = await getPlan();
    if (!planReadFailed(got)) readAt.current = Date.now();
    setState(got);
    if (got.wrote) await reload();
  }, [reload]);

  // Read when the Lounge opens, and again when the app comes back into view
  // (a new practice day's hello is written on the first open of that day),
  // unless the plan was read in the last half minute.
  useEffect(() => {
    if (!signedIn || thread.loading) return;
    void load();
    const onShow = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - readAt.current < READ_ON_RETURN_AFTER_MS) return;
      void load();
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

  // A plan read in the background (the way in's calls while Take 1 is
  // processed): kept as `run` keeps one.
  const apply = useCallback(
    (got: PlanState) => setState((s) => ({ ...(s ?? got), ...got, plan: got.plan ?? s?.plan ?? null })),
    [],
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
      startFirst: () => {
        const topic = plan?.topic ?? null;
        if (plan?.first_take) onStartRecording?.(topic, { firstTake: plan.first_take_slides ?? null });
        else onStartRecording?.(topic);
      },
      next: (choice) => void run(() => nextPlan(choice)),
      sameEvent: (yes) => void run(() => sameEvent(yes)),
      consent: (yes) => void run(() => answerConsent(yes)),
    }),
    [run, onStartRecording, plan?.topic, plan?.first_take, plan?.first_take_slides],
  );

  const kind = dockFor(plan, booking);
  const asks = planAsks(kind);
  const { voice, notNow } = usePlanHear(plan, kind, !busy && sent === null, actions.answer);
  const way = useWayIn({
    plan,
    messages: thread.messages,
    firstTakeInFlight: recordHeld,
    busy,
    run,
    apply,
    reload,
    onWords,
  });
  // A practice day's one thing, while it holds the chat's one record button
  // and the plan stands nothing else there: "Record Take N" under the chat,
  // alone (N294 item 7, N296 state 4).
  const newestOne = state?.enabled ? newestOneOf(thread.messages) : null;
  const one = plan && kind === null ? newestOne : null;
  // What stands in for the bar: a call's calendar, the recording bar while
  // an answer is said. Otherwise the bar stays with its one black button,
  // "Start your first recording" included (N483).
  const replaces = kind === "book" || voice.recording || way.recording;
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
      {way.voiceBar}
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
          onNewEvent={() => {
            setSheet(null);
            void run(startNewEvent);
          }}
          newEventHeld={recordHeld}
        />
      ) : null}
    </>
  ) : null;

  const rows: PlanRowCtx | undefined = state?.enabled
    ? {
        plan,
        onSeePlan: () => setSheet("see"),
        onChangePlan: () => setSheet("change"),
        onBook: openBook,
        onOpenFeedback,
        onJoinQuestions,
      }
    : undefined;

  return {
    dock,
    sheets,
    asks: (
      <>
        {plan && asks && !thread.loading ? (
          <>
            <PlanAsk plan={plan} busy={busy} booking={booking} actions={actions} onBookNow={openBook} newEventHeld={recordHeld} />
            {notNow}
          </>
        ) : null}
        {way.asks}
      </>
    ),
    pending: sent ? (
      <PendingVoice src={sent.src} durationMs={sent.ms} />
    ) : bookedLine ? (
      <PendingBooked text={bookedLine} />
    ) : null,
    rows,
    composerDisplay: (base) => (replaces ? "hidden" : base),
    hear: voice.waiting ?? way.hear,
    typingOff: asks,
    startFirst: firstStart(plan, actions.startFirst),
    holdsEmpty: signedIn && (state === null || plan !== null),
    oneHoldsRecord: newestOne !== null,
    one,
    holdsPrinciples: signedIn && (state === null || plan?.onboarding === true),
    topic: plan?.topic ?? null,
    barMiddle: way.barMiddle,
    wordsWait: way.wordsWait,
    say: way.say,
    recordWaits: recordWaits(plan),
    firstTakeWayIn: firstTakeWayIn(plan),
    wayInWalkReady: plan?.way_in?.walk_ready === true,
  };
}
