"use client";

import CreditPricingCards from "@/components/credits/CreditPricingCards";
import TokenWalletPanel from "@/components/tokens/TokenWalletPanel";
import { TOKENS_COPY } from "@/components/tokens/copy";
import { useTokenWallet } from "@/hooks/useTokenWallet";
import type { CreditPackDisplay } from "@/lib/stripe/creditPacks";

/* -------------------------------------------------------------------------- */
/*  PricingView — one page, two currencies, never both                        */
/*                                                                            */
/*  This page was "Top up credits". With token pricing live it is the wallet:  */
/*  the hamburger's Tokens row links here, and it has to answer what you have, */
/*  when it renews, what things cost, and where it went.                       */
/*                                                                            */
/*  IT RENDERS NOTHING WHILE THE PROBE IS IN FLIGHT. A flash of credit packs   */
/*  that resolves into a token wallet is worse than a moment of blank, because */
/*  the two are different currencies and the first frame would be an offer to  */
/*  buy the wrong one. Off → the credit packs, exactly as before.              */
/*                                                                            */
/*  NO CHECKOUT ON THE TOKEN SIDE, and that is not an omission. The plans are  */
/*  real and published, and Stripe has the three recurring prices configured,  */
/*  but NOTHING IN THE BACKEND CREATES A SUBSCRIPTION SESSION — there is no    */
/*  checkout route for them, and the one that exists is `mode: "payment"` for  */
/*  one-time credit packs. Wiring a plan button to that would take a one-time  */
/*  payment for a monthly plan; wiring it to nothing would 404. So the plans   */
/*  are listed, with an honest note, until a subscription path exists.         */
/* -------------------------------------------------------------------------- */

export default function PricingView({ packs }: { packs: CreditPackDisplay[] }) {
  // Signed-in only page (it lives under (protected)), so the wallet read is
  // always live here.
  const wallet = useTokenWallet(true);

  // Still probing: say nothing rather than offer the wrong currency.
  if (wallet.enabled === null) return null;

  if (wallet.enabled) {
    return (
      <div className="w-full max-w-2xl">
        <div className="space-y-1 pb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {TOKENS_COPY.walletPageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{TOKENS_COPY.walletPageIntro}</p>
        </div>
        <TokenWalletPanel wallet={wallet} />
      </div>
    );
  }

  return (
    <>
      <div className="w-full max-w-3xl space-y-2 pb-8 text-center sm:space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Top up credits</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Choose a pack. You&apos;ll complete payment securely on Stripe, then return to
          your dashboard.
        </p>
        <p className="text-xs text-muted-foreground">
          Money-back guarantee on your first audit.
        </p>
      </div>
      <div className="w-full max-w-4xl">
        <CreditPricingCards packs={packs} />
      </div>
    </>
  );
}
