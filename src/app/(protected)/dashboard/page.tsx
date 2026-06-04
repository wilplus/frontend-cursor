import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import CreditsCheckoutReturnToast from "@/components/dashboard/CreditsCheckoutReturnToast";

export const metadata: Metadata = {
  title: "Dashboard | Willab",
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <Suspense fallback={null}>
        <CreditsCheckoutReturnToast />
      </Suspense>
    </DashboardShell>
  );
}
