"use client";

import { useEffect, useState } from "react";
import TokenWalletPanel from "@/components/tokens/TokenWalletPanel";
import { TOKENS_COPY } from "@/components/tokens/copy";
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
  const [planReturn, setPlanReturn] = useState<"success" | "cancelled" | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = new URLSearchParams(window.location.search).get("plan");
    if (v === "success" || v === "cancelled") setPlanReturn(v);
  }, []);

  if (wallet.enabled === null) return null;

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
            : TOKENS_COPY.walletPlanCancelled}
        </p>
      ) : null}
      {/* enabled === false should not happen now that pricing is the only
          model, but if the BE ever reports it off the panel degrades to its
          own unavailable states rather than inventing numbers. */}
      <TokenWalletPanel wallet={wallet} />
    </div>
  );
}
