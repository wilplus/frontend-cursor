import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";
import HomeworkFlowCard from "@/components/homework/HomeworkFlowCard";

export const metadata: Metadata = {
  title: "Homework | Willab",
};

export default function HomeworkPage() {
  return (
    <DashboardShell>
      <HomeworkFlowCard />
    </DashboardShell>
  );
}
