"use client";

import { useEffect, useState } from "react";
import TokenWalletPanel from "@/components/tokens/TokenWalletPanel";
import { TOKENS_COPY } from "@/components/tokens/copy";
import { Button } from "@/components/ui/button";
import { SectionLoadingState } from "@/components/willab/LoadingState";
import { useTokenWallet } from "@/hooks/useTokenWallet";

/* -------------------------------------------------------------------------- */
/*  TokenWalletScreen — the wallet page (/dashboard/pricing)                   */
/*                                                                            */
/*  This route was "Top up credits". Credits are gone (founder 2026-07-31:     */
/*  tokens everywhere, credits nowhere), so it is now simply the wallet: what   */
/*  you have, when it renews, what things cost, where it went, and the plans.   */
/*                                                                            */
/*  The PATH is unchanged on purpose. It is what the hamburger row links to and */
/*  what the moments flow navigates to, and renaming a live route to tidy a URL */
/*  is churn with a redirect attached.                                         */
/*                                                                            */
/*  NOTHING renders until the wallet probe resolves. There is no second         */
/*  currency to fall back to any more, but a flash of an empty wallet that then */
/*  fills in still reads as "you have nothing", which is the one thing a        */
/*  balance must never say by accident.                                        */
/*                                                                            */
/*  Plans CAN now be bought here. The backend already owned the fulfilment half */
/*  (its subscription webhook maps price → tier), so the only missing piece was  */
/*  creating the Stripe session, which /api/stripe/subscribe now does. Changing  */
/*  or cancelling an existing plan still needs the billing portal the BE has no  */
/*  route for — see docs/HANDOFF-BE-2026-07-31-token-subscriptions.md.           */
/* -------------------------------------------------------------------------- */

export default function TokenWalletScreen() {
  // Signed-in only (the route lives under (protected)), so the read is live.
  const wallet = useTokenWallet(true);

  /** Back from Stripe. Read off `window` rather than useSearchParams so this
   *  needs no Suspense boundary for one query param. */
  const [planReturn, setPlanReturn] = useState<"success" | "cancelled" | "managed" | null>(
    null
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = new URLSearchParams(window.location.search).get("plan");
    if (v === "success" || v === "cancelled" || v === "managed") setPlanReturn(v);
  }, []);

  // OFF is the one state that still renders nothing at all, deliberately.
  // Probing and failed used to render nothing too, which is the whole defect:
  // "the pricing page doesn't open" was a blank area with no way to tell a
  // slow read from a dead one.
  if (wallet.pricesState === "off") return null;

  return (
    <div className="w-full max-w-2xl">
      <div className="space-y-1 pb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {TOKENS_COPY.walletPageTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{TOKENS_COPY.walletPageIntro}</p>
      </div>

      {/* The tier is granted by Stripe's webhook, which lands a moment after
          the redirect. So this promises an update rather than asserting a new
          balance the page cannot see yet — the wallet below still shows the old
          plan for a few seconds, and claiming otherwise would be a lie the next
          render exposes. */}
      {planReturn ? (
        <p className="mb-5 rounded-xl border border-border px-4 py-3 text-[13px] text-muted-foreground">
          {planReturn === "success"
            ? TOKENS_COPY.walletPlanSuccess
            : planReturn === "managed"
              ? TOKENS_COPY.walletPlanManaged
              : TOKENS_COPY.walletPlanCancelled}
        </p>
      ) : null}

      {wallet.pricesState === "probing" ? (
        <div className="py-10">
          <SectionLoadingState label="Loading token prices" />
        </div>
      ) : wallet.pricesState === "failed" ? (
        /* A read that failed says so and offers ONE user-initiated retry. The
           retry clears the memoised read first (useTokenWallet.retryPrices);
           without that, every retry re-serves the same cached failure and the
           only real fix is a hard reload. */
        <div className="space-y-3 rounded-xl border border-border px-4 py-5">
          <p className="text-sm text-muted-foreground">{TOKENS_COPY.walletLoadFailed}</p>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={wallet.retryPrices}
          >
            {TOKENS_COPY.walletRetry}
          </Button>
        </div>
      ) : (
        <TokenWalletPanel wallet={wallet} />
      )}
    </div>
  );
}
