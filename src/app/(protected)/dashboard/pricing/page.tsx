import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";
import CreditPricingCards from "@/components/credits/CreditPricingCards";

export const metadata: Metadata = {
  title: "Credits & pricing | Willab",
};

export default function PricingPage() {
  return (
    <DashboardShell>
      <div className="w-full max-w-3xl space-y-2 pb-8 text-center sm:space-y-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Top up credits</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Choose a pack. You&apos;ll complete payment securely on Stripe, then return to your dashboard.
        </p>
      </div>
      <div className="w-full max-w-4xl">
        <CreditPricingCards />
      </div>
    </DashboardShell>
  );
}
