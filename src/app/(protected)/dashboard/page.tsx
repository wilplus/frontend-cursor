import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import DashboardSpeakerSexPrompt from "@/components/dashboard/DashboardSpeakerSexPrompt";

export const metadata: Metadata = {
  title: "Dashboard | WillpowerLab",
};

export default function DashboardPage() {
  return (
    <DashboardShell>
      <Suspense fallback={null}>
      </Suspense>
      <DashboardSpeakerSexPrompt />
    </DashboardShell>
  );
}
