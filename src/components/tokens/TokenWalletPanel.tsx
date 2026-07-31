"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTokenHistory, type TokenLedgerEntry } from "@/services/api/tokens";
import { fetchPurchasableTiers, startPlanCheckout } from "@/services/api/subscribe";
import type { TokenWallet } from "@/hooks/useTokenWallet";
import { TOKENS_COPY, actionLabel, formatShortDate, formatTokens } from "./copy";

/* -------------------------------------------------------------------------- */
/*  TokenWalletPanel — balance, plan, coach reviews, prices, ledger            */
/*                                                                            */
/*  The whole wallet in one place, so nothing about what things cost has to be */
/*  discovered by spending. Every price here comes from the BE's published     */
/*  list; not one is written in the FE.                                        */
/*                                                                            */
/*  A PANEL, not an overlay. Founder 2026-07-31 moved the balance out of the   */
/*  navbar and into the hamburger, which left this content with no chip to     */
/*  open it — so it lives on the page the menu row links to (the old credits   */
/*  top-up page) instead of in a sheet over whatever you were doing.           */
/*                                                                            */
/*  TWO THINGS THIS SHEET DELIBERATELY DOES NOT HAVE:                          */
/*                                                                            */
/*  1. A "Request coach review" button. The BE has the price and the per-tier  */
/*     cap, but NO endpoint charges it — today every take auto-sends to the    */
/*     coach, and putting that existing behaviour behind a paywall is a        */
/*     product decision awaiting founder sign-off, not an implementation       */
/*     detail. The allowance is shown because it is real and it resets; a      */
/*     button would 404.                                                       */
/*                                                                            */
/*  2. A way to CHANGE or CANCEL an existing plan. Buying a first plan works    */
/*     (the Choose buttons below), but switching or stopping needs Stripe's      */
/*     billing portal, which the backend has no route for — see                 */
/*     docs/HANDOFF-BE-2026-07-31-token-subscriptions.md. So checkout is offered */
/*     only to a user on free: offering it to a subscriber would create a        */
/*     SECOND subscription and charge them twice.                               */
/*                                                                            */
/*  No streaks, no "you've used X% of your month", no comparison, no praise    */
/*  for spending little (AC-9). The ledger is a receipt, not a report card.    */
/* -------------------------------------------------------------------------- */

const HISTORY_PAGE = 50;

export default function TokenWalletPanel({ wallet }: { wallet: TokenWallet }) {
  const [entries, setEntries] = useState<TokenLedgerEntry[]>([]);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [historyState, setHistoryState] = useState<"loading" | "ready" | "unavailable">(
    "loading"
  );

  const loadPage = useCallback(async (beforeId: number | null) => {
    const h = await fetchTokenHistory({ limit: HISTORY_PAGE, beforeId });
    if (h.kind !== "ready") {
      // An unreadable ledger is not an empty one: leave whatever loaded and
      // stop offering more, rather than claiming nothing was ever spent.
      setHistoryState((prev) => (prev === "ready" ? "ready" : "unavailable"));
      setNextBeforeId(null);
      return;
    }
    setEntries((prev) => (beforeId == null ? h.entries : [...prev, ...h.entries]));
    setNextBeforeId(h.nextBeforeId);
    setHistoryState("ready");
  }, []);

  useEffect(() => {
    void loadPage(null);
  }, [loadPage]);

  const ready = wallet.balance.kind === "ready" ? wallet.balance : null;
  const renewsOn = formatShortDate(ready?.periodEndsAt ?? null);
  const prices = wallet.prices;

  /* ------------------------------ plan buying ----------------------------- */
  const [purchasable, setPurchasable] = useState<string[]>([]);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPurchasableTiers().then((t) => {
      if (!cancelled) setPurchasable(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only a free user is offered checkout — see the note on the button. An
  // UNKNOWN tier counts as not-free: better to withhold a buy button than to
  // risk a second subscription on someone who already pays.
  const onFree = ready?.tier === "free" || ready?.tier === null;

  const buy = async (tier: string) => {
    if (busyTier) return;
    setBusyTier(tier);
    setCheckoutError(null);
    const r = await startPlanCheckout(tier);
    if (r.ok) {
      // Hard navigation to Stripe's hosted page; nothing is charged until the
      // user completes it there, and we never see card details.
      window.location.assign(r.url);
      return;
    }
    setBusyTier(null);
    setCheckoutError(r.message);
  };

  return (
    <div className="w-full">
      <div>
        {/* ---------------------------- balance ---------------------------- */}
        <section>
          {ready ? (
            <>
              <div className="text-3xl font-semibold tabular-nums">
                {formatTokens(ready.balance)}
              </div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                {ready.tier ? `${TOKENS_COPY.walletTier(ready.tier)} · ` : ""}
                {renewsOn
                  ? TOKENS_COPY.walletRenews(renewsOn)
                  : TOKENS_COPY.walletRenewsUnknown}
              </div>
            </>
          ) : (
            // Never a zero here: an unreadable account and an empty one look
            // identical to a user, and only one of them is their problem.
            <div className="text-[13px] text-muted-foreground">
              {TOKENS_COPY.walletBalanceUnknown}
            </div>
          )}
        </section>

        {/* ------------------------- coach reviews ------------------------- */}
        {ready?.coachReviews ? (
          <section className="mt-7">
            <h3 className="text-[13px] font-semibold">{TOKENS_COPY.coachReviewsTitle}</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {TOKENS_COPY.coachReviewsUsed(
                ready.coachReviews.used,
                ready.coachReviews.allowed
              )}
            </p>
            {/* The one place two limits legitimately disagree: a full balance
                and no reviews left. Said plainly, or it reads as a bug. */}
            {ready.coachReviews.remaining <= 0 ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                {TOKENS_COPY.coachReviewsExhausted(renewsOn)}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* ----------------------------- prices ---------------------------- */}
        {prices && Object.keys(prices.actions).length > 0 ? (
          <section className="mt-7">
            <h3 className="text-[13px] font-semibold">{TOKENS_COPY.walletPricesTitle}</h3>
            <ul className="mt-2 space-y-1.5">
              {Object.entries(prices.actions).map(([action, price]) => (
                <li
                  key={action}
                  className="flex items-baseline justify-between gap-4 text-[13px]"
                >
                  <span>{actionLabel(action)}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatTokens(price)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ----------------------------- plans ----------------------------- */}
        {prices && Object.keys(prices.tiers).length > 0 ? (
          <section className="mt-7">
            <h3 className="text-[13px] font-semibold">{TOKENS_COPY.walletPlansTitle}</h3>
            <ul className="mt-2 space-y-2.5">
              {/* Ascending by price so the list reads as a ladder. Presented as
                  MONTHLY PLANS, never as packs or credits: the allowance
                  resets, and copy that implies a one-time purchase makes the
                  first reset feel like theft. */}
              {Object.entries(prices.tiers)
                .sort((a, b) => a[1].usdPerMonth - b[1].usdPerMonth)
                .map(([name, tier]) => {
                  const isCurrent = ready?.tier === name;
                  // Buyable only when the server can actually sell it AND the
                  // user is on free. Offering checkout to someone already
                  // subscribed would create a SECOND subscription and charge
                  // them twice; switching needs the billing portal, which the
                  // BE has no route for yet.
                  const canBuy =
                    purchasable.includes(name) && onFree && !isCurrent;
                  return (
                    <li key={name} className="text-[13px]">
                      <div className="flex items-baseline justify-between gap-4">
                        <span className="font-medium capitalize">{name}</span>
                        <span className="text-muted-foreground">
                          {TOKENS_COPY.walletPerMonth(tier.usdPerMonth)}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {TOKENS_COPY.walletTierTokens(formatTokens(tier.tokensPerMonth))}
                        {" · "}
                        {TOKENS_COPY.walletTierReviews(tier.coachReviewsPerMonth)}
                      </div>
                      {isCurrent ? (
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          {TOKENS_COPY.walletCurrentPlan}
                        </p>
                      ) : canBuy ? (
                        <button
                          type="button"
                          disabled={busyTier !== null}
                          onClick={() => void buy(name)}
                          className="mt-1.5 rounded-full border border-foreground bg-foreground px-4 py-1.5 text-[13px] font-medium text-background transition hover:bg-foreground/90 disabled:opacity-50"
                        >
                          {busyTier === name
                            ? TOKENS_COPY.walletChoosePlanBusy
                            : TOKENS_COPY.walletChoosePlan}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
            {/* One line, and only when it is actually true. Nothing for sale →
                say so. On a paid plan → changing it needs the billing portal
                the BE has no route for, so point at a human rather than a
                button that would double-charge. */}
            {purchasable.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted-foreground">
                {TOKENS_COPY.walletUpgradeUnavailable}
              </p>
            ) : !onFree ? (
              <p className="mt-3 text-[12px] text-muted-foreground">
                {TOKENS_COPY.walletManageUnavailable}
              </p>
            ) : null}
            {checkoutError ? (
              <p className="mt-2 text-[12px] text-destructive">{checkoutError}</p>
            ) : null}
          </section>
        ) : null}

        {/* ---------------------------- history ---------------------------- */}
        <section className="mt-7 pb-8">
          <h3 className="text-[13px] font-semibold">{TOKENS_COPY.walletHistoryTitle}</h3>
          {historyState === "ready" && entries.length === 0 ? (
            <p className="mt-1 text-[13px] text-muted-foreground">
              {TOKENS_COPY.walletHistoryEmpty}
            </p>
          ) : null}
          <ul className="mt-2 space-y-1.5">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-baseline justify-between gap-4 text-[13px]"
              >
                <span>
                  {actionLabel(e.action)}
                  {e.createdAt ? (
                    <span className="text-muted-foreground">
                      {" · "}
                      {formatShortDate(e.createdAt)}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {/* Signed as the BE reports it. A refill is a plus, a spend
                      is a minus; neither is editorialised. */}
                  {e.delta > 0 ? "+" : "-"}
                  {formatTokens(Math.abs(e.delta))}
                </span>
              </li>
            ))}
          </ul>
          {nextBeforeId != null ? (
            <button
              type="button"
              onClick={() => void loadPage(nextBeforeId)}
              className="mt-3 text-[13px] text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
            >
              {TOKENS_COPY.walletHistoryMore}
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
