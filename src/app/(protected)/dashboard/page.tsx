import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";
import HomeworkFlowCard from "@/components/homework/HomeworkFlowCard";

export const metadata: Metadata = {
  title: "Dashboard | willab - willpower lab 🎙️",
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <HomeworkFlowCard />
    </DashboardShell>
  );
}

