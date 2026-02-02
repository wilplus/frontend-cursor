import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";
import SessionCard from "@/components/dashboard/SessionCard";
import DashboardFirstStep from "@/components/dashboard/DashboardFirstStep";

export const metadata: Metadata = {
  title: "Dashboard | Willab",
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <SessionCard />
      <DashboardFirstStep />
    </DashboardShell>
  );
}

