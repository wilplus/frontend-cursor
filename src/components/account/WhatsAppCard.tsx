"use client";

/* -------------------------------------------------------------------------- */
/*  WhatsApp, in Data & consent (founder 2026-10-15, fix 2: "I approve the 7  */
/*  fixes as in the prototype"). Privacy 3.6 §4: the number is given by       */
/*  adding it in the Lounge and can be removed here at any time. Shown only   */
/*  while a number is saved, and after Remove until the page is left.         */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { fetchWhatsAppPhone, removeWhatsAppPhone } from "@/services/api/whatsapp";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import { Confirm, Failed } from "./DataConsentChoices";

const BUTTON =
  "inline-flex h-10 items-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-muted";

export default function WhatsAppCard() {
  // undefined: not read yet or unreadable; null: no number.
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [removed, setRemoved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchWhatsAppPhone().then((value) => {
      if (alive) setPhone(value);
    });
    return () => { alive = false; };
  }, []);

  if (!phone && !removed) return null;

  const remove = async () => {
    setConfirming(false);
    setBusy(true);
    setFailed(false);
    const ok = await removeWhatsAppPhone();
    setBusy(false);
    if (ok) {
      setPhone(null);
      setRemoved(true);
    } else {
      setFailed(true);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-border p-5" aria-label={COPY.whatsappTitle}>
      <h2 className="text-base font-semibold">{COPY.whatsappTitle}</h2>
      <div className="mt-2 flex flex-col gap-4">
        {phone ? (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">{COPY.whatsappOn(phone)}</p>
            {confirming ? (
              <Confirm
                question={`${COPY.whatsappConfirmTitle} ${COPY.whatsappConfirmBody}`}
                confirmLabel={COPY.whatsappRemove}
                onConfirm={() => void remove()}
                onCancel={() => setConfirming(false)}
              />
            ) : (
              <div>
                <button type="button" className={BUTTON} disabled={busy} onClick={() => setConfirming(true)}>
                  {COPY.whatsappRemove}
                </button>
              </div>
            )}
          </>
        ) : (
          <p role="status" className="text-sm leading-relaxed">{COPY.whatsappOff}</p>
        )}
        <Failed show={failed} />
      </div>
    </section>
  );
}
