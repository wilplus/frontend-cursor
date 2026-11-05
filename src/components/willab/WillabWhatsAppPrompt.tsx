"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import { fetchWhatsAppPhone } from "@/services/api/whatsapp";
import { NOT_NOW } from "@/lib/willab/leaveWords";
import { afterChatBoot } from "@/lib/chatBoot";

/* -------------------------------------------------------------------------- */
/*  WillabWhatsAppPrompt — the second Lounge offer (founder 2026-10-12).       */
/*                                                                            */
/*  Same shape as the other offers (loungeOffers.ts): a persisted thread      */
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
  notNow: NOT_NOW,
  save: "Save",
  saving: "Saving…",
  invalid: "Enter the number with its country code, for example +44 7700 900123.",
  failed: "Could not save the number. Try again.",
  // A number another account signs in with (founder 2026-10-28, backend N235).
  taken: "That number already has an account.",
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
  /** A full number typed in the chat (backend N235): the form opens with it
   *  and sends its code at once. */
  sendNow: boolean;
  checkNumber: (phone: string) => void;
  sentNow: () => void;
}

export function useWhatsAppOffer(inputs: {
  append: (draft: LoungeMessageDraft) => Promise<LoungeMessage>;
}): WhatsAppOffer {
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [sendNow, setSendNow] = useState(false);
  const checkNumber = useCallback((number: string) => {
    setDraft(number);
    setSendNow(true);
  }, []);
  const sentNow = useCallback(() => setSendNow(false), []);

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
  useEffect(() => (canOffer ? afterChatBoot(warmWhatsAppForm) : undefined), [canOffer]);
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

  return { canOffer, phone: phone ?? null, softDismiss, markSaved, refresh, draft, setDraft, sendNow, checkNumber, sentNow };
}

/** The footer while the WhatsApp offer is open (WillabWhatsAppForm.tsx). It
 *  opens on a tap or after a reply, never on first paint: off the boot
 *  bundle, with the phone field and its country list, and fetched once the
 *  chat has painted for whoever can still be offered it, so it opens at once. */
export const WhatsAppOfferActions = dynamic(() => import("./WillabWhatsAppForm"), { ssr: false, loading: () => null });
export function warmWhatsAppForm(): void {
  void import("./WillabWhatsAppForm").catch(() => undefined);
}
