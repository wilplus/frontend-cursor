"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import { offerDraft, type OfferType } from "./loungeOffers";
import { shortDate, type LessonOffer, type PlanPromotion } from "@/lib/booking/offers";
import { money } from "@/lib/booking/time";
import { planLabel } from "@/components/tokens/copy";
import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  An ask the admin sent this person from their profile (founder 2026-10-13,  */
/*  step 2). It shows after their next fresh Take, in the footer slot the app's */
/*  own offers use, one at a time:                                             */
/*    whatsapp     → the WhatsApp offer                                         */
/*    home_screen  → the add-to-home-screen offer (only where it can install)   */
/*    consent      → a pointer to the Data & consent page                       */
/*    promo        → their plan price, pointing to the pricing screen (step 3)  */
/*    lesson       → their lesson price, pointing to the booking page (step 3)  */
/*  While an ask is open the automatic offers hold back, so a Take never gets   */
/*  two questions.                                                             */
/* -------------------------------------------------------------------------- */

export interface AdminAsk {
  id: string;
  kind: "whatsapp" | "home_screen" | "consent" | "promo" | "lesson";
  consent_key: string | null;
  promotion?: PlanPromotion | null;
  lesson?: LessonOffer | null;
}

interface Inputs {
  state: string;
  messages: LoungeMessage[];
  threadLoading: boolean;
  append: (draft: LoungeMessageDraft) => Promise<LoungeMessage>;
  settleTimeRef: MutableRefObject<string | null>;
  installCanOffer: boolean;
  activeOffer: OfferType | null;
  openOffer: (type: OfferType) => void;
}

const OFFER_FOR: Record<AdminAsk["kind"], OfferType> = {
  whatsapp: "whatsapp",
  home_screen: "install",
  consent: "consent",
  promo: "promo",
  lesson: "lesson",
};

/** The bubble for a price ask, with the exact price it tells them about. */
function askBody(ask: AdminAsk): string | undefined {
  const p = ask.promotion;
  if (ask.kind === "promo" && p) {
    return `Artur set a price for you: ${planLabel(p.plan)} for ${money(p.price_cents, "usd")} instead of ${money(p.list_cents, "usd")}, until ${shortDate(p.ends_at)}.`;
  }
  const l = ask.lesson;
  if (ask.kind === "lesson" && l) {
    return `Artur set a price for you: a 1-on-1 lesson for ${money(l.price_cents, l.currency)} instead of ${money(l.list_price_cents, l.currency)}.`;
  }
  return undefined;
}

function report(id: string, event: "shown" | "opened") {
  void fetch(`/api/v2/user/asks/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => undefined);
}

export function useAdminAsk(inputs: Inputs) {
  const { state, messages, threadLoading, append, settleTimeRef, installCanOffer, activeOffer, openOffer } = inputs;
  // undefined = still asking the server; null = nothing waiting.
  const [ask, setAsk] = useState<AdminAsk | null | undefined>(undefined);
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    void bffFetch("/api/v2/user/asks/next", { auth: "optional", cache: "no-store" }).then((r) => {
      const body = r.kind === "response" && r.ok ? (r.body as { ask?: AdminAsk | null } | null) : null;
      if (live) setAsk(body?.ask ?? null);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const settle = settleTimeRef.current;
    if (!ask || shownRef.current === ask.id || threadLoading || settle === null) return;
    if (state !== "review_pending" || activeOffer !== null) return;
    if (ask.kind === "home_screen" && !installCanOffer) return;
    const fresh = messages.some((m) => m.kind === "recording_summary" && m.client_created_at > settle);
    if (!fresh) return;
    shownRef.current = ask.id;
    const type = OFFER_FOR[ask.kind];
    void append(offerDraft(type, askBody(ask)));
    openOffer(type);
    report(ask.id, "shown");
  }, [ask, state, activeOffer, installCanOffer, threadLoading, messages, append, openOffer, settleTimeRef]);

  const opened = useCallback(() => {
    if (ask) report(ask.id, "opened");
  }, [ask]);

  /** Hold the automatic offers while an ask is pending or loading. `bookHref`
   *  is where a lesson ask's "See times" goes. */
  return {
    held: ask !== null,
    opened,
    bookHref: ask?.lesson ? `/book/${encodeURIComponent(ask.lesson.slug)}` : "/book/artur",
  };
}
