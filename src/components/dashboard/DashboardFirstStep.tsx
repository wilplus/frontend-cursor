"use client";

import { useSessionStore } from "@/store/session-store";
import KPILineChart from "@/components/dashboard/KPILineChart";
import HistorySection from "@/components/dashboard/HistorySection";

/**
 * Chart and history appear only when the graph is visible: the dashboard's
 * first step (idle). Hidden during the whole session flow.
 */
export default function DashboardFirstStep() {
  const state = useSessionStore((s) => s.state);
  const loading = useSessionStore((s) => s.loading);

  // Only show when we're on the first step: idle and not initializing (so we know there's no active session)
  const isFirstStep = state === "idle" && !loading;

  if (!isFirstStep) {
    return null;
  }

  return (
    <>
      <KPILineChart />
      <HistorySection />
    </>
  );
}
