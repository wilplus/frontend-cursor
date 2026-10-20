"use client";

import { useCallback, useEffect, useState } from "react";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import {
  fetchWhatsAppPhone,
  normalizePhone,
  saveWhatsAppPhone,
} from "@/services/api/whatsapp";
import SymmetricPair from "./SymmetricPair";

/* -------------------------------------------------------------------------- */
/*  WillabWhatsAppPrompt — the second Lounge offer (founder 2026-10-12).       */
/*                                                                            */
/*  Same shape as the install offer (WillabInstallPrompt): a persisted thread  */
/*  bubble plus a footer action pair that replaces the record button. It asks  */
/*  for a phone number so "The feedback from your coach is in!" also reaches   */
/*  the speaker on WhatsApp. It is asked at the end of a Take, from Take 2,    */
/*  at most twice, as that Take's one ask (founder 2026-10-20; the backend    */
/*  writes it, services/after_take.py); it no longer comes at send time.      */
/* -------------------------------------------------------------------------- */

/** Footer and error copy (WhatsApp offer). No em-dashes (house style). */
export const WHATSAPP_COPY = {
  // The card's title (founder 2026-10-15), word for word.
  title: "We will only use it to let you know your coach texted you",
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
 *  card, then Not now | Save, as the install offer. `onResolve` returns the
 *  record button. */
export function WhatsAppOfferActions({
  offer,
  onResolve,
}: {
  offer: WhatsAppOffer;
  onResolve: () => void;
}) {
  const [value, setValue] = useState(offer.draft ?? offer.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const phone = normalizePhone(value);
    if (!phone) {
      setError(WHATSAPP_COPY.invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await saveWhatsAppPhone(phone);
    setSaving(false);
    if (!ok) {
      setError(WHATSAPP_COPY.failed);
      return;
    }
    offer.markSaved(phone);
    onResolve();
  };

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
        <p className="mb-2 text-[13px] font-medium text-foreground">
          {WHATSAPP_COPY.title}
        </p>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-label={WHATSAPP_COPY.label}
          aria-invalid={error ? true : undefined}
          placeholder={WHATSAPP_COPY.placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          disabled={saving}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        {error ? (
          <p role="alert" className="mt-2 text-[13px] text-destructive">
            {error}
          </p>
        ) : null}
      </form>
      <SymmetricPair
        closeLabel={WHATSAPP_COPY.notNow}
        onClose={() => {
          offer.softDismiss();
          onResolve();
        }}
        actionLabel={saving ? WHATSAPP_COPY.saving : WHATSAPP_COPY.save}
        onAction={() => void save()}
      />
    </div>
  );
}
