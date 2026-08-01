"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchPurchasableTiers, startPlanCheckout } from "@/services/api/subscribe";
import type { TokenTier } from "@/services/api/tokens";
import { TOKENS_COPY, formatTokens } from "./copy";

/* -------------------------------------------------------------------------- */
/*  TokenPlanCards — the three paid plans as real pricing cards                 */
/*                                                                            */
/*  Founder 2026-07-31: three prices, three CTAs, laid out like pricing rather */
/*  than a list of descriptions. Visual language is lifted from the retired      */
/*  CreditPricingCards on purpose — that layout was already signed off, so       */
/*  reusing it means no new design decision and no new copy to approve.          */
/*                                                                            */
/*  FREE IS NOT A CARD. You do not check out in order to pay nothing, and a      */
/*  fourth card with a dead button is the exact thing this file avoids          */
/*  elsewhere. It is stated as one line above the cards so the ladder still      */
/*  starts where the user actually is.                                          */
/*                                                                            */
/*  NO "MOST POPULAR" BADGE. The old credit cards had one; this deliberately     */
/*  does not, because it is a claim about other users' behaviour and there is    */
/*  no data behind it. The middle card still carries the visual emphasis, which  */
/*  is a design choice rather than an assertion. If the founder wants a label,   */
/*  it should be chosen, not inherited from a template.                         */
/*                                                                            */
/*  Every tier comes from the BE's served list — names, prices, allowances. The  */
/*  only thing resolved locally is whether a plan can be BOUGHT, which is a      */
/*  server capability, not a price.                                             */
/* -------------------------------------------------------------------------- */

const LADDER: readonly string[] = ["starter", "pro", "max"];

export default function TokenPlanCards({
  tiers,
  currentTier,
}: {
  /** The served tier list, name → allowance/price. */
  tiers: Record<string, TokenTier>;
  /** From the balance read. null/unknown is treated as NOT free, so nobody who
   *  might already be subscribed is offered a second subscription. */
  currentTier: string | null;
}) {
  const [purchasable, setPurchasable] = useState<string[]>([]);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPurchasableTiers().then((t) => {
      if (!cancelled) setPurchasable(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onFree = currentTier === "free" || currentTier === null;

  const buy = async (tier: string) => {
    if (busyTier) return;
    setBusyTier(tier);
    setError(null);
    const r = await startPlanCheckout(tier);
    if (r.ok) {
      // Stripe's own hosted page collects payment; we never see card details.
      window.location.assign(r.url);
      return;
    }
    setBusyTier(null);
    setError(r.message);
  };

  // Only plans the BE actually published, in ladder order.
  const cards = LADDER.filter((name) => tiers[name] !== undefined);
  if (cards.length === 0) return null;

  const free = tiers.free;

  return (
    <div className="w-full space-y-4">
      {free ? (
        <p className="text-[13px] text-muted-foreground">
          {TOKENS_COPY.planFreeLine(formatTokens(free.tokensPerMonth))}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3 sm:items-stretch sm:gap-3">
        {cards.map((name, i) => {
          const tier = tiers[name];
          const isCurrent = currentTier === name;
          const emphasised = i === 1 && cards.length === 3;
          // Buyable only when the server can sell it AND the user is on free.
          // Offering checkout to a subscriber would create a SECOND
          // subscription and charge them twice; switching needs the billing
          // portal the BE has no route for yet.
          const canBuy = purchasable.includes(name) && onFree && !isCurrent;

          return (
            <div
              key={name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition-shadow",
                emphasised &&
                  "border-primary shadow-md ring-2 ring-primary/25 sm:z-[1] sm:scale-[1.03]"
              )}
            >
              <h3 className="text-lg font-bold capitalize text-foreground">{name}</h3>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                ${tier.usdPerMonth}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}
                  {TOKENS_COPY.planCardPerMonth}
                </span>
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {TOKENS_COPY.planCardTokens(formatTokens(tier.tokensPerMonth))}
              </p>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">
                {TOKENS_COPY.planCardReviews(tier.coachReviewsPerMonth)}
              </p>

              {isCurrent ? (
                <p className="mt-5 text-center text-sm font-medium text-muted-foreground">
                  {TOKENS_COPY.planCardCurrent}
                </p>
              ) : canBuy ? (
                <Button
                  type="button"
                  className="mt-5 w-full"
                  variant={emphasised ? "default" : "outline"}
                  disabled={busyTier !== null}
                  onClick={() => void buy(name)}
                >
                  {busyTier === name ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      {TOKENS_COPY.walletChoosePlanBusy}
                    </>
                  ) : (
                    TOKENS_COPY.planCardCta(name)
                  )}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* One explanation, and only when it is true: nothing configured for sale,
          or already on a paid plan (where a change needs the billing portal the
          BE has no route for, so a human beats a double-charging button). */}
      {purchasable.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          {TOKENS_COPY.walletUpgradeUnavailable}
        </p>
      ) : !onFree ? (
        <p className="text-[12px] text-muted-foreground">
          {TOKENS_COPY.walletManageUnavailable}
        </p>
      ) : null}

      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}
