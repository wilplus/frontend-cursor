"use client";

import React, { useEffect } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

/** Wraps dashboard content under the dashboard header. */
export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-background">
      <DashboardHeader />
      <main className="w-full max-w-4xl mx-auto flex flex-col min-w-0 px-[15px] pt-6 pb-4 sm:pt-8 sm:pb-6">
        <div className="w-full max-w-2xl sm:max-w-3xl mx-auto flex flex-col items-center">
          {children}
        </div>
      </main>
    </div>
  );
}
