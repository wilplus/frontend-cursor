"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DATA_CONSENT_COPY } from "@/lib/legal/dataConsentCopy";
import {
  fetchTrainingConsent,
  setTrainingConsent,
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
/*  the four lines and the backend's sentence render above the question's    */
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
const READ_TIMEOUT_MS = 4000;

function readWithTimeout(): Promise<TrainingConsent | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), READ_TIMEOUT_MS);
    void fetchTrainingConsent().then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    });
  });
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

export default function TrainingAsk({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState<TrainingConsent | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void readWithTimeout().then((value) => {
      if (!alive) return;
      if (!value?.available || !value.copy || value.active) onDone();
      else setShown(value);
    });
    return () => {
      alive = false;
    };
    // One read per Lab entry; the callback is not a reason to read again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!shown) return null;

  const yes = async () => {
    setBusy(true);
    setFailed(false);
    const next = await setTrainingConsent(true, shown);
    setBusy(false);
    if (next?.active) onDone();
    else setFailed(true);
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
