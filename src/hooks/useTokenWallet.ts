"use client";

import { useEffect, useState } from "react";
import {
  fetchTokenBalance,
  fetchTokenPrices,
  nextBalance,
  type TokenBalance,
  type TokenPrices,
} from "@/services/api/tokens";
import { WILLAB_TOKENS_SPENT_EVENT } from "@/lib/willabWindowEvents";

/* -------------------------------------------------------------------------- */
/*  useTokenWallet — the one read every wallet surface shares                  */
/*                                                                            */
/*  WHY `prices` IS THE ENABLED-PROBE AND `balance` IS NOT:                    */
/*                                                                            */
/*  Both endpoints answer {"enabled": false} when the flag is off, but the     */
/*  balance read has a SECOND failure mode — `available:false`, the account    */
/*  could not be read — and from an unknown balance you cannot tell "pricing   */
/*  is off" from "pricing is on and the lookup failed". Guessing wrong in one  */
/*  direction shows a wallet to a user who has no pricing; guessing wrong in   */
/*  the other hides one that exists.                                           */
/*                                                                            */
/*  `/v2/tokens/prices` has no such ambiguity: it is either the published list */
/*  or {"enabled": false}. So a parsed price list is what turns the wallet on, */
/*  and an unreadable BALANCE then renders as "unavailable" INSIDE a wallet we */
/*  already know should exist. A transient failure to read prices costs a      */
/*  session its chip and blocks nothing, which is the right way to be wrong.   */
/*                                                                            */
/*  Guests probe nothing: signed out, there is no wallet and no request.       */
/* -------------------------------------------------------------------------- */

export interface TokenWallet {
  /** null while probing; false → render NO wallet UI at all, not a zeroed one. */
  enabled: boolean | null;
  balance: TokenBalance;
  prices: TokenPrices | null;
}

/** How often the chip re-reads while the tab is open. Matches the legacy
 *  credits poll so the two never disagree about how fresh "now" is. */
const POLL_MS = 60_000;

export function useTokenWallet(active: boolean): TokenWallet {
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [probed, setProbed] = useState(false);
  const [balance, setBalance] = useState<TokenBalance>({ kind: "unknown" });

  /* Prices: once per page (memoised in the service), and the enabled-probe. */
  useEffect(() => {
    if (!active) {
      setProbed(true);
      setPrices(null);
      return;
    }
    let cancelled = false;
    void fetchTokenPrices().then((p) => {
      if (cancelled) return;
      setPrices(p);
      setProbed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  /* Balance: only once prices confirmed the wallet exists, so a flag-off user
   * never makes this request at all. */
  const enabled = probed ? prices !== null : null;

  useEffect(() => {
    if (enabled !== true) return;
    let cancelled = false;

    const read = async () => {
      const b = await fetchTokenBalance();
      if (cancelled) return;
      setBalance((prev) => nextBalance(prev, b));
    };

    void read();

    const onVisibleOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void read();
    };
    window.addEventListener("focus", onVisibleOrFocus);
    document.addEventListener("visibilitychange", onVisibleOrFocus);
    // A spend anywhere in the app re-reads immediately. Without this the chip
    // keeps showing the pre-purchase number until the next poll, which reads
    // as "it didn't go through" right after someone has paid.
    const onSpent = () => void read();
    window.addEventListener(WILLAB_TOKENS_SPENT_EVENT, onSpent);
    const intervalId = window.setInterval(() => void read(), POLL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onVisibleOrFocus);
      document.removeEventListener("visibilitychange", onVisibleOrFocus);
      window.removeEventListener(WILLAB_TOKENS_SPENT_EVENT, onSpent);
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  return { enabled, balance, prices };
}
