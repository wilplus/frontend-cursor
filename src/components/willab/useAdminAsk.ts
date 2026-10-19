"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";
import { offerDraft, type OfferType } from "./loungeOffers";
import { shortDate, type LessonOffer, type PlanPromotion } from "@/lib/booking/offers";
import { money } from "@/lib/booking/time";
import { planLabel } from "@/components/tokens/copy";
import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  An ask the admin sent this person from their profile (founder 2026-10-13,  */
/*  step 2). It shows the next time they open the chat (founder 2026-10-18:   */
/*  waiting for their next Take, it never showed), in the footer slot the     */
/*  app's own offers use, one at a time:                                       */
/*    whatsapp     → the WhatsApp offer                                         */
/*    home_screen  → the add-to-home-screen offer (only where it can install)   */
/*    consent      → the question in the chat, answered No | Yes (ConsentAsk)  */
/*    promo        → their plan price, pointing to the pricing screen (step 3)  */
/*    lesson       → their lesson price, pointing to the booking page (step 3)  */
/*  While an ask is open the automatic offers hold back, so a Take never gets   */
/*  two questions.                                                             */
/* -------------------------------------------------------------------------- */

export interface AdminAsk {
  id: string;
  kind: "whatsapp" | "home_screen" | "consent" | "promo" | "lesson";
  consent_key: string | null;
  /** "shown": its bubble is already in their thread, so it is not posted again. */
  status?: "waiting" | "shown";
  promotion?: PlanPromotion | null;
  lesson?: LessonOffer | null;
}

interface Inputs {
  state: string;
  threadLoading: boolean;
  append: (draft: LoungeMessageDraft) => Promise<LoungeMessage>;
  installCanOffer: boolean;
  activeOffer: OfferType | null;
  openOffer: (type: OfferType) => void;
}

/** The chat itself, not the Lab over it nor a parked Take: never mid-recording. */
const AT_HOME = new Set(["lounge_idle", "review_pending", "insights_ready", "lounge_general"]);

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

function report(id: string, event: "shown" | "opened" | "answered") {
  void fetch(`/api/v2/user/asks/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => undefined);
}

export function useAdminAsk(inputs: Inputs) {
  const { state, threadLoading, append, installCanOffer, activeOffer, openOffer } = inputs;
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
    if (!ask || ask.status === "shown" || shownRef.current === ask.id || threadLoading) return;
    if (!AT_HOME.has(state) || activeOffer !== null) return;
    if (ask.kind === "home_screen" && !installCanOffer) return;
    shownRef.current = ask.id;
    const type = OFFER_FOR[ask.kind];
    void append(offerDraft(type, askBody(ask)));
    openOffer(type);
    report(ask.id, "shown");
  }, [ask, state, activeOffer, installCanOffer, threadLoading, append, openOffer]);

  const opened = useCallback(() => {
    if (ask) report(ask.id, "opened");
  }, [ask]);

  /** A consent ask answered in the chat: closed, and the app's own offers
   *  may come back. */
  const answered = useCallback(() => {
    if (!ask) return;
    report(ask.id, "answered");
    setAsk(null);
  }, [ask]);

  /** Hold the automatic offers while an ask is pending or loading. `bookHref`
   *  is where a lesson ask's "See times" goes. */
  return {
    held: ask !== null,
    opened,
    answered,
    consentKey: ask?.kind === "consent" ? ask.consent_key : null,
    bookHref: ask?.lesson ? `/book/${encodeURIComponent(ask.lesson.slug)}` : "/book/artur",
  };
}
