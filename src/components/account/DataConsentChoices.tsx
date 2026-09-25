"use client";

/* -------------------------------------------------------------------------- */
/*  The Data & consent page's body (founder 2026-09-25, F2 / E2-E5).          */
/*                                                                            */
/*  Two choices a person made when they agreed, and can change here:          */
/*    Personalised practice — turning it off stops exercises being chosen     */
/*    from their recordings and deletes their practice recordings (E2 = C),   */
/*    after a confirm step.                                                   */
/*    Sensitive information — withdrawing stops NEW recording only (E5 = A);  */
/*    everything they made stays readable, and agreeing again resumes it.     */
/*                                                                            */
/*  Nothing here decides a rule. The backend's one boundary does; this reads  */
/*  what it says and sends what the person chose.                             */
/* -------------------------------------------------------------------------- */

import { useEffect, useState, type ReactNode } from "react";
import LoadingState from "@/components/willab/LoadingState";
import {
  fetchConsentChoices,
  setConsentChoice,
  type ConsentChoice,
  type ConsentChoices,
} from "@/services/api/consentChoices";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";

const BUTTON =
  "inline-flex h-10 items-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground";
const PRIMARY =
  "inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background";

type Outcome = { choice: ConsentChoice; on: boolean } | null;

export default function DataConsentChoices({ intro = COPY.intro }: { intro?: string }) {
  const [choices, setChoices] = useState<ConsentChoices | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<ConsentChoice | null>(null);
  const [failed, setFailed] = useState<ConsentChoice | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);

  useEffect(() => {
    let alive = true;
    void fetchConsentChoices().then((value) => {
      if (!alive) return;
      if (value) setChoices(value);
      else setLoadFailed(true);
    });
    return () => { alive = false; };
  }, []);

  const change = async (choice: ConsentChoice, enabled: boolean) => {
    setBusy(choice);
    setFailed(null);
    setOutcome(null);
    const next = await setConsentChoice(choice, enabled);
    setBusy(null);
    if (!next) {
      setFailed(choice);
      return;
    }
    setChoices(next);
    setOutcome({ choice, on: enabled });
  };

  return (
    <div className="mt-4 flex flex-col gap-6">
      <p className="text-sm leading-relaxed text-muted-foreground">{intro}</p>
      {!choices && !loadFailed ? <LoadingState placement="surface" /> : null}
      {loadFailed ? (
        <p role="alert" className="text-sm text-destructive">{COPY.loadFailed}</p>
      ) : null}
      {choices?.hasReceipt ? (
        <>
          <PracticeCard
            on={choices.personalisedPractice}
            busy={busy === "personalised_practice"}
            failed={failed === "personalised_practice"}
            outcome={outcome?.choice === "personalised_practice" ? outcome.on : null}
            erasureFinishing={choices.practiceErasureComplete === false}
            onChange={(enabled) => void change("personalised_practice", enabled)}
          />
          <SensitiveCard
            on={choices.sensitiveInformation}
            busy={busy === "sensitive_information"}
            failed={failed === "sensitive_information"}
            onChange={(enabled) => void change("sensitive_information", enabled)}
          />
        </>
      ) : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border p-5" aria-label={title}>
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-2 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/** A destructive change asks once before it happens. */
function Confirm({
  question,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl bg-muted p-4" role="group" aria-label={question}>
      <p className="text-sm leading-relaxed">{question}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={PRIMARY} onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className={BUTTON} onClick={onCancel}>
          {COPY.cancel}
        </button>
      </div>
    </div>
  );
}

function Failed({ show }: { show: boolean }) {
  return show ? (
    <p role="alert" className="text-sm text-destructive">{COPY.failed}</p>
  ) : null;
}

export function PracticeCard({
  on,
  busy,
  failed,
  outcome,
  erasureFinishing,
  onChange,
}: {
  on: boolean;
  busy: boolean;
  failed: boolean;
  outcome: boolean | null;
  erasureFinishing: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Card title={COPY.practiceTitle}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {COPY.practiceDescription}
      </p>
      {outcome !== null ? (
        <p role="status" className="text-sm">
          {outcome ? COPY.practiceOn : COPY.practiceOff}
        </p>
      ) : null}
      {erasureFinishing ? (
        <p className="text-sm text-muted-foreground">{COPY.erasureFinishing}</p>
      ) : null}
      {confirming ? (
        <Confirm
          question={COPY.turnOffConfirm}
          confirmLabel={COPY.turnOff}
          onConfirm={() => {
            setConfirming(false);
            onChange(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <div>
          <button
            type="button"
            className={BUTTON}
            disabled={busy}
            onClick={() => (on ? setConfirming(true) : onChange(true))}
          >
            {on ? COPY.turnOff : COPY.turnOn}
          </button>
        </div>
      )}
      <Failed show={failed} />
    </Card>
  );
}

export function SensitiveCard({
  on,
  busy,
  failed,
  onChange,
}: {
  on: boolean;
  busy: boolean;
  failed: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <Card title={COPY.sensitiveTitle}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {COPY.sensitiveText}
      </p>
      {!on ? <p role="status" className="text-sm">{COPY.recordingOff}</p> : null}
      {confirming ? (
        <Confirm
          question={COPY.withdrawConfirm}
          confirmLabel={COPY.withdraw}
          onConfirm={() => {
            setConfirming(false);
            onChange(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <div>
          <button
            type="button"
            className={BUTTON}
            disabled={busy}
            onClick={() => (on ? setConfirming(true) : onChange(true))}
          >
            {on ? COPY.withdraw : COPY.agreeAgain}
          </button>
        </div>
      )}
      <Failed show={failed} />
    </Card>
  );
}
