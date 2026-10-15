"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import {
  fetchWhatsAppPhone,
  normalizePhone,
  saveWhatsAppPhone,
} from "@/services/api/whatsapp";
import { hasOffer, offerDraft, readOfferType, type OfferType } from "./loungeOffers";
import SymmetricPair from "./SymmetricPair";

/* -------------------------------------------------------------------------- */
/*  WillabWhatsAppPrompt — the second Lounge offer (founder 2026-10-12).       */
/*                                                                            */
/*  Same shape as the install offer (WillabInstallPrompt): a persisted thread  */
/*  bubble plus a footer action pair that replaces the record button. It asks  */
/*  for a phone number so "The feedback from your coach is in!" also reaches   */
/*  the speaker on WhatsApp. It comes AFTER install, one offer per recording:  */
/*  the recording that brought the install offer brings nothing else, and the  */
/*  WhatsApp offer appears after the next one (or the first, when install      */
/*  cannot be offered on this device).                                         */
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
} as const;

export interface WhatsAppOffer {
  /** Signed in, no number saved yet, not turned down this session. */
  canOffer: boolean;
  /** Hide for now (this session). */
  softDismiss: () => void;
  /** A number was saved: never offer again. */
  markSaved: () => void;
}

interface TriggerInputs {
  /** The Lounge's flow state; the offer only appears at "review_pending". */
  state: string;
  messages: LoungeMessage[];
  threadLoading: boolean;
  append: (draft: LoungeMessageDraft) => Promise<LoungeMessage>;
  /** The Lounge's settle stamp: a recording_summary newer than it is a fresh
   *  in-session send (same gate as the install offer). */
  settleTimeRef: MutableRefObject<string | null>;
  /** May the install offer still be offered? It goes first: the WhatsApp
   *  offer waits until install is in the thread or cannot be offered. */
  installCanOffer: boolean;
  /** An ask the admin sent this person holds the automatic offers back. */
  held?: boolean;
  activeOffer: OfferType | null;
  openOffer: (type: OfferType) => void;
}

export function useWhatsAppOffer(inputs: TriggerInputs): WhatsAppOffer {
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchWhatsAppPhone().then((p) => {
      if (live) setPhone(p);
    });
    return () => {
      live = false;
    };
  }, []);

  const canOffer = phone === null && !dismissed;
  const softDismiss = useCallback(() => setDismissed(true), []);
  const markSaved = useCallback(() => setDismissed(true), []);

  useAutoOffer(inputs, canOffer);
  return { canOffer, softDismiss, markSaved };
}

/** Append + arm the offer once, after a fresh send that brought no other
 *  offer, once install has had its turn on an earlier recording. */
function useAutoOffer(inputs: TriggerInputs, canOffer: boolean) {
  const { state, messages, threadLoading, append, settleTimeRef } = inputs;
  const { installCanOffer, activeOffer, openOffer, held } = inputs;
  const handledRef = useRef(false);
  // The fresh recording during which an offer (install) was open: that
  // recording has had its offer, whatever the timestamps say.
  const offeredForRef = useRef<string | null>(null);
  useEffect(() => {
    const settle = settleTimeRef.current;
    if (activeOffer !== null && settle !== null) {
      offeredForRef.current = latestFreshSend(messages, settle) ?? offeredForRef.current;
    }
  }, [activeOffer, messages, settleTimeRef]);
  useEffect(() => {
    const settle = settleTimeRef.current;
    if (threadLoading || settle === null || handledRef.current) return;
    if (state !== "review_pending" || !canOffer) return;
    if (activeOffer !== null) return;
    if (held) return;
    if (installCanOffer && !hasOffer(messages, "install")) return;
    if (hasOffer(messages, "whatsapp")) return;
    const fresh = latestFreshSend(messages, settle);
    if (fresh === null || fresh === offeredForRef.current) return;
    if (offeredSince(messages, fresh)) return;
    handledRef.current = true;
    void append(offerDraft("whatsapp"));
    openOffer("whatsapp");
  }, [state, canOffer, installCanOffer, activeOffer, held, threadLoading, messages, append, openOffer, settleTimeRef]);
}

/** The newest recording_summary minted after the settle stamp, or null. */
function latestFreshSend(messages: LoungeMessage[], settle: string): string | null {
  let latest: string | null = null;
  for (const m of messages) {
    if (m.kind !== "recording_summary" || m.client_created_at <= settle) continue;
    if (latest === null || m.client_created_at > latest) latest = m.client_created_at;
  }
  return latest;
}

/** One offer per recording (founder 2026-10-12: "one by one, not two at
 *  once"): when this recording already brought an offer (install), the
 *  WhatsApp offer waits for the next one. */
function offeredSince(messages: LoungeMessage[], since: string): boolean {
  return messages.some((m) => readOfferType(m.metadata) !== null && m.client_created_at >= since);
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
  const [value, setValue] = useState("");
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
    offer.markSaved();
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
