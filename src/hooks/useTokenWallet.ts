"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchTokenBalanceShared,
  fetchTokenPricesRead,
  forgetSharedTokenBalance,
  forgetWallet,
  nextBalance,
  recallWallet,
  rememberWallet,
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
/*  direction shows a wallet to a user who has no pricing; guessing wrong in  */
/*  the other hides one that exists.                                           */
/*                                                                            */
/*  `/v2/tokens/prices` has no such ambiguity: it is either the published list */
/*  or {"enabled": false}. So a parsed price list is what turns the wallet on, */
/*  and an unreadable BALANCE then renders as "unavailable" INSIDE a wallet we */
/*  already know should exist. A transient failure to read prices costs a      */
/*  session its chip and blocks nothing, which is the right way to be wrong.   */
/*                                                                            */
/*  Guests probe nothing: signed out, there is no wallet and no request.       */
/*                                                                            */
/*  Prices AND balance are memoised in the service, so the header's chip and   */
/*  the Lounge's top-up card (two instances of this hook) cost one request     */
/*  each per page, not two (founder 2026-10-16).                               */
/*                                                                            */
/*  A RELOAD SHOWS THE LAST WALLET FIRST (founder 2026-10-18). The pair this   */
/*  tab last saw comes back from sessionStorage the moment the hook mounts,   */
/*  so the chip is there while the live probe and read run; their answer      */
/*  replaces it. Nothing is invented: it is the number the tab showed a       */
/*  moment ago, and a spend or sign-out drops it.                             */
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

/** A tab switch raises `focus` AND `visibilitychange` within a few ms of
 *  each other; one refresh answers both. */
const REFRESH_DEBOUNCE_MS = 250;

export function useTokenWallet(active: boolean): TokenWallet {
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [pricesState, setPricesState] = useState<TokenPricesState>("probing");
  // Bumped by retryPrices to re-run the probe effect.
  const [attempt, setAttempt] = useState(0);
  const [balance, setBalance] = useState<TokenBalance>({ kind: "unknown" });
  // Whether this mount has been signed in: the hook starts inactive while
  // the page boots, and that is not a sign-out.
  const wasActive = useRef(false);

  /* Prices: once per page (memoised in the service), and the enabled-probe. */
  useEffect(() => {
    if (!active) {
      // Signed out is "off", not a failure: no wallet, nothing to retry —
      // and, after a sign-out, nothing to recall for whoever signs in next
      // in this tab.
      setPricesState("off");
      setPrices(null);
      if (wasActive.current) forgetWallet();
      return;
    }
    wasActive.current = true;
    let cancelled = false;
    // The last wallet this tab saw, shown while the live reads run (an
    // effect, not initial state, so the server and client render alike).
    const recalled = attempt === 0 ? recallWallet() : null;
    if (recalled) {
      setPrices(recalled.prices);
      setPricesState("ready");
      setBalance((prev) => (prev.kind === "ready" ? prev : recalled.balance));
    } else {
      setPricesState("probing");
    }
    void fetchTokenPricesRead().then((r) => {
      if (cancelled) return;
      // A failed probe over a recalled list keeps the list: the retry path
      // is for a wallet we have nothing to show for.
      if (r.kind === "failed" && recalled) return;
      setPrices(r.kind === "ready" ? r.prices : null);
      setPricesState(r.kind);
      if (r.kind === "off") forgetWallet();
    });
    return () => {
      cancelled = true;
    };
  }, [active, attempt]);

  const retryPrices = useCallback(() => {
    resetTokenPricesCache();
    setAttempt((n) => n + 1);
  }, []);

  const enabled = pricesState === "probing" ? null : pricesState === "ready";
  /* Balance: read beside the prices probe rather than after it, so the menu
   * has both one round trip sooner; stopped once the probe says the wallet
   * is off. A flag-off user pays one balance read per page. */
  const readBalance = active && enabled !== false;

  useEffect(() => {
    if (!readBalance) return;
    let cancelled = false;

    const read = async () => {
      const b = await fetchTokenBalanceShared();
      if (cancelled) return;
      setBalance((prev) => nextBalance(prev, b));
    };

    void read();

    // Coming back to the tab: one refresh for the pair of events it raises.
    let refreshTimer: number | null = null;
    const onReturn = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void read();
      }, REFRESH_DEBOUNCE_MS);
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    // A spend anywhere in the app re-reads immediately. Without this the chip
    // keeps showing the pre-purchase number until the next poll, which reads
    // as "it didn't go through" right after someone has paid. The shared read
    // is dropped first, or the spend would be answered from before it.
    const onSpent = () => {
      forgetSharedTokenBalance();
      void read();
    };
    window.addEventListener(WILLAB_TOKENS_SPENT_EVENT, onSpent);
    const intervalId = window.setInterval(() => void read(), POLL_MS);

    return () => {
      cancelled = true;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener(WILLAB_TOKENS_SPENT_EVENT, onSpent);
      window.clearInterval(intervalId);
    };
  }, [readBalance]);

  /* Keep the ready pair for this tab's next page open. */
  useEffect(() => {
    if (pricesState === "ready" && balance.kind === "ready") rememberWallet(prices, balance);
  }, [pricesState, prices, balance]);

  return { enabled, pricesState, retryPrices, balance, prices };
}
