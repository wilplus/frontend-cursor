"use client";

import { useEffect, useState } from "react";
import {
  fetchArcCharges,
  priceForArcAction,
  resetArcCharges,
} from "@/services/api/tokens";
import { WILLAB_TOKENS_SPENT_EVENT } from "@/lib/willabWindowEvents";
import { TOKENS_COPY, formatTokens } from "./copy";

/* -------------------------------------------------------------------------- */
/*  ArcActionPrice — the price of a per-arc action, only while it is still due  */
/*                                                                            */
/*  For the actions charged ONCE PER ARC (`ref_id` is the arc id). It renders   */
/*  the price when this arc has NOT yet been charged, and NOTHING once it has,  */
/*  because from then on the action is genuinely free.                          */
/*                                                                            */
/*  That distinction is the entire point. A static label would be correct the   */
/*  first time and wrong every time after — and a stale price on a control is   */
/*  worse than no price, because people act on it: it would ask for money that  */
/*  is not owed and discourage re-opening something already paid for.           */
/*                                                                            */
/*  Silent in every uncertain case (pricing off, arc unreadable, action not     */
/*  published, older BE without the endpoint), because a label we cannot stand  */
/*  behind is worse than none. It never gates the action it labels.             */
/*                                                                            */
/*  NOT for chat: no `ref_id`, charged every turn, deliberately unpriced.       */
/* -------------------------------------------------------------------------- */

export default function ArcActionPrice({
  arcId,
  action,
  className,
}: {
  arcId: string;
  action: string;
  className?: string;
}) {
  const [price, setPrice] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchArcCharges(arcId).then((arc) => {
      if (!cancelled) setPrice(priceForArcAction(arc, action));
    });
    return () => {
      cancelled = true;
    };
  }, [arcId, action, nonce]);

  // A spend anywhere invalidates the memoised answer: the charge this label was
  // advertising may have just been taken, and the label has to disappear rather
  // than keep asking for money already paid.
  useEffect(() => {
    const onSpent = () => {
      resetArcCharges();
      setNonce((n) => n + 1);
    };
    window.addEventListener(WILLAB_TOKENS_SPENT_EVENT, onSpent);
    return () => window.removeEventListener(WILLAB_TOKENS_SPENT_EVENT, onSpent);
  }, []);

  if (price === null) return null;
  return (
    <span className={className ?? "text-[13px] font-normal text-muted-foreground"}>
      {TOKENS_COPY.actionPrice(formatTokens(price))}
    </span>
  );
}
