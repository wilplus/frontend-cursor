"use client";

/* -------------------------------------------------------------------------- */
/*  The AI version of your voice, in Data & consent (founder lock 2026-10-12, */
/*  N71; prototype "Settings with AI Voice", docs/design/ai-voice-settings-   */
/*  2026-10-12.html).                                                         */
/*                                                                            */
/*  On for everyone (it is part of the Terms). On: L7 and Delete, which asks  */
/*  first (L9) and then deletes the voice at the provider and here, with      */
/*  every clip made from it. Off: L10 and Turn on, which makes it again from  */
/*  the next Take. Hidden when the backend says it is not available. A Delete */
/*  the provider has not confirmed yet keeps the card as it was, with the     */
/*  page's "Couldn't save that", so Delete can be tried again.                */
/* -------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import {
  deleteAiVoice,
  readAiVoiceCard,
  turnOnAiVoice,
  type AiVoiceCard as CardState,
} from "@/services/api/aiVoice";
import { DATA_CONSENT_COPY as COPY } from "@/lib/legal/dataConsentCopy";
import { Confirm, Failed } from "./DataConsentChoices";

const BUTTON =
  "inline-flex h-10 items-center rounded-full border border-border bg-background px-5 text-sm font-medium text-foreground hover:bg-muted";

export default function AiVoiceCard() {
  const [card, setCard] = useState<CardState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    void readAiVoiceCard().then((result) => {
      if (alive && result.ok) setCard(result.data);
    });
    return () => { alive = false; };
  }, []);

  if (!card?.available) return null;

  const change = async (send: typeof turnOnAiVoice) => {
    setBusy(true);
    setFailed(false);
    const result = await send();
    setBusy(false);
    if (result.ok) setCard(result.data);
    setFailed(!result.ok || result.data.state === "deleting");
  };

  const off = card.state === "off";
  return (
    <section className="mt-6 rounded-2xl border border-border p-5" aria-label={COPY.aiVoiceTitle}>
      <h2 className="text-base font-semibold">{COPY.aiVoiceTitle}</h2>
      <div className="mt-2 flex flex-col gap-4">
        {off ? (
          <>
            <p role="status" className="text-sm leading-relaxed">{COPY.aiVoiceOff}</p>
            <div>
              <button type="button" className={BUTTON} disabled={busy} onClick={() => void change(turnOnAiVoice)}>
                {COPY.turnOn}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-muted-foreground">{COPY.aiVoiceOn}</p>
            {confirming ? (
              <Confirm
                question={COPY.aiVoiceDeleteConfirm}
                confirmLabel={COPY.aiVoiceDelete}
                onConfirm={() => {
                  setConfirming(false);
                  void change(deleteAiVoice);
                }}
                onCancel={() => setConfirming(false)}
              />
            ) : (
              <div>
                <button type="button" className={BUTTON} disabled={busy} onClick={() => setConfirming(true)}>
                  {COPY.aiVoiceDelete}
                </button>
              </div>
            )}
          </>
        )}
        <Failed show={failed} />
      </div>
    </section>
  );
}
