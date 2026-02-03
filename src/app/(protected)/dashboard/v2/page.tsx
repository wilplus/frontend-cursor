import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/DashboardShell";
import SessionCardV2 from "@/components/dashboard/SessionCardV2";

export const metadata: Metadata = {
  title: "Dashboard v2 | Willab",
};

export default function DashboardV2Page() {
  return (
    <DashboardShell>
      <SessionCardV2 />
    </DashboardShell>
  );
}
