import type { Metadata } from "next";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import SessionCard from "@/components/dashboard/SessionCard";
import HistorySection from "@/components/dashboard/HistorySection";

export const metadata: Metadata = {
  title: "Dashboard | Willab",
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        <SessionCard />
        <HistorySection />
      </main>
    </div>
  );
}

