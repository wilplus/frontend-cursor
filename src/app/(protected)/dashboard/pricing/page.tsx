import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";
import TokenWalletScreen from "@/components/tokens/TokenWalletScreen";

export const metadata: Metadata = {
  title: "Tokens | WillpowerLab",
};

/** The wallet. Was the credit top-up page; credits are gone (founder
 *  2026-07-31). The path stays because the hamburger row and the moments flow
 *  both link here. */
export default function PricingPage() {
  return (
    <DashboardShell>
      <TokenWalletScreen />
    </DashboardShell>
  );
}
