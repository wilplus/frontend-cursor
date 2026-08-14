"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startBillingPortal, startPlanCheckout } from "@/services/api/subscribe";
import type { TokenPlan, TokenTier } from "@/services/api/tokens";
import { TOKENS_COPY, formatShortDate, formatTokens } from "./copy";
import { planControlsFor } from "./planControls";

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
/*  PALETTE (founder 2026-08-01): black and white, with orange as an ACCENT      */
/*  ONLY. Every card is monochrome — black type, neutral rules — and the single  */
/*  orange element on the screen is the recommended plan's filled CTA. That is   */
/*  what makes it read as the recommendation without a badge claiming anything.  */
/*  Orange comes from `--primary` (the documented primary-action token), never a */
/*  literal, so a theme change carries it.                                      */
/*                                                                            */
/*  Every tier comes from the BE's served list — names, prices, allowances. The  */
/*  only thing resolved locally is whether a plan can be BOUGHT, which is a      */
/*  server capability, not a price.                                             */
/* -------------------------------------------------------------------------- */

export default function TokenPlanCards({
  tiers,
  currentTier,
  plan,
}: {
  /** The served tier list, name → allowance/price. */
  tiers: Record<string, TokenTier>;
  /** From the balance read. null/unknown is treated as NOT free, so nobody who
   *  might already be subscribed is offered a second subscription. */
  currentTier: string | null;
  /** The subscription behind the balance, when the BE published one. Null
   *  degrades to the pre-portal behaviour exactly (see planControls.ts). */
  plan?: TokenPlan | null;
}) {
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  // Starts true and only ever goes false, when the server tells us it cannot
  // sell. No probe: the BE owns the price map, so this is discovered on use.
  const [sellable, setSellable] = useState(true);
  // A 404 from the portal means there is nothing to manage. Hide the button
  // rather than show an error: nothing went wrong.
  const [manageable, setManageable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const controls = planControlsFor(plan ?? null, currentTier);

  const openPortal = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    setError(null);
    setNotice(null);
    const r = await startBillingPortal();
    if (r.ok) {
      window.location.assign(r.url);
      return;
    }
    setPortalBusy(false);
    if (r.reason === "none") {
      setManageable(false);
      return;
    }
    setError(r.message);
  };

  const buy = async (tier: string) => {
    if (busyTier) return;
    setBusyTier(tier);
    setError(null);
    setNotice(null);
    const r = await startPlanCheckout(tier);
    if (r.ok) {
      // Stripe's own hosted page collects payment; we never see card details.
      window.location.assign(r.url);
      return;
    }
    setBusyTier(null);
    // Already on it: a calm statement, not an error. Nothing failed.
    // A different live subscription: route to the portal, never retry
    // checkout — a second session would leave them paying for two plans.
    if (r.reason === "already" || r.reason === "manage") {
      setNotice(r.message);
      return;
    }
    setError(r.message);
    // A server that cannot sell anything should stop offering: hide the CTAs
    // rather than leave three buttons that will each fail the same way.
    if (r.reason === "unavailable") setSellable(false);
  };

  // EVERY PAID TIER THE BE PUBLISHED, cheapest first. Never a hardcoded key
  // list: the sold ladder gets renamed and repriced, and a named ladder makes
  // that a silent zero-card page instead of a config change. Free is a line
  // above the cards, not a card — you do not check out to pay nothing.
  const cards = Object.keys(tiers)
    .filter((name) => tiers[name].usdPerMonth > 0)
    .sort((a, b) => tiers[a].usdPerMonth - tiers[b].usdPerMonth);
  if (cards.length === 0) return null;

  const free = tiers.free;
  const endsOnLabel = controls.endsOn ? formatShortDate(controls.endsOn) : null;

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
          // Buyable only when the server can sell it AND no live subscription
          // exists (planControls owns that question). Offering checkout to a
          // subscriber would create a SECOND subscription and charge them
          // twice; switching goes through the billing portal below.
          // Every published paid tier is offered. Only the BE holds the price
          // map, so the FE cannot pre-check sellability without keeping a second
          // copy of it — and a duplicated price → tier map is how someone pays
          // for Pro and is granted Starter. A refusal surfaces inline instead.
          const canBuy = sellable && controls.canBuy && !isCurrent;

          return (
            <div
              key={name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 transition-shadow",
                // Emphasis is WEIGHT, not colour: a black rule against the
                // neutral ones. Keeps the page monochrome so the one orange
                // element on it is unmistakably the action.
                emphasised
                  ? "border-foreground shadow-md sm:z-[1] sm:scale-[1.03]"
                  : "border-border"
              )}
            >
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                {name}
              </h3>
              <p className="mt-2 text-4xl font-bold tracking-tight text-foreground">
                ${tier.usdPerMonth}
              </p>
              <p className="text-[13px] text-muted-foreground">
                {TOKENS_COPY.planCardPerMonth}
              </p>
              <div className="mt-4 flex-1 space-y-1 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">
                  {TOKENS_COPY.planCardTokens(formatTokens(tier.tokensPerMonth))}
                </p>
                <p className="text-sm text-muted-foreground">
                  {TOKENS_COPY.planCardReviews(tier.coachReviewsPerMonth)}
                </p>
              </div>

              {isCurrent ? (
                <p className="mt-5 text-center text-sm font-medium text-foreground">
                  {TOKENS_COPY.planCardCurrent}
                </p>
              ) : canBuy ? (
                <Button
                  type="button"
                  className={cn(
                    "mt-5 w-full rounded-full",
                    emphasised
                      ? // THE one orange element on the page.
                        "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background"
                  )}
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

      {/* Only when the subscription is genuinely scheduled to end, and only
          when the date actually formats — an unparseable date renders no line
          rather than "Your plan ends null". */}
      {endsOnLabel ? (
        <p className="text-[13px] text-muted-foreground">
          {TOKENS_COPY.planEndsOn(endsOnLabel)}
        </p>
      ) : null}

      {/* MANAGE — switch, cancel, fix a declined card, invoices. Rendered
          whenever a Stripe CUSTOMER exists, which outlives the subscription,
          so someone who cancelled can still reach their receipts. */}
      {controls.canManage && manageable ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={portalBusy}
          onClick={() => void openPortal()}
        >
          {portalBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              {TOKENS_COPY.walletChoosePlanBusy}
            </>
          ) : (
            TOKENS_COPY.planManageCta
          )}
        </Button>
      ) : null}

      {/* One explanation, and only when it is true: nothing configured for
          sale, or a live plan with no portal to manage it through (an
          unmigrated DB — the email-support line is the terminal fallback,
          not the default it used to be). */}
      {!sellable ? (
        <p className="text-[12px] text-muted-foreground">
          {TOKENS_COPY.walletUpgradeUnavailable}
        </p>
      ) : !controls.canBuy && !(controls.canManage && manageable) ? (
        <p className="text-[12px] text-muted-foreground">
          {TOKENS_COPY.walletManageUnavailable}
        </p>
      ) : null}

      {notice ? <p className="text-[12px] text-muted-foreground">{notice}</p> : null}
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}
