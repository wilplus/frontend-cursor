"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, ShieldCheck, Tag, CalendarDays, X } from "lucide-react";
import { bffFetch } from "@/lib/api/bffFetch";
import { isNativeApp } from "@/lib/auth/nativeSignIn";
import { shortDate, type LessonOffer, type PlanPromotion } from "@/lib/booking/offers";
import { money } from "@/lib/booking/time";
import { planLabel } from "@/components/tokens/copy";
import { ConsentAskActions } from "./ConsentAsk";
import { OFFER_PROMPT } from "./loungeOffers";
import { WhatsAppOfferActions, type WhatsAppOffer } from "./WillabWhatsAppPrompt";

/* -------------------------------------------------------------------------- */
/*  The bar at the top of the chat (founder 2026-11-03, backend N391; the     */
/*  prototype https://claude.ai/artifact/9gpMMFvLKFMysRE4Db8mMv).             */
/*                                                                            */
/*  Notifications come here, one at a time, never in the buttons under the    */
/*  chat. Once a visit the Lounge asks the backend (POST lounge/visit), which */
/*  makes the WhatsApp ask when it is due (N294 item 8, N295) and answers     */
/*  with the one ask for the bar (backend services/person_asks.py):           */
/*    whatsapp  the next visit's ask, or the CEO panel's: tap, its form as a  */
/*              sheet from the top                                            */
/*    consent   the CEO panel's question: tap, No | Yes as a sheet            */
/*    promo     their plan price: See prices (the web only: the iPhone app    */
/*              has no buying, N365 item 1)                                   */
/*    lesson    their lesson price: See times                                 */
/*  ✕ is Not now: the CEO panel's ask comes back on the next visit; the       */
/*  app's own WhatsApp ask is done once shown (the backend counts it).        */
/*  Every line is already signed (Never 4).                                   */
/* -------------------------------------------------------------------------- */

export interface BarAsk {
  id: string;
  kind: "whatsapp" | "consent" | "promo" | "lesson";
  consent_key: string | null;
  /** The next visit's WhatsApp ask opens with it (N295). */
  opener?: string;
  promotion?: PlanPromotion | null;
  lesson?: LessonOffer | null;
}

/** The CEO panel's consent ask (founder 2026-10-13, step 2). */
const CONSENT_LINE =
  "One question about how we use your data is still open. You can look at it and answer yes or no.";

const VISIT_KEY = "willab.lounge.visit";

/** Whether this Lounge load starts a visit: the first in the tab's session.
 *  Without storage every load is one; the backend still asks at most once a
 *  Take. */
function newVisit(): boolean {
  try {
    if (window.sessionStorage.getItem(VISIT_KEY)) return false;
    window.sessionStorage.setItem(VISIT_KEY, "1");
  } catch {
    // No storage (a private window, blocked site data): a visit each load.
  }
  return true;
}

function report(id: string, event: "shown" | "opened" | "answered") {
  void bffFetch(`/api/v2/user/asks/${encodeURIComponent(id)}`, {
    method: "POST",
    cache: "no-store",
    json: { event },
  }).catch(() => undefined);
}

/** The bar's words: the ask's own signed line. */
export function barText(ask: BarAsk): string | null {
  const p = ask.promotion;
  if (ask.kind === "promo") {
    return p
      ? `Artur set a price for you: ${planLabel(p.plan)} for ${money(p.price_cents, "usd")} instead of ${money(p.list_cents, "usd")}, until ${shortDate(p.ends_at)}.`
      : null;
  }
  const l = ask.lesson;
  if (ask.kind === "lesson") {
    return l
      ? `Artur set a price for you: a 1-on-1 lesson for ${money(l.price_cents, l.currency)} instead of ${money(l.list_price_cents, l.currency)}.`
      : null;
  }
  return ask.kind === "whatsapp" ? OFFER_PROMPT.whatsapp : CONSENT_LINE;
}

const ICON = { whatsapp: MessageCircle, consent: ShieldCheck, promo: Tag, lesson: CalendarDays };

export default function NoticeBar({ signedIn, whatsapp }: { signedIn: boolean; whatsapp: WhatsAppOffer }) {
  const router = useRouter();
  const [ask, setAsk] = useState<BarAsk | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    if (!signedIn || !newVisit()) return;
    let live = true;
    void bffFetch("/api/v2/user/lounge/visit", { method: "POST", cache: "no-store", json: {} }).then((r) => {
      const next = r.kind === "response" && r.ok ? ((r.body as { ask?: BarAsk | null } | null)?.ask ?? null) : null;
      if (!live || !next || !barText(next) || (next.kind === "promo" && isNativeApp())) return;
      setAsk(next);
      report(next.id, "shown");
    });
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!ask) return null;
  const text = barText(ask);
  const Icon = ICON[ask.kind];
  const close = () => {
    setSheet(false);
    setAsk(null);
  };
  const open = () => {
    if (ask.kind === "whatsapp" || ask.kind === "consent") {
      setSheet(true);
      return;
    }
    report(ask.id, "opened");
    close();
    router.push(ask.kind === "promo" ? "/dashboard/pricing" : `/book/${encodeURIComponent(ask.lesson?.slug ?? "artur")}`);
  };

  return (
    <>
      <div
        role="status"
        className="mx-2.5 mt-2 flex shrink-0 items-center gap-1 rounded-2xl border border-border bg-background py-1.5 pl-3 pr-1 shadow-md"
      >
        <button type="button" onClick={open} className="flex min-h-[52px] flex-1 items-center gap-3 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-muted">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex flex-col gap-0.5">
            {ask.opener ? <span className="text-[13px] text-muted-foreground">{ask.opener}</span> : null}
            <span className="text-[15px] font-semibold leading-snug text-foreground">{text}</span>
            {ask.kind === "promo" || ask.kind === "lesson" ? (
              <span className="mt-1 self-start rounded-full bg-primary px-4 py-2 text-[15px] font-semibold text-primary-foreground">
                {ask.kind === "promo" ? "See prices" : "See times"}
              </span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          aria-label="Not now"
          onClick={close}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
        >
          <X className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
      {sheet ? (
        <div className="fixed inset-0 z-50 bg-black/35" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={text ?? undefined}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 top-0 flex flex-col gap-3 rounded-b-[22px] bg-background px-4 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] shadow-xl"
          >
            {ask.kind === "whatsapp" ? (
              <>
                <p className="text-[17px] font-semibold leading-snug text-foreground">{text}</p>
                <WhatsAppOfferActions offer={whatsapp} onResolve={close} />
              </>
            ) : (
              <ConsentAskActions
                consentKey={ask.consent_key}
                onOpened={() => report(ask.id, "opened")}
                onAnswered={() => report(ask.id, "answered")}
                onResolve={close}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
