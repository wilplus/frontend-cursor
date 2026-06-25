"use client";

import { OFFER_PROMPT, type OfferType } from "./loungeOffers";

/* -------------------------------------------------------------------------- */
/*  OfferBubble — a persisted offer (install / joke / credit) rendered in the   */
/*  thread as a clickable bot bubble. Tapping it re-opens its action pair in     */
/*  the footer (the parent owns which offer is "active"); the bubble itself      */
/*  stays in the conversation as the durable record of the offer. Body comes     */
/*  from the persisted message, with the canonical prompt as a safe fallback.    */
/* -------------------------------------------------------------------------- */

export default function OfferBubble({
  type,
  body,
  active,
  onOpen,
}: {
  type: OfferType;
  body: string;
  active: boolean;
  onOpen: () => void;
}) {
  // D — render as a NORMAL grey bot bubble (same as any text bubble), not a
  // highlighted / orange-framed treatment. It stays tappable to re-open its
  // action pair, with only a subtle hover for affordance — no ring, no accent.
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={active}
      aria-label="Reopen this option"
      className="mr-auto block max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-left text-[15px] leading-relaxed text-foreground transition-colors hover:bg-muted/80"
    >
      {body || OFFER_PROMPT[type]}
    </button>
  );
}
