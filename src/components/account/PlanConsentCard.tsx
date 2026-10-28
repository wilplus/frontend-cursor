"use client";

/* -------------------------------------------------------------------------- */
/*  Personal answers in your plan, in Data & consent (founder 2026-10-27,     */
/*  "approved as drawn", backend N211; rules: docs/flows/the-plan.md D).      */
/*                                                                            */
/*  The plan's personal questions are asked only after the speaker's yes.     */
/*  This card is where that yes is turned on or off later: between Help       */
/*  improve WillpowerLab and WhatsApp. Off asks first, in the shape of the    */
/*  training card's turn-off question, and deletes the personal answers; its  */
/*  outcome line says so only when the backend has deleted them. Not shown    */
/*  for anyone the backend answers enabled false (the switch, the ring).      */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { readPlanConsent, setPlanConsent, type PlanConsent } from "@/services/api/planConsent";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import { Failed } from "./DataConsentChoices";

const BUTTON =
  "inline-flex h-10 items-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-muted";
const PRIMARY =
  "inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background";

export default function PlanConsentCard() {
  const [card, setCard] = useState<PlanConsent | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    let alive = true;
    void readPlanConsent().then((result) => {
      if (alive && result.ok) setCard(result.data);
    });
    return () => { alive = false; };
  }, []);

  if (!card?.enabled) return null;

  const change = async (on: boolean) => {
    setBusy(true);
    setFailed(false);
    const result = await setPlanConsent(on);
    setBusy(false);
    if (!result.ok || (result.data.state === "granted") !== on) {
      setFailed(true);
      return;
    }
    setCard(result.data);
    setDeleted(!on);
  };

  const on = card.state === "granted";
  return (
    <section className="mt-6 rounded-2xl border border-border p-5" aria-label={COPY.planTitle}>
      <h2 className="text-base font-semibold">{COPY.planTitle}</h2>
      <div className="mt-2 flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{on ? COPY.planOn : COPY.planOff}</p>
        {deleted && !on ? (
          <p role="status" className="text-sm">{COPY.planOffDone}</p>
        ) : null}
        {confirming ? (
          <div className="rounded-xl bg-muted p-4" role="group" aria-label={COPY.planOffTitle}>
            <p className="text-sm font-semibold">{COPY.planOffTitle}</p>
            <p className="mt-1 text-sm leading-relaxed">{COPY.planOffBody}</p>
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
              <button type="button" className={BUTTON} onClick={() => setConfirming(false)}>
                {COPY.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              className={BUTTON}
              disabled={busy}
              onClick={() => (on ? setConfirming(true) : void change(true))}
            >
              {on ? COPY.turnOff : COPY.turnOn}
            </button>
          </div>
        )}
        <Failed show={failed} />
      </div>
    </section>
  );
}
