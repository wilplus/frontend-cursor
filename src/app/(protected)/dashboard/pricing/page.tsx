import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";
import CreditPricingCards from "@/components/credits/CreditPricingCards";
import { getCheckoutCreditPackDisplay } from "@/lib/stripe/checkoutCreditPacks.server";

export const metadata: Metadata = {
  title: "Credits & pricing | WillpowerLab",
};

export default function PricingPage() {
  const packs = getCheckoutCreditPackDisplay();
  return (
    <DashboardShell>
      <div className="w-full max-w-3xl space-y-2 pb-8 text-center sm:space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Top up credits</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Choose a pack. You&apos;ll complete payment securely on Stripe, then return to your dashboard.
        </p>
        <p className="text-xs text-muted-foreground">
          Money-back guarantee on your first audit.
        </p>
      </div>
      <div className="w-full max-w-4xl">
        <CreditPricingCards packs={packs} />
      </div>
    </DashboardShell>
  );
}
