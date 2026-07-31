"use client";

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
/*  NO CHECKOUT, and not an omission: the backend has no subscription route     */
/*  (see docs/HANDOFF-BE-2026-07-31-token-subscriptions.md). Plans are listed   */
/*  with an honest note until one exists.                                      */
/* -------------------------------------------------------------------------- */

export default function TokenWalletScreen() {
  // Signed-in only (the route lives under (protected)), so the read is live.
  const wallet = useTokenWallet(true);

  if (wallet.enabled === null) return null;

  return (
    <div className="w-full max-w-2xl">
      <div className="space-y-1 pb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {TOKENS_COPY.walletPageTitle}
        </h1>
        <p className="text-sm text-muted-foreground">{TOKENS_COPY.walletPageIntro}</p>
      </div>
      {/* enabled === false should not happen now that pricing is the only
          model, but if the BE ever reports it off the panel degrades to its
          own unavailable states rather than inventing numbers. */}
      <TokenWalletPanel wallet={wallet} />
    </div>
  );
}
