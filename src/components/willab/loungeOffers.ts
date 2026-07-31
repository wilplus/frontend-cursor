import type { LoungeMessage, LoungeMessageDraft } from "@/services/api/loungeMessages";

/* -------------------------------------------------------------------------- */
/*  loungeOffers — the Lounge's actionable "offers" as durable thread entries  */
/*                                                                            */
/*  Install (F2) and the legacy bad-joke offer (F7) are no                      */
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

/** The credit gate ("credit") is GONE with the credits system (founder
 *  2026-07-31). It was already unreachable: the BE hardcodes
 *  `can_start_analysis: True` ("every arc records/analyzes/sends free"), so the
 *  gate could not fire. Legacy `offer: "credit"` bubbles in old threads still
 *  render as ordinary bot text, which is exactly what the fallback was for. */
export type OfferType = "install" | "joke";

const OFFER_TYPES: readonly OfferType[] = ["install", "joke"];

/** The bubble prompt persisted as the message body. No em-dashes (house style). */
export const OFFER_PROMPT: Record<OfferType, string> = {
  install:
    "Keep WillpowerLab one tap away. Add it to your home screen so your coach's insights are always with you.",
  joke:
    "I'm just a simple system, but I noticed you weren't feeling great before this presentation. Want me to crack a joke?",
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
