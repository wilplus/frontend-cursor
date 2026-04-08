"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import SelectFromPoolModal, { type PoolItem } from "@/components/admin/SelectFromPoolModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminApi, type StudentListItem, type TasksPoolItem, type StudentTask } from "@/lib/api/admin-client";

interface TasksPoolWorkspaceProps {
  onSelectedStudentChange?: (studentId: string | null) => void;
}

function taskLabel(text: string | null | undefined): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean || "(empty)";
}

function mapTasksPool(tasks: TasksPoolItem[]): PoolItem[] {
  return tasks.map((item) => ({
    id: item.id,
    label: taskLabel(item.text),
    subLabel:
      typeof item.max_performance_score === "number"
        ? `Max score: ${item.max_performance_score}`
        : undefined,
  }));
}

function resolveSelectedIds(tasks: StudentTask[], pool: TasksPoolItem[]): string[] {
  return tasks
    .map((task) => task.pool_task_id ?? pool.find((candidate) => candidate.text === task.text)?.id)
    .filter((value): value is string => Boolean(value));
}

export default function TasksPoolWorkspace({ onSelectedStudentChange }: TasksPoolWorkspaceProps) {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [savingTasks, setSavingTasks] = useState(false);

  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [tasksPool, setTasksPool] = useState<TasksPoolItem[]>([]);

  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tasksPoolLoading, setTasksPoolLoading] = useState(false);

  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const response = await adminApi.getStudents({ limit: 200, offset: 0 });
      const list = response.students ?? [];
      setStudents(list);
      setSelectedStudentId((previous) => previous ?? list[0]?.user_id ?? null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load students");
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const loadAssignments = useCallback(async (studentId: string) => {
    try {
      const assigned = await adminApi.getStudentTasks(studentId);
      setTasks(assigned);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load assigned tasks");
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    onSelectedStudentChange?.(selectedStudentId);
    if (!selectedStudentId) {
      setTasks([]);
      return;
    }
    void loadAssignments(selectedStudentId);
  }, [loadAssignments, onSelectedStudentChange, selectedStudentId]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.user_id === selectedStudentId) ?? null,
    [selectedStudentId, students]
  );

  const selectedIds = useMemo(() => resolveSelectedIds(tasks, tasksPool), [tasks, tasksPool]);

  const openTasksModal = async () => {
    setTasksModalOpen(true);
    setTasksPoolLoading(true);
    try {
      setTasksPool(await adminApi.getTasksPool());
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load tasks pool");
    } finally {
      setTasksPoolLoading(false);
    }
  };

  const syncTasks = async (poolTaskIds: string[]) => {
    if (!selectedStudentId) return;
    setSavingTasks(true);
    try {
      const response = await adminApi.putStudentTasksSync(selectedStudentId, {
        pool_task_ids: poolTaskIds,
      });
      setTasks(response.tasks ?? []);
      toast.success("Tasks updated.");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update tasks");
    } finally {
      setSavingTasks(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/80 bg-card/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Student
          </span>
          <select
            value={selectedStudentId ?? ""}
            onChange={(event) => setSelectedStudentId(event.target.value || null)}
            className="h-10 min-w-[280px] rounded-lg border border-input bg-background px-3 text-sm outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring"
            disabled={studentsLoading}
          >
            {students.length === 0 ? <option value="">No students</option> : null}
            {students.map((student) => (
              <option key={student.user_id} value={student.user_id}>
                {(student.name?.trim() || student.email?.trim() || student.user_email?.trim() || student.user_id).slice(
                  0,
                  80
                )}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => void loadStudents()} disabled={studentsLoading}>
            Refresh students
          </Button>
        </div>
        {selectedStudent ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Selected: {selectedStudent.name || selectedStudent.email || selectedStudent.user_email || selectedStudent.user_id}
          </p>
        ) : null}
      </Card>

      <Card className="border-border/80 bg-card/85 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-wide">Tasks (Assigned)</h3>
          <Button size="sm" onClick={() => void openTasksModal()} disabled={!selectedStudentId || savingTasks}>
            Swap from pool
          </Button>
        </div>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No tasks assigned.
            </p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-border/80 bg-background/60 px-3 py-2 text-sm">
                {taskLabel(task.text)}
              </div>
            ))
          )}
        </div>
      </Card>

      <SelectFromPoolModal
        open={tasksModalOpen}
        onOpenChange={setTasksModalOpen}
        title="Select Tasks"
        pool={mapTasksPool(tasksPool)}
        selectedIds={selectedIds}
        onConfirm={(ids) => void syncTasks(ids)}
        allowCreate
        poolLoading={tasksPoolLoading}
        onCreateNew={async (text) => {
          const created = await adminApi.createTasksPoolItem({ text, max_performance_score: 1 });
          return {
            id: created.tasks_pool_item.id,
            label: taskLabel(created.tasks_pool_item.text),
            subLabel: `Max score: ${created.tasks_pool_item.max_performance_score ?? 1}`,
          };
        }}
      />
    </div>
  );
}
