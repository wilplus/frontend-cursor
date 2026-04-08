"use client";

import { useEffect, useMemo, useState } from "react";
import CopilotInboxWorkspace from "@/components/admin/copilot/CopilotInboxWorkspace";
import AcousticDojoWorkspace from "@/components/admin/dojo/AcousticDojoWorkspace";
import LatestSessionMetrics from "@/components/admin/LatestSessionMetrics";
import MeasuredParametersGrid from "@/components/admin/MeasuredParametersGrid";
import TasksPoolWorkspace from "@/components/admin/training/TasksPoolWorkspace";
import { adminApi, type StudentProfile } from "@/lib/api/admin-client";

type StudioTab = "copilot" | "dojo" | "tasks";

export default function TrainingStudioWorkspace() {
  const [activeTab, setActiveTab] = useState<StudioTab>("copilot");
  const [showMetrics, setShowMetrics] = useState(false);
  const [metricsStudentId, setMetricsStudentId] = useState<string | null>(null);
  const [metricsProfile, setMetricsProfile] = useState<StudentProfile | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const tabDescription = useMemo(() => {
    if (activeTab === "copilot") {
      return "Draft-first review flow with queue, edits, chips, approve/send.";
    }
    if (activeTab === "tasks") {
      return "Swap assigned tasks from the global task pool.";
    }
    return "Audio-only labeling queue for stress/charisma confidence scoring.";
  }, [activeTab]);

  useEffect(() => {
    if (!metricsStudentId) {
      setMetricsProfile(null);
      setMetricsError(null);
      setMetricsLoading(false);
      return;
    }
    let cancelled = false;
    setMetricsLoading(true);
    setMetricsError(null);
    adminApi
      .getStudentProfile(metricsStudentId)
      .then((profile) => {
        if (cancelled) return;
        setMetricsProfile(profile);
      })
      .catch((error) => {
        if (cancelled) return;
        setMetricsProfile(null);
        setMetricsError(error instanceof Error ? error.message : "Failed to load metrics");
      })
      .finally(() => {
        if (cancelled) return;
        setMetricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [metricsStudentId]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-1.5">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.01em]">Training Studio</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{tabDescription}</p>
      </div>

      <div className="inline-flex min-h-12 flex-wrap gap-1 rounded-2xl border border-border/70 bg-card/80 p-1.5 shadow-sm">
        {(
          [
            { id: "copilot", label: "Copilot Inbox" },
            { id: "dojo", label: "Acoustic Dojo" },
            { id: "tasks", label: "Tasks Pool" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-[0_1px_8px_hsl(var(--primary)/0.35)]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowMetrics((previous) => !previous)}
          className={`h-9 rounded-xl px-4 text-sm font-medium transition-all duration-200 ${
            showMetrics
              ? "bg-primary/90 text-primary-foreground shadow-[0_1px_8px_hsl(var(--primary)/0.35)]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {showMetrics ? "Hide metrics" : "Show metrics"}
        </button>
      </div>

      {showMetrics ? (
        <div className="rounded-xl border border-border/80 bg-card/85 p-4 shadow-sm animate-fade-in-short">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide">Student Metrics</h2>
            <span className="text-xs text-muted-foreground">
              {metricsStudentId ? `Student: ${metricsStudentId.slice(0, 8)}...` : "Pick a student in Copilot or Tasks"}
            </span>
          </div>
          {!metricsStudentId ? (
            <p className="text-sm text-muted-foreground">
              No student selected yet. Select a student in the Copilot queue or Tasks Pool tab.
            </p>
          ) : metricsLoading ? (
            <p className="text-sm text-muted-foreground">Loading metrics...</p>
          ) : metricsError ? (
            <p className="text-sm text-destructive">{metricsError}</p>
          ) : metricsProfile ? (
            <div className="space-y-4">
              <LatestSessionMetrics sessions={metricsProfile.sessions ?? []} />
              <MeasuredParametersGrid measured_metrics={metricsProfile.measured_metrics ?? null} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No metrics profile data available.</p>
          )}
        </div>
      ) : null}

      <div key={activeTab} className="animate-fade-in-short">
        {activeTab === "copilot" ? (
          <CopilotInboxWorkspace
            showHeader={false}
            onSelectedStudentChange={(studentId) => {
              setMetricsStudentId(studentId);
            }}
          />
        ) : activeTab === "tasks" ? (
          <TasksPoolWorkspace
            onSelectedStudentChange={(studentId) => {
              setMetricsStudentId(studentId);
            }}
          />
        ) : (
          <AcousticDojoWorkspace showHeader={false} />
        )}
      </div>
    </div>
  );
}
