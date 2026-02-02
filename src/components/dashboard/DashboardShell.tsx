"use client";

import { useSessionStore } from "@/store/session-store";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

/**
 * Wraps dashboard content and hides the navbar when the user is in the learning flow
 * (after clicking "Record New Session" / "Record session").
 */
export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = useSessionStore((s) => s.state);
  const inLearningFlow = state !== "idle";

  return (
    <div className="min-h-screen bg-background">
      {!inLearningFlow && <DashboardHeader />}
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {children}
      </main>
    </div>
  );
}
