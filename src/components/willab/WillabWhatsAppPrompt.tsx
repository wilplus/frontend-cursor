"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import { fetchWhatsAppPhone } from "@/services/api/whatsapp";
import { confirmNumberCode, sendNumberCode } from "@/services/api/whatsappNumber";
import PhoneNumberField from "@/components/phone/PhoneNumberField";
import { WHATSAPP_AUTH_COPY } from "@/components/auth/WhatsAppAuth";
import SymmetricPair from "./SymmetricPair";

/** Supabase asks for a pause between two codes to one number. */
const RESEND_AFTER_MS = 60_000;

/* -------------------------------------------------------------------------- */
/*  WillabWhatsAppPrompt — the second Lounge offer (founder 2026-10-12).       */
/*                                                                            */
/*  Same shape as the install offer (WillabInstallPrompt): a persisted thread  */
/*  bubble plus a footer action pair that replaces the record button. It asks  */
/*  for a phone number so "The feedback from your coach is in!" also reaches   */
/*  the speaker on WhatsApp. It is asked at the end of a Take, from Take 1    */
/*  (backend N171), at most twice, as that Take's one ask (founder 2026-10-20; */
/*  the backend writes it, services/after_take.py). The same number gets the  */
/*  booking's reminder (backend N207); the booking form asks for none. Save   */
/*  sends a code on WhatsApp; once it is typed the number gets the messages  */
/*  and signs in with WhatsApp (backend N230).                               */
/* -------------------------------------------------------------------------- */

/** Footer and error copy (WhatsApp offer). No em-dashes (house style). */
export const WHATSAPP_COPY = {
  // The card's title (founder 2026-10-15), word for word; the call added
  // when the booking's reminder came to this number (backend N207).
  title: "We will only use it to let you know your coach texted you, or that your call starts soon.",
  label: "Phone number for WhatsApp",
  placeholder: "+44 7700 900123",
  notNow: "Not now",
  save: "Save",
  saving: "Saving…",
  invalid: "Enter the number with its country code, for example +44 7700 900123.",
  failed: "Could not save the number. Try again.",
  // After Save (founder 2026-10-15, approved in chat): the confirmation
  // bubble, with the saved number.
  saved: (phone: string) =>
    `Saved ✓ We'll message you on WhatsApp at ${phone} when your coach's feedback is in.`,
} as const;

export interface WhatsAppOffer {
  /** Signed in, no number saved yet, not turned down this session. */
  canOffer: boolean;
  /** The number saved so far, shown in the form so a change starts from it. */
  phone: string | null;
  /** Hide for now (this session). */
  softDismiss: () => void;
  /** A number was saved: never offer again, and say so in the thread. */
  markSaved: (phone: string) => void;
  /** Read the number again: one typed in the chat was saved there (founder
   *  2026-10-20), and the chat's reply already says so. */
  refresh: () => void;
  /** What the form opens with: a number typed in the chat without its
   *  country code (founder 2026-10-20), so it is fixed, not typed twice. */
  draft: string | null;
  setDraft: (draft: string | null) => void;
}

export function useWhatsAppOffer(inputs: {
  append: (draft: LoungeMessageDraft) => Promise<LoungeMessage>;
}): WhatsAppOffer {
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchWhatsAppPhone().then((p) => {
      if (live) setPhone(p);
    });
    return () => {
      live = false;
    };
  }, []);

  const { append } = inputs;
  const canOffer = phone === null && !dismissed;
  const softDismiss = useCallback(() => setDismissed(true), []);
  const markSaved = useCallback(
    (saved: string) => {
      setDismissed(true);
      setPhone(saved);
      setDraft(null);
      // The confirmation the speaker asked for (founder 2026-10-15): a
      // bubble in the thread, so it survives reload like every other turn.
      void append({ role: "bot", kind: "text", body: WHATSAPP_COPY.saved(saved) });
    },
    [append],
  );

  const refresh = useCallback(() => {
    void fetchWhatsAppPhone().then((p) => {
      if (p !== undefined) setPhone(p);
    });
  }, []);

  return { canOffer, phone: phone ?? null, softDismiss, markSaved, refresh, draft, setDraft };
}

/** The footer while the WhatsApp offer is open: the number field in a grey
 *  card, then Not now | Save, as the install offer; after Save, the code
 *  WhatsApp brings, then Not now | Continue (backend N230: the number is
 *  checked once, then it gets the messages and signs in). `onResolve`
 *  returns the record button. */
export function WhatsAppOfferActions({
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
    if (sent === "failed") {
      setError(WHATSAPP_COPY.failed);
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
        <SymmetricPair
          closeLabel={WHATSAPP_COPY.notNow}
          onClose={notNow}
          actionLabel={WHATSAPP_AUTH_COPY.continue}
          onAction={() => void confirm()}
        />
      </div>
    );
  }

  // Laid out like the install offer (founder 2026-10-12): the grey card on
  // top (here the number field), then the same Not now | Save pair below.
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
      <SymmetricPair
        closeLabel={WHATSAPP_COPY.notNow}
        onClose={notNow}
        actionLabel={saving ? WHATSAPP_COPY.saving : WHATSAPP_COPY.save}
        onAction={() => void save()}
      />
    </div>
  );
}
