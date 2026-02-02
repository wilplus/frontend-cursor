"use client";

import { useSessionStore } from "@/store/session-store";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

/**
 * Wraps dashboard content and hides the navbar during the learning flow
 * (pre questions → command & recording → post questions).
 * Navbar is shown when idle (dashboard home) and when the report is shown (completed).
 */
export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = useSessionStore((s) => s.state);
  const showNavbar = state === "idle" || state === "completed";

  return (
    <div className="min-h-screen bg-background">
      {showNavbar && <DashboardHeader />}
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-8">
        {children}
      </main>
    </div>
  );
}
