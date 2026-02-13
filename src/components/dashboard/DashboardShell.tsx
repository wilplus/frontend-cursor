"use client";

import DashboardHeader from "@/components/dashboard/DashboardHeader";

/** Wraps dashboard content (single flow: warm-up + recording_1 → … → recording_2 → report). */
export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-4xl flex flex-col min-w-0 px-4 py-8 space-y-8 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
