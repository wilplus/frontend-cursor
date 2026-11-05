"use client";

import { useEffect, useRef, useState } from "react";
import { confirmNumberCode, sendNumberCode } from "@/services/api/whatsappNumber";
import PhoneNumberField from "@/components/phone/PhoneNumberField";
import { WHATSAPP_AUTH_COPY } from "@/components/auth/WhatsAppAuth";
import { AnswerPair } from "./WillQuestion";
import { WHATSAPP_COPY, type WhatsAppOffer } from "./WillabWhatsAppPrompt";

/* The WhatsApp offer's form (WillabWhatsAppPrompt.tsx has the offer, its
   words and the hook): loaded when it opens, not with the chat. */

/** Supabase asks for a pause between two codes to one number. */
const RESEND_AFTER_MS = 60_000;

/** The footer while the WhatsApp offer is open: the number field in a grey
 *  card, then "Not now" as a grey word and Save as the answer (backend N467
 *  item 7); after Save, the code WhatsApp brings, then Not now and Continue (backend N230: the number is
 *  checked once, then it gets the messages and signs in). `onResolve`
 *  returns the record button. */
export default function WhatsAppOfferActions({
  offer,
  onResolve,
}: {
  offer: WhatsAppOffer;
  onResolve: () => void;
}) {
  const [number, setNumber] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [canResend, setCanResend] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const done = (phone: string) => {
    offer.markSaved(phone);
    onResolve();
  };

  const send = async (phone: string) => {
    const sent = await sendNumberCode(phone);
    if (sent === "failed" || sent === "taken") {
      setError(sent === "taken" ? WHATSAPP_COPY.taken : WHATSAPP_COPY.failed);
      return;
    }
    if (sent === "same") {
      done(phone);
      return;
    }
    setSentTo(phone);
    setCanResend(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCanResend(true), RESEND_AFTER_MS);
  };

  // A number typed in the chat: its code goes at once (backend N235).
  const { sendNow, draft, sentNow } = offer;
  useEffect(() => {
    if (!sendNow || !draft?.startsWith("+")) return;
    sentNow();
    setSaving(true);
    void send(draft).finally(() => setSaving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (saving || !number) return;
    setSaving(true);
    setError(null);
    await send(number);
    setSaving(false);
  };

  const confirm = async () => {
    const token = code.replace(/\D/g, "");
    if (saving || !sentTo || !token) return;
    setSaving(true);
    setError(null);
    const ok = await confirmNumberCode(sentTo, token);
    setSaving(false);
    if (!ok) {
      setError(WHATSAPP_AUTH_COPY.wrongCode);
      return;
    }
    done(sentTo);
  };

  const resend = async () => {
    if (!sentTo || !canResend || saving) return;
    setSaving(true);
    setError(null);
    await send(sentTo);
    setSaving(false);
  };

  const notNow = () => {
    offer.softDismiss();
    onResolve();
  };

  const problem = error ? (
    <p role="alert" className="mt-2 text-[13px] text-destructive">
      {error}
    </p>
  ) : null;

  if (sentTo) {
    return (
      <div className="flex flex-col gap-3">
        <form
          className="rounded-xl bg-muted p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          <label htmlFor="whatsapp-offer-code" className="block text-[13px] font-medium text-foreground">
            {WHATSAPP_AUTH_COPY.codeTitle}
          </label>
          <p className="mb-2 text-[13px] text-muted-foreground">{sentTo}</p>
          <input
            id="whatsapp-offer-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="••••••"
            value={code}
            disabled={saving}
            autoFocus
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-center text-lg tracking-[0.4em] text-foreground focus:border-primary focus:outline-none"
          />
          {problem}
          <div className="mt-2 flex justify-between text-[13px]">
            <button type="button" onClick={() => void resend()} disabled={!canResend || saving}
              className="min-h-[36px] text-muted-foreground hover:underline disabled:opacity-50 disabled:hover:no-underline">
              {WHATSAPP_AUTH_COPY.resend}
            </button>
            <button type="button" onClick={() => { setSentTo(null); setCode(""); setError(null); }}
              className="min-h-[36px] text-muted-foreground hover:underline">
              {WHATSAPP_AUTH_COPY.otherNumber}
            </button>
          </div>
        </form>
        <AnswerPair
          closeLabel={WHATSAPP_COPY.notNow}
          onClose={notNow}
          actionLabel={WHATSAPP_AUTH_COPY.continue}
          onAction={() => void confirm()}
        />
      </div>
    );
  }

  // The grey card on top (here the number field), then "Not now" as a grey
  // word and Save as the answer on your side (backend N467 item 7).
  return (
    <div className="flex flex-col gap-3">
      <form
        className="rounded-xl bg-muted p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p id="whatsapp-offer-title" className="mb-2 text-[13px] font-medium text-foreground">
          {WHATSAPP_COPY.title}
        </p>
        <PhoneNumberField
          id="whatsapp-offer-number"
          label="whatsapp-offer-title"
          initial={offer.draft ?? offer.phone}
          disabled={saving}
          onChange={(next) => {
            setNumber(next);
            if (error) setError(null);
          }}
        />
        {problem}
      </form>
      <AnswerPair
        closeLabel={WHATSAPP_COPY.notNow}
        onClose={notNow}
        actionLabel={saving ? WHATSAPP_COPY.saving : WHATSAPP_COPY.save}
        onAction={() => void save()}
      />
    </div>
  );
}
