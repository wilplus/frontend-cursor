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
/*  step 2). It shows at the end of a Take, from Take 2, as that Take's one    */
/*  ask (founder 2026-10-20: one action at a time; it no longer shows when    */
/*  the chat opens): the backend holds the message after the Take for it      */
/*  (held_for "admin", services/after_take.py), and the Lounge lets that      */
/*  message go when the ask closes. "Not now" leaves it open, so it comes     */
/*  back after the next Take. In the footer slot the app's own offers use:    */
/*    whatsapp     → the WhatsApp offer                                         */
/*    home_screen  → the add-to-home-screen offer (only where it can install)   */
/*    consent      → the question in the chat, answered No | Yes (ConsentAsk)  */
/*    promo        → their plan price, pointing to the pricing screen (step 3)  */
/*    lesson       → their lesson price, pointing to the booking page (step 3)  */
/*  A Take never gets two asks: the backend picks one.                         */
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
  threadLoading: boolean;
  append: (draft: LoungeMessageDraft) => Promise<LoungeMessage>;
  installCanOffer: boolean;
  openOffer: (type: OfferType) => void;
  /** The message after a Take held back for this ask (its client_id), or null. */
  waitingId: string | null;
  /** That message's Take: the ask's bubble is stamped with it, so the chat
   *  keeps the Take's card above the ask and the ask above its buttons
   *  (founder 2026-10-20: the card landed between the question and its
   *  buttons). */
  waitingTake?: string | null;
  /** The ask's bubble already in the thread for that message (a reload), or null. */
  asked: OfferType | null;
  /** Let that message go: the ask cannot show, or there is none. */
  letGo: () => void;
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

function report(id: string, event: "shown" | "opened" | "answered") {
  void fetch(`/api/v2/user/asks/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => undefined);
}

export function useAdminAsk(inputs: Inputs) {
  const { threadLoading, append, installCanOffer, openOffer, waitingId, waitingTake = null, asked, letGo } = inputs;
  const [ask, setAsk] = useState<AdminAsk | null>(null);
  // The held message this ask was shown for: once per Take.
  const shownForRef = useRef<string | null>(null);
  const liveRef = useRef(true);
  useEffect(() => () => {
    liveRef.current = false;
  }, []);

  useEffect(() => {
    if (!waitingId || threadLoading || shownForRef.current === waitingId) return;
    shownForRef.current = waitingId;
    // Read now, not at mount: the ask may have been sent since the chat opened.
    void bffFetch("/api/v2/user/asks/next", { auth: "optional", cache: "no-store" }).then((r) => {
      const body = r.kind === "response" && r.ok ? (r.body as { ask?: AdminAsk | null } | null) : null;
      const next = body?.ask ?? null;
      if (!liveRef.current) return;
      if (!next || (next.kind === "home_screen" && !installCanOffer)) {
        letGo();
        return;
      }
      setAsk(next);
      const type = OFFER_FOR[next.kind];
      if (asked) {
        openOffer(asked); // its bubble is there: the form opens again
        return;
      }
      const draft = offerDraft(type, askBody(next));
      void append({
        ...draft,
        metadata: { ...draft.metadata, after_take: waitingId, ...(waitingTake ? { take_session_id: waitingTake } : {}) },
      });
      openOffer(type);
      report(next.id, "shown");
    });
  }, [waitingId, waitingTake, asked, threadLoading, installCanOffer, append, openOffer, letGo]);

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

  /** `bookHref` is where a lesson ask's "See times" goes. */
  return {
    opened,
    answered,
    consentKey: ask?.kind === "consent" ? ask.consent_key : null,
    bookHref: ask?.lesson ? `/book/${encodeURIComponent(ask.lesson.slug)}` : "/book/artur",
  };
}
