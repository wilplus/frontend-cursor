"use client";

import { useEffect, useState } from "react";
import { fetchTokenPrices, priceOf } from "@/services/api/tokens";

/* -------------------------------------------------------------------------- */
/*  useActionPrice — the published price of ONE action, for its trigger        */
/*                                                                            */
/*  Every metered action shows what it costs ON the control, before it fires.  */
/*  This is the read behind that, and the only way a price should ever reach a */
/*  button: from the BE's list, by action key, never as a literal.             */
/*                                                                            */
/*  null means "show no price". It never means free, and it must never be      */
/*  replaced with a default — a wrong price on a button is worse than no       */
/*  price, because the user acts on it.                                        */
/*                                                                            */
/*  DELIBERATELY NOT USED FOR CHAT. Chat charges, but 150 tokens is noise next */
/*  to a 35,000 coach review, and pricing each message turns a conversation    */
/*  into a taxi meter that makes people count their words. Leave it unpriced   */
/*  in the UI — the wallet's price list is where someone can look it up.       */
/* -------------------------------------------------------------------------- */

export function useActionPrice(action: string): number | null {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTokenPrices().then((p) => {
      if (!cancelled) setPrice(priceOf(p, action));
    });
    return () => {
      cancelled = true;
    };
  }, [action]);

  return price;
}
