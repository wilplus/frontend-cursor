import type { Metadata } from "next";
import Link from "next/link";
import DashboardShell from "@/components/dashboard/DashboardShell";
import SessionCardV2 from "@/components/dashboard/SessionCardV2";

export const metadata: Metadata = {
  title: "Dashboard v2 | Willab",
};

export default function DashboardV2Page() {
  return (
    <DashboardShell>
      <div className="mb-4">
        <Link href="/dashboard/homework" className="text-sm text-primary hover:underline">
          Homework flow (warm-up + two recordings)
        </Link>
      </div>
      <SessionCardV2 />
    </DashboardShell>
  );
}
