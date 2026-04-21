"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { adminApi, type CopilotAnnotationChip, type CopilotCohortStack, type CopilotStudentQueueItem } from "@/lib/api/admin-client";
import QueueSidebar from "./QueueSidebar";
import StudentReviewCard from "./StudentReviewCard";

export default function CopilotInboxWorkspace({
  showHeader = true,
  onSelectedStudentChange,
}: {
  showHeader?: boolean;
  onSelectedStudentChange?: (studentId: string | null) => void;
}) {
  const [cohorts, setCohorts] = useState<CopilotCohortStack[]>([]);
  const [students, setStudents] = useState<CopilotStudentQueueItem[]>([]);
  const [chips, setChips] = useState<CopilotAnnotationChip[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<CopilotStudentQueueItem | null>(null);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const loadCohorts = useCallback(async () => {
    setLoadingCohorts(true);
    try {
      const [cohortRes, chipRes] = await Promise.all([
        adminApi.getCopilotCohorts({ limit: 50, offset: 0 }),
        adminApi.getCopilotAnnotationChips(),
      ]);
      const list = cohortRes.cohorts ?? [];
      setCohorts(list);
      setChips(chipRes.chips ?? []);
      const first = list[0];
      setSelectedCohortId((prev) => prev ?? first?.id ?? null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load cohorts");
    } finally {
      setLoadingCohorts(false);
    }
  }, []);

  const loadStudents = useCallback(async (cohortId: string) => {
    setLoadingStudents(true);
    try {
      const response = await adminApi.getCopilotCohortStudents(cohortId, { limit: 100, offset: 0 });
      const list = response.students ?? [];
      setStudents(list);
      setSelectedStudent((prev) => {
        if (prev) {
          const found = list.find((item) => item.student_id === prev.student_id);
          if (found) return found;
        }
        return list[0] ?? null;
      });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load cohort students");
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    void loadCohorts();
  }, [loadCohorts]);

  useEffect(() => {
    if (!selectedCohortId) {
      setStudents([]);
      setSelectedStudent(null);
      return;
    }
    void loadStudents(selectedCohortId);
  }, [loadStudents, selectedCohortId]);

  useEffect(() => {
    onSelectedStudentChange?.(selectedStudent?.student_id ?? null);
  }, [onSelectedStudentChange, selectedStudent?.student_id]);

  const selectedCohort = useMemo(
    () => cohorts.find((cohort) => cohort.id === selectedCohortId) ?? null,
    [cohorts, selectedCohortId]
  );

  return (
    <div className="space-y-5 animate-fade-in-short">
      {showHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Copilot Inbox</h1>
            <p className="text-sm text-muted-foreground">
              Draft-first review flow with required reason chips for manual corrections.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="border-border/80 bg-card/80 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cohorts</span>
          {loadingCohorts ? (
            <span className="text-xs text-muted-foreground">Loading cohorts...</span>
          ) : cohorts.length === 0 ? (
            <span className="text-xs text-muted-foreground">No cohort stacks available.</span>
          ) : (
            cohorts.map((cohort) => {
              const active = selectedCohortId === cohort.id;
              return (
                <button
                  key={cohort.id}
                  type="button"
                  onClick={() => setSelectedCohortId(cohort.id)}
                  className={`h-8 rounded-full border px-3 text-xs font-medium transition-all duration-200 ${
                    active
                      ? "border-primary/40 bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:-translate-y-0.5 hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {cohort.profile_bucket} / {cohort.stage_key} ({cohort.pending_count})
                </button>
              );
            })
          )}
        </div>
        {selectedCohort && (
          <p className="text-xs leading-5 text-muted-foreground">
            Selected: {selectedCohort.profile_bucket} / {selectedCohort.stage_key}
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <QueueSidebar
          students={students}
          selectedStudentId={selectedStudent?.student_id ?? null}
          onSelectStudent={setSelectedStudent}
          loading={loadingStudents}
        />

        {selectedStudent ? (
          <StudentReviewCard
            studentId={selectedStudent.student_id}
            sessionId={selectedStudent.session_id ?? undefined}
            chips={chips}
            onStateMutated={async (reason) => {
              if (reason === "workflow" && selectedCohortId) {
                await loadStudents(selectedCohortId);
              }
            }}
          />
        ) : (
          <Card className="border-dashed p-6 text-sm text-muted-foreground">
            Select a student from the queue to open the review workspace.
          </Card>
        )}
      </div>
    </div>
  );
}
