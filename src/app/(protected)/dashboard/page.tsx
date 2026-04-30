import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import CreditsCheckoutReturnToast from "@/components/dashboard/CreditsCheckoutReturnToast";
import HomeworkFlowCard from "@/components/homework/HomeworkFlowCard";

export const metadata: Metadata = {
  title: "Dashboard | Willab",
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <Suspense fallback={null}>
        <CreditsCheckoutReturnToast />
      </Suspense>
      <HomeworkFlowCard />
    </DashboardShell>
  );
}
