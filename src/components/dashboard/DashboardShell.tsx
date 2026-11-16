"use client";

import React, { useEffect } from "react";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { WILLAB_CONTENT_RAIL } from "@/lib/willab/layout";

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
      <main className={`${WILLAB_CONTENT_RAIL} flex min-w-0 flex-col px-[15px] pb-4 pt-6 sm:pb-6 sm:pt-8`}>
        <div className="flex w-full flex-col items-center">
          {children}
        </div>
      </main>
    </div>
  );
}
