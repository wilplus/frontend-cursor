import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";

/* -------------------------------------------------------------------------- */
/*  loungeOffers — the Lounge's actionable "offers" as durable thread entries  */
/*                                                                            */
/*  Install (F2), the bad-joke offer (F7) and the credit gate (F1) are no       */
/*  longer transient footer popups: each is appended to the Lounge thread as a  */
/*  real, persisted bubble (kind "text" + a metadata discriminator, so it rides */
/*  the existing lounge_messages contract with no new BE kind). The bubble is   */
/*  clickable — re-opening it re-arms its action pair in the footer — and its    */
/*  resolution is registered in the thread like any other turn.                 */
/*                                                                            */
/*  The action buttons themselves live in the footer (replacing the record CTA  */
/*  while an offer is open); button labels stay with that UI because install's  */
/*  vary by platform. Here we own only the persisted shape + the prompt copy.   */
/* -------------------------------------------------------------------------- */

export type OfferType = "install" | "joke" | "credit";

const OFFER_TYPES: readonly OfferType[] = ["install", "joke", "credit"];

/** The bubble prompt persisted as the message body. No em-dashes (house style). */
export const OFFER_PROMPT: Record<OfferType, string> = {
  install:
    "Keep WillpowerLab one tap away. Add it to your home screen so your coach's insights are always with you.",
  joke:
    "I'm just a simple system, but I noticed you weren't feeling great. Want me to crack a very bad joke that won't be funny?",
  credit: "You've used your free analyses. Top up to keep recording.",
};

/** Build the persisted offer message. role "bot" so a fallback render (if the
 *  metadata is ever stripped) still reads as an ordinary Will bubble. */
export function offerDraft(type: OfferType): LoungeMessageDraft {
  return {
    role: "bot",
    kind: "text",
    body: OFFER_PROMPT[type],
    metadata: { offer: type },
  };
}

/** Defensive reader — metadata crosses the wire as Record<unknown>. Returns the
 *  offer type for an offer message, or null for any ordinary message. */
export function readOfferType(
  metadata: Record<string, unknown> | null | undefined
): OfferType | null {
  const v = metadata?.offer;
  return typeof v === "string" && (OFFER_TYPES as readonly string[]).includes(v)
    ? (v as OfferType)
    : null;
}

/** True when the thread already carries an offer of this type — the reload /
 *  re-trigger dedup guard so we never append the same offer twice. */
export function hasOffer(
  messages: Pick<LoungeMessage, "metadata">[],
  type: OfferType
): boolean {
  return messages.some((m) => readOfferType(m.metadata) === type);
}

/* ----------------------------- credit episode ----------------------------- */
/*  hasOffer only sees the currently-loaded message window (newest page), so it  */
/*  can't dedup a credit offer that has scrolled out of view. A localStorage     */
/*  marker — set when we offer, cleared when the user can record again — dedups   */
/*  one credit offer per depletion episode across reloads + history paging.      */

const CREDIT_OFFER_LIVE_KEY = "willab:credit-offer-live";

/** Whether a credit offer is already live for the current depletion episode. */
export function readCreditOfferLive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CREDIT_OFFER_LIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeCreditOfferLive(live: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (live) window.localStorage.setItem(CREDIT_OFFER_LIVE_KEY, "1");
    else window.localStorage.removeItem(CREDIT_OFFER_LIVE_KEY);
  } catch {
    /* swallow */
  }
}
