import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import CreditsCheckoutReturnToast from "@/components/dashboard/CreditsCheckoutReturnToast";
import HomeworkFlowCard from "@/components/homework/HomeworkFlowCard";
import FunnelReturnToast from "@/components/funnel/FunnelReturnToast";

export const metadata: Metadata = {
  title: "Dashboard | Willab",
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <Suspense fallback={null}>
        <CreditsCheckoutReturnToast />
      </Suspense>
      <Suspense fallback={null}>
        <FunnelReturnToast />
      </Suspense>
      <HomeworkFlowCard />
    </DashboardShell>
  );
}

