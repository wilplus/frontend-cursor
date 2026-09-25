"use client";

/* -------------------------------------------------------------------------- */
/*  Help improve WillpowerLab — the training switch (founder 2026-09-26, N10).*/
/*                                                                            */
/*  Its own card, off unless the person turns it on, never pre-ticked.        */
/*  Shown only when the backend says the switch is available: until the      */
/*  backend turns it on in code it answers 410, and until a training policy  */
/*  exists it says "available: false", so today nobody sees this card.       */
/*                                                                            */
/*  The sentence is the backend's, exactly as the database holds it; the yes */
/*  is sent with that sentence's fingerprint and refused on any other.       */
/*  Turning off asks first, with the signed wording, and deletes the copies. */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import {
  fetchTrainingConsent,
  setTrainingConsent,
  type TrainingConsent,
} from "@/services/api/trainingConsent";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";

const BUTTON =
  "inline-flex h-10 items-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground";
const PRIMARY =
  "inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background";

export default function TrainingConsentCard() {
  const [state, setState] = useState<TrainingConsent | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchTrainingConsent().then((value) => {
      if (alive) setState(value);
    });
    return () => { alive = false; };
  }, []);

  if (!state?.available || !state.copy) return null;

  const change = async (on: boolean) => {
    setBusy(true);
    setFailed(false);
    const next = await setTrainingConsent(on, state);
    setBusy(false);
    if (next) setState(next);
    else setFailed(true);
  };

  return (
    <section
      className="rounded-2xl border border-border p-5"
      aria-label={COPY.trainingTitle}
    >
      <h2 className="text-base font-semibold">{COPY.trainingTitle}</h2>
      <div className="mt-2 flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{state.copy}</p>
        {confirming ? (
          <div
            className="rounded-xl bg-muted p-4"
            role="group"
            aria-label={COPY.trainingOffTitle}
          >
            <p className="text-sm font-semibold">{COPY.trainingOffTitle}</p>
            <p className="mt-1 text-sm leading-relaxed">{COPY.trainingOffBody}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={PRIMARY}
                onClick={() => {
                  setConfirming(false);
                  void change(false);
                }}
              >
                {COPY.turnOff}
              </button>
              <button
                type="button"
                className={BUTTON}
                onClick={() => setConfirming(false)}
              >
                {COPY.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              role="switch"
              aria-checked={state.active}
              className={BUTTON}
              disabled={busy}
              onClick={() => (state.active ? setConfirming(true) : void change(true))}
            >
              {state.active ? COPY.turnOff : COPY.turnOn}
            </button>
          </div>
        )}
        {failed ? (
          <p role="alert" className="text-sm text-destructive">{COPY.failed}</p>
        ) : null}
      </div>
    </section>
  );
}
