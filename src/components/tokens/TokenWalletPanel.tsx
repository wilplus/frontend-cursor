"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTokenHistory, type TokenLedgerEntry } from "@/services/api/tokens";
import type { TokenWallet } from "@/hooks/useTokenWallet";
import TokenPlanCards from "./TokenPlanCards";
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
/*  ONE VIEW, PLANS IN THE CENTRE (founder 2026-08-01). The balance is a single */
/*  centred line, the three plans are the body of the screen, and everything    */
/*  that explains the MECHANICS — what each action costs, the coach-review      */
/*  counter, the ledger — sits behind one "Show more". Those are reference      */
/*  material you go looking for once; the plans are why the page exists, and    */
/*  they were previously below a fold of price tables.                          */
/*                                                                            */
/*  TWO THINGS THIS SHEET DELIBERATELY DOES NOT HAVE:                          */
/*                                                                            */
/*  1. A "Request coach review" button. The BE has the price and the per-tier  */
/*     cap, but NO endpoint charges it — today every take auto-sends to the    */
/*     coach, and putting that existing behaviour behind a paywall is a        */
/*     product decision awaiting founder sign-off, not an implementation       */
/*     detail. The allowance is shown because it is part of the package; a      */
/*     button would 404.                                                       */
/*                                                                            */
/*  2. A way to CHANGE or CANCEL an existing plan. Buying a first plan works    */
/*     (TokenPlanCards), but switching or stopping needs Stripe's billing        */
/*     portal, which the backend has no route for — see                         */
/*     docs/HANDOFF-BE-2026-07-31-token-subscriptions.md.                       */
/*                                                                            */
/*  No streaks, no "you've used X%", no comparison, no praise                  */
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

  // Collapsed by default: the plans are the screen, the mechanics are reference.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const ready = wallet.balance.kind === "ready" ? wallet.balance : null;
  const prices = wallet.prices;


  return (
    <div className="w-full">
      <div className="flex flex-col items-center">
        {/* ---------------------------- balance ---------------------------- */}
        {/* One centred balance line. Stripe charges these packages once, so a
            period end from the legacy payload must not read as a renewal. */}
        <section className="text-center">
          {ready ? (
            <>
              <div className="text-5xl font-bold tabular-nums tracking-tight text-foreground">
                {formatTokens(ready.balance)}
              </div>
              <div className="mt-1 text-[13px] text-muted-foreground">
                {ready.tier ? TOKENS_COPY.walletTier(ready.tier) : ""}
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



        {/* ----------------------------- plans ----------------------------- */}
        {prices && Object.keys(prices.tiers).length > 0 ? (
          <section className="mt-8 w-full">
            <div>
              {/* Three prices, three CTAs (founder 2026-07-31). The cards own
                  the buying flow; this panel just says where they go. */}
              <TokenPlanCards
                tiers={prices.tiers}
                currentTier={ready?.tier ?? null}
                plan={ready?.plan ?? null}
              />
            </div>
          </section>
        ) : null}


        {/* --------------------------- show more --------------------------- */}
        {/* One toggle for all the mechanics. Collapsed by default so the screen
            is the plans; expanded it is the reference material. */}
        <div className="mt-8 w-full border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            aria-expanded={detailsOpen}
            className="mx-auto block text-[13px] text-muted-foreground underline underline-offset-2 transition hover:text-foreground"
          >
            {detailsOpen ? TOKENS_COPY.walletShowLess : TOKENS_COPY.walletShowMore}
          </button>

          {detailsOpen ? (
            <div className="mt-2 text-left">

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
                  and no reviews left. Said plainly, or it reads as a bug.

                  GATED ON allowed > 0. On free the allowance IS zero, so a bare
                  `remaining <= 0` told those users they had "used your coach
                  reviews" directly under "0 of 0 used" — claiming
                  they spent something they never had. Exhausted means they had
                  some and spent them; having none is a property of the plan. */}
              {ready.coachReviews.allowed > 0 && ready.coachReviews.remaining <= 0 ? (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {TOKENS_COPY.coachReviewsExhausted(null)}
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
