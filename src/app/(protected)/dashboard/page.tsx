import type { Metadata } from "next";
import Link from "next/link";
import DashboardShell from "@/components/dashboard/DashboardShell";
import SessionCard from "@/components/dashboard/SessionCard";
import DashboardFirstStep from "@/components/dashboard/DashboardFirstStep";

export const metadata: Metadata = {
  title: "Dashboard | Willab",
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="mb-4">
        <Link href="/dashboard/v2" className="text-sm text-primary hover:underline">
          Try v2
        </Link>
      </div>
      <SessionCard />
      <DashboardFirstStep />
    </DashboardShell>
  );
}

