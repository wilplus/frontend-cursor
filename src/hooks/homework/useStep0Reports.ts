"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { useRouter, useSearchParams } from "next/navigation";
import { homeworkApi } from "@/lib/api/homework-client";
import type { HomeworkSessionStatus } from "@/lib/api/types-homework";
import type { Step } from "@/lib/api/types-homework";
import type { CompactReportPreview } from "@/lib/reports/compact-preview";
import { toCompactReportPreview } from "@/lib/reports/compact-preview";
import { clearPersistedFinalReportState } from "@/lib/storage/homeworkStorage";

const STEP0_REPORTS_PAGE_SIZE = 5;

export function useStep0Reports({
  step,
  activateForcedStep0WaitingRef,
  syncDashboardStateFromStatus,
  router,
  searchParams,
}: {
  step: Step;
  activateForcedStep0WaitingRef: React.MutableRefObject<() => void>;
  syncDashboardStateFromStatus: (s: HomeworkSessionStatus | null | undefined) => void;
  router: ReturnType<typeof useRouter>;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  const [step0Sessions, setStep0Sessions] = useState<
    Array<{
      id: string;
      created_at?: string;
      completed_at?: string;
      status?: string;
      report_grade?: number | null;
      recording_id?: string;
      report_id?: string;
      report_delivered?: boolean | null;
      student_completion_email_sent_at?: string | null;
      report_preview?: { report_text_preview?: string };
    }>
  >([]);
  const [step0SessionsLoading, setStep0SessionsLoading] = useState(false);
  const [showReportsList, setShowReportsList] = useState(false);
  const [visibleReportsCount, setVisibleReportsCount] = useState(STEP0_REPORTS_PAGE_SIZE);
  const [step0ReportPreviews, setStep0ReportPreviews] = useState<Record<string, CompactReportPreview | null>>({});
  const [step0ReportPreviewLoading, setStep0ReportPreviewLoading] = useState<Record<string, boolean>>({});
  const [pollReportsAfterFinish, setPollReportsAfterFinish] = useState(false);
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  const [reportModalSessionId, setReportModalSessionId] = useState<string | null>(null);
  const reportDeepLinkHandledRef = useRef(false);

  const fetchStep0Reports = useCallback(() => {
    if (step0SessionsLoading) return;
    setStep0SessionsLoading(true);
    homeworkApi
      .getSessions()
      .then((data) => {
        const deliveredSessions = [...(data.sessions ?? [])];
        deliveredSessions.sort(
          (a, b) =>
            (b.completed_at || b.created_at || "").localeCompare(a.completed_at || a.created_at || "")
        );
        setStep0Sessions(deliveredSessions);
      })
      .catch((e) => {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[HomeworkFlow] reports list fetch failed", e);
        }
      })
      .finally(() => setStep0SessionsLoading(false));
  }, [step0SessionsLoading]);

  // Poll reports after finish
  useEffect(() => {
    if (step !== 0 || !pollReportsAfterFinish) return;
    let attempts = 0;
    const maxAttempts = 10;
    const tick = () => {
      attempts += 1;
      fetchStep0Reports();
      homeworkApi
        .getStatus()
        .then((statusRes) => {
          syncDashboardStateFromStatus(statusRes);
        })
        .catch(() => {});
      if (attempts >= maxAttempts) setPollReportsAfterFinish(false);
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [step, pollReportsAfterFinish, fetchStep0Reports, syncDashboardStateFromStatus]);

  // Refresh previews + clear null entries while reports list is visible
  useEffect(() => {
    if (step !== 0 || !showReportsList) return;
    const id = setInterval(() => {
      setStep0ReportPreviews((prev) => {
        const next = { ...prev };
        let changed = false;
        step0Sessions.forEach((session) => {
          if (next[session.id] === null) {
            delete next[session.id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      fetchStep0Reports();
    }, 8000);
    return () => clearInterval(id);
  }, [step, showReportsList, fetchStep0Reports, step0Sessions]);

  // Fetch previews for visible sessions
  useEffect(() => {
    if (step !== 0 || !showReportsList || step0Sessions.length === 0) return;
    step0Sessions.slice(0, visibleReportsCount).forEach((session) => {
      if (step0ReportPreviews[session.id] !== undefined || step0ReportPreviewLoading[session.id]) return;
      setStep0ReportPreviewLoading((prev) => ({ ...prev, [session.id]: true }));
      homeworkApi
        .getReport(session.id)
        .then((report) => {
          setStep0ReportPreviews((prev) => ({ ...prev, [session.id]: toCompactReportPreview(report) }));
        })
        .catch(() => {
          setStep0ReportPreviews((prev) => ({ ...prev, [session.id]: null }));
        })
        .finally(() => {
          setStep0ReportPreviewLoading((prev) => ({ ...prev, [session.id]: false }));
        });
    });
  }, [step, showReportsList, step0Sessions, step0ReportPreviews, step0ReportPreviewLoading, visibleReportsCount]);

  // Clear poll flag once sessions loaded
  useEffect(() => {
    if (pollReportsAfterFinish && step0Sessions.length > 0) {
      setPollReportsAfterFinish(false);
    }
  }, [pollReportsAfterFinish, step0Sessions.length]);

  // Reset visible count when list opens
  useEffect(() => {
    if (!showReportsList) return;
    setVisibleReportsCount(STEP0_REPORTS_PAGE_SIZE);
  }, [showReportsList]);

  // Deep-link handling
  useEffect(() => {
    if (reportDeepLinkHandledRef.current) return;
    const shouldShowReports = searchParams.get("showReports");
    const targetSessionId = searchParams.get("openReportSessionId");
    const homeworkState = searchParams.get("homeworkState");
    if (shouldShowReports !== "1" && !targetSessionId && homeworkState !== "waiting") return;

    reportDeepLinkHandledRef.current = true;

    if (homeworkState === "waiting") {
      clearPersistedFinalReportState();
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      activateForcedStep0WaitingRef.current();

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("homeworkState");
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `/dashboard?${nextQuery}` : "/dashboard");
      return;
    }

    setShowReportsList(true);
    fetchStep0Reports();

    if (targetSessionId && targetSessionId.trim()) {
      setReportModalSessionId(targetSessionId.trim());
      setReportsModalOpen(true);
    }
  }, [activateForcedStep0WaitingRef, fetchStep0Reports, router, searchParams]);

  return {
    step0Sessions,
    step0SessionsLoading,
    showReportsList,
    setShowReportsList,
    visibleReportsCount,
    setVisibleReportsCount,
    step0ReportPreviews,
    step0ReportPreviewLoading,
    pollReportsAfterFinish,
    setPollReportsAfterFinish,
    reportsModalOpen,
    setReportsModalOpen,
    reportModalSessionId,
    setReportModalSessionId,
    reportDeepLinkHandledRef,
    fetchStep0Reports,
  };
}
