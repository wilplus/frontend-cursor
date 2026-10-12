"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Input } from "@/components/ui/input";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import {
  fetchWhatsAppPhone,
  normalizePhone,
  saveWhatsAppPhone,
} from "@/services/api/whatsapp";
import { hasOffer, offerDraft, type OfferType } from "./loungeOffers";
import SymmetricPair from "./SymmetricPair";

/* -------------------------------------------------------------------------- */
/*  WillabWhatsAppPrompt — the second Lounge offer (founder 2026-10-12).       */
/*                                                                            */
/*  Same shape as the install offer (WillabInstallPrompt): a persisted thread  */
/*  bubble plus a footer action pair that replaces the record button. It asks  */
/*  for a phone number so "The feedback from your coach is in!" also reaches   */
/*  the speaker on WhatsApp. It comes AFTER install: it waits until the        */
/*  install offer is in the thread (or cannot be offered) and the footer is    */
/*  free, so the two never compete for the slot.                               */
/* -------------------------------------------------------------------------- */

/** Footer and error copy (WhatsApp offer). No em-dashes (house style). */
export const WHATSAPP_COPY = {
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

/** Append + arm the offer once, after a fresh send, when install is done. */
function useAutoOffer(inputs: TriggerInputs, canOffer: boolean) {
  const { state, messages, threadLoading, append, settleTimeRef } = inputs;
  const { installCanOffer, activeOffer, openOffer } = inputs;
  const handledRef = useRef(false);
  useEffect(() => {
    const settle = settleTimeRef.current;
    if (threadLoading || settle === null || handledRef.current) return;
    if (state !== "review_pending" || !canOffer) return;
    if (activeOffer !== null) return;
    if (installCanOffer && !hasOffer(messages, "install")) return;
    if (hasOffer(messages, "whatsapp")) return;
    const freshSend = messages.some(
      (m) => m.kind === "recording_summary" && m.client_created_at > settle,
    );
    if (!freshSend) return;
    handledRef.current = true;
    void append(offerDraft("whatsapp"));
    openOffer("whatsapp");
  }, [state, canOffer, installCanOffer, activeOffer, threadLoading, messages, append, openOffer, settleTimeRef]);
}

/** The footer while the WhatsApp offer is open: the number field, then the
 *  Not now | Save pair. `onResolve` returns the record button. */
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

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Input
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
          autoFocus
        />
        {error ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
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
