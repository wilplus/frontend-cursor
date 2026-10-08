"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getAuthToken } from "@/lib/api/auth-client";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";
import LoadingState from "./LoadingState";
import {
  fetchTrainingConsent,
  reportTrainingRefusal,
  setTrainingConsent,
  trainingRefusalCode,
  type TrainingConsent,
} from "@/services/api/trainingConsent";

/* -------------------------------------------------------------------------- */
/*  TrainingAsk — "Turn on the learning?" before a Take (founder 2026-10-03).  */
/*                                                                            */
/*  The founder's words, verbatim: one question, Yes as the CTA, Skip stacked */
/*  below, in the onboarding design (the consent gate's layout). It shows     */
/*  each time a Take is started while the switch is OFF, as the first screen  */
/*  of the Lab entry: before the feelings check-in on a new project, before   */
/*  the "Start recording" screen on the next Take. ON → never shown. Skip     */
/*  records nothing and is not remembered: the founder chose "each time" over */
/*  once-and-remember on 2026-10-03 (backend decisions log N28).              */
/*                                                                            */
/*  The yes is the signed training consent itself (13-…-SIGNED-2026-10-01):   */
/*  the eight lines and the backend's sentence render above the question's   */
/*  answer, and the yes is sent against that sentence's fingerprint, exactly  */
/*  as the account card sends it. Nothing is pre-ticked.                      */
/*                                                                            */
/*  NEVER A GATE ON THE LIVE LOOP: the switch closed, already on, a guest, a  */
/*  slow or failed read — every one of them passes straight through to the   */
/*  recording. Only an open, off switch shows the question.                   */
/* -------------------------------------------------------------------------- */

export const TRAINING_ASK_COPY = {
  question: "Turn on the learning?",
  yes: "Yes",
  skip: "Skip",
  failed: DATA_CONSENT_COPY.failed,
} as const;

/** The read must never hold a Take hostage. */
const READ_TIMEOUT_MS = 2500;

/* ONE READ PER LAB ENTRY, STARTED WHEN THE LAB OPENS (founder 2026-10-04: the
   screen sat blank while the read was in flight). LabOverlay calls
   prefetchTrainingAsk() on mount, so by the time the speaker has picked a
   project the answer is usually in and the question, or the screen it guards,
   appears at once. A guest never reads at all: the training switch belongs
   to an account, so there is nothing to ask. */
let pending: Promise<TrainingConsent | null> | null = null;
let settled: { value: TrainingConsent | null } | null = null;

async function readOnce(): Promise<TrainingConsent | null> {
  if (!(await getAuthToken())) return null;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), READ_TIMEOUT_MS);
    void fetchTrainingConsent().then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    });
  });
}

export function prefetchTrainingAsk(): void {
  if (pending) return;
  settled = null;
  pending = readOnce().then((value) => {
    settled = { value };
    return value;
  });
}

/** The Lab closed: the next entry reads afresh (a yes elsewhere counts). */
export function resetTrainingAsk(): void {
  pending = null;
  settled = null;
}

function shouldAsk(value: TrainingConsent | null): value is TrainingConsent {
  return Boolean(value?.available && value.copy && !value.active);
}

/** Whether the question would be asked, from the read already made this
 *  Lab entry: false when the read says there is nothing to ask, null while
 *  it is still in flight (F1 Repair Plan Phase 5: lets "Record Take 2" start
 *  the mic inside its own tap when nothing is asked). */
export function trainingAskNeeded(): boolean | null {
  return settled ? shouldAsk(settled.value) : null;
}

/** The three pre-recording screens render through this: the question first,
 *  the screen once answered or skipped. `asked` lives in the overlay so one
 *  answer covers every pre-recording screen of the same Lab entry. */
export function TrainingAskGate({
  asked,
  onDone,
  children,
}: {
  asked: boolean;
  onDone: () => void;
  children?: ReactNode;
}) {
  if (asked) return <>{children}</>;
  return <TrainingAsk onDone={onDone} />;
}

/** "Record Take 2" from the text in the Lab (N28): run the next Take now when
 *  the read says there is nothing to ask (inside the same tap), else ask. */
export function askThenRun(run: () => void, ask: () => void): void {
  if (trainingAskNeeded() === false) run();
  else ask();
}

/** The text after a Take, or the question in front of the next Take while
 *  `asking` (N28). */
export function NextTakeGate({
  asking,
  onDone,
  children,
}: {
  asking: boolean;
  onDone: () => void;
  children?: ReactNode;
}) {
  if (asking) return <TrainingAsk onDone={onDone} />;
  return <>{children}</>;
}

export default function TrainingAsk({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState<TrainingConsent | null>(() =>
    settled && shouldAsk(settled.value) ? settled.value : null,
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (settled) {
      if (!shouldAsk(settled.value)) onDone();
      return;
    }
    let alive = true;
    prefetchTrainingAsk();
    void pending?.then((value) => {
      if (!alive) return;
      if (shouldAsk(value)) setShown(value);
      else onDone();
    });
    return () => {
      alive = false;
    };
    // One read per Lab entry; the callback is not a reason to read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Never a blank screen: the rare read still in flight shows the loading
  // state for at most READ_TIMEOUT_MS.
  if (!shown) return <LoadingState placement="surface" />;

  const yes = async () => {
    setBusy(true);
    setFailed(false);
    const next = await setTrainingConsent(true, shown);
    setBusy(false);
    if (!next || "ok" in next) {
      setFailed(true);
      reportTrainingRefusal(trainingRefusalCode(next) ?? "NO_STATE", "ask");
      return;
    }
    if (next.active) {
      // The next ask this entry (Record Take 2, N28) reads the yes.
      settled = { value: next };
      onDone();
      return;
    }
    setFailed(true);
    reportTrainingRefusal("NOT_ACTIVE", "ask");
  };

  return (
    <div className="flex flex-1 overflow-y-auto px-2 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto my-auto w-full max-w-[38rem] py-5 text-left">
        <h2 className="text-[20px] font-semibold text-foreground">
          {TRAINING_ASK_COPY.question}
        </h2>
        <ul className="mt-5 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-muted-foreground">
          {DATA_CONSENT_COPY.trainingBeforeLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-5 text-[15px] leading-[1.65] text-foreground">{shown.copy}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void yes()}
          className="mt-7 h-12 w-full rounded-full bg-foreground px-6 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-35"
        >
          {TRAINING_ASK_COPY.yes}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDone}
          className="mt-3 h-11 w-full text-sm text-muted-foreground underline underline-offset-4"
        >
          {TRAINING_ASK_COPY.skip}
        </button>
        {failed ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {TRAINING_ASK_COPY.failed}
          </p>
        ) : null}
      </div>
    </div>
  );
}
