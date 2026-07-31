import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";
import PricingView from "@/components/credits/PricingView";
import { getCheckoutCreditPackDisplay } from "@/lib/stripe/checkoutCreditPacks.server";

/** Neutral on purpose: this page is the credit top-up while token pricing is
 *  off and the token wallet once it is on, and a tab title cannot read a
 *  per-user runtime flag. "Plans" is true of both. */
export const metadata: Metadata = {
  title: "Plans & usage | WillpowerLab",
};

export default function PricingPage() {
  // Read server-side either way: the packs are the flag-off branch, and one env
  // read costs less than a round trip for the users who still need them.
  // PricingView decides which currency this page is about.
  const packs = getCheckoutCreditPackDisplay();
  return (
    <DashboardShell>
      <PricingView packs={packs} />
    </DashboardShell>
  );
}
