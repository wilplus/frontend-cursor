"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CopilotStudentQueueItem } from "@/lib/api/admin-client";

interface QueueSidebarProps {
  students: CopilotStudentQueueItem[];
  selectedStudentId: string | null;
  onSelectStudent: (student: CopilotStudentQueueItem) => void;
  loading?: boolean;
}

function stateClasses(state: CopilotStudentQueueItem["state"]): string {
  if (state === "Sent") return "bg-emerald-100 text-emerald-700";
  if (state === "Ready") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function QueueSidebar({
  students,
  selectedStudentId,
  onSelectStudent,
  loading = false,
}: QueueSidebarProps) {
  return (
    <Card className="h-full border-border/80 bg-card/80 p-3.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Queue</h2>
        <span className="text-xs text-muted-foreground">{students.length} students</span>
      </div>

      <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground animate-fade-in-short">
            Loading cohort students...
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground animate-fade-in-short">
            No students in this cohort yet.
          </div>
        ) : (
          students.map((student, index) => {
            const isActive = selectedStudentId === student.student_id;
            const name =
              student.profile?.name?.trim() ||
              student.profile?.email?.trim() ||
              student.student_id.slice(0, 8);
            return (
              <button
                key={`${student.student_id}-${student.session_id ?? "no-session"}`}
                type="button"
                onClick={() => onSelectStudent(student)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-all duration-200 animate-fade-in-short",
                  isActive
                    ? "border-primary/40 bg-primary/10 shadow-sm ring-1 ring-primary/20"
                    : "border-border bg-background hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-sm"
                )}
                style={{ animationDelay: `${Math.min(index * 25, 200)}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium leading-5">{name}</p>
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-wide",
                      stateClasses(student.state)
                    )}
                  >
                    {student.state}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-primary" : "bg-muted-foreground/60")} />
                    Pos #{student.queue_position ?? "-"}
                  </span>
                  <span>Score {student.profile?.canonical_score_for_display ?? "-"}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}
