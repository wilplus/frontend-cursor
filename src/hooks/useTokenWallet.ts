"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchTokenBalance,
  fetchTokenPricesRead,
  nextBalance,
  resetTokenPricesCache,
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

/** The probe, with the three outcomes kept apart.
 *
 *  `enabled` below collapses "probing" and "failed" into the same falsy-ish
 *  value, which is exactly how a failed read used to render as a silent,
 *  plans-less page. Surfaces that can show a retry read THIS; surfaces that
 *  only need "is there a wallet at all" can keep reading `enabled`. */
export type TokenPricesState = "probing" | "off" | "failed" | "ready";

export interface TokenWallet {
  /** null while probing; false → render NO wallet UI at all, not a zeroed one.
   *  A FAILED read is also false here, so anything that needs to tell the two
   *  apart must read `pricesState`. */
  enabled: boolean | null;
  pricesState: TokenPricesState;
  /** User-initiated only. Clears the memoised read first — without that, a
   *  retry re-serves the same cached failure. No auto-polling: a wallet that
   *  retries by itself hammers a struggling backend. */
  retryPrices: () => void;
  balance: TokenBalance;
  prices: TokenPrices | null;
}

/** How often the chip re-reads while the tab is open. Matches the legacy
 *  credits poll so the two never disagree about how fresh "now" is. */
const POLL_MS = 60_000;

export function useTokenWallet(active: boolean): TokenWallet {
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [pricesState, setPricesState] = useState<TokenPricesState>("probing");
  // Bumped by retryPrices to re-run the probe effect.
  const [attempt, setAttempt] = useState(0);
  const [balance, setBalance] = useState<TokenBalance>({ kind: "unknown" });

  /* Prices: once per page (memoised in the service), and the enabled-probe. */
  useEffect(() => {
    if (!active) {
      // Signed out is "off", not a failure: no wallet, nothing to retry.
      setPricesState("off");
      setPrices(null);
      return;
    }
    let cancelled = false;
    setPricesState("probing");
    void fetchTokenPricesRead().then((r) => {
      if (cancelled) return;
      setPrices(r.kind === "ready" ? r.prices : null);
      setPricesState(r.kind);
    });
    return () => {
      cancelled = true;
    };
  }, [active, attempt]);

  const retryPrices = useCallback(() => {
    resetTokenPricesCache();
    setAttempt((n) => n + 1);
  }, []);

  /* Balance: only once prices confirmed the wallet exists, so a flag-off user
   * never makes this request at all. */
  const enabled = pricesState === "probing" ? null : pricesState === "ready";

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

  return { enabled, pricesState, retryPrices, balance, prices };
}
