"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import SelectFromPoolModal, { type PoolItem } from "@/components/admin/SelectFromPoolModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminApi,
  type StudentListItem,
  type TasksPoolItem,
  type StudentTask,
  type TasksPoolItemUpsertPayload,
} from "@/lib/api/admin-client";
import {
  formatTaskTemplateLabel,
  isTaskTemplateActive,
  TASK_TARGET_PROFILES,
  type TaskTargetProfile,
} from "@/lib/tasks/taskTemplateLabels";

interface TasksPoolWorkspaceProps {
  onSelectedStudentChange?: (studentId: string | null) => void;
}

type TaskTemplateFormState = {
  text: string;
  target_profile: TaskTargetProfile;
  level: string;
  step_in_level: string;
};

function taskLabel(text: string | null | undefined): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean || "(empty)";
}

function mapTasksPool(tasks: TasksPoolItem[]): PoolItem[] {
  return tasks.filter(isTaskTemplateActive).map((item) => ({
    id: item.id,
    label: taskLabel(item.text),
    subLabel: formatTaskTemplateLabel(item),
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
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<TaskTemplateFormState>({
    text: "",
    target_profile: "The Overwhelmed",
    level: "1",
    step_in_level: "1",
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);

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

  const loadPool = useCallback(async () => {
    setTasksPoolLoading(true);
    try {
      setTasksPool(await adminApi.getTasksPool());
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to load tasks pool");
    } finally {
      setTasksPoolLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPool();
  }, [loadPool]);

  const openTasksModal = async () => {
    setTasksModalOpen(true);
    if (tasksPool.length === 0) {
      await loadPool();
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

  const startCreateTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm({
      text: "",
      target_profile: "The Overwhelmed",
      level: "1",
      step_in_level: "1",
    });
  };

  const startEditTemplate = (item: TasksPoolItem) => {
    setEditingTemplateId(item.id);
    setTemplateForm({
      text: item.text ?? "",
      target_profile: (item.target_profile as TaskTargetProfile | null) ?? "The Overwhelmed",
      level: String(item.level ?? 1),
      step_in_level: String(item.step_in_level ?? 1),
    });
  };

  const parseTemplateForm = (): TasksPoolItemUpsertPayload | null => {
    const text = templateForm.text.trim();
    if (!text) {
      toast.error("Task text is required.");
      return null;
    }
    const level = Number.parseInt(templateForm.level.trim(), 10);
    const stepInLevel = Number.parseInt(templateForm.step_in_level.trim(), 10);
    if (!Number.isFinite(level) || level < 1) {
      toast.error("Level must be an integer >= 1.");
      return null;
    }
    if (!Number.isFinite(stepInLevel) || stepInLevel < 1 || stepInLevel > 10) {
      toast.error("Step in level must be an integer from 1 to 10.");
      return null;
    }
    return {
      text,
      target_profile: templateForm.target_profile,
      level,
      step_in_level: stepInLevel,
      is_active: true,
    };
  };

  const saveTemplate = async () => {
    const payload = parseTemplateForm();
    if (!payload) return;
    setSavingTemplate(true);
    try {
      if (editingTemplateId) {
        const updated = await adminApi.updateTasksPoolItem(editingTemplateId, payload);
        setTasksPool((prev) =>
          prev.map((item) =>
            item.id === editingTemplateId ? updated.tasks_pool : item
          )
        );
        toast.success("Task template updated.");
      } else {
        const created = await adminApi.createTasksPoolItem(payload);
        setTasksPool((prev) => [created.tasks_pool, ...prev]);
        toast.success("Task template created.");
      }
      startCreateTemplate();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save task template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const softDeleteTemplate = async (item: TasksPoolItem) => {
    const replacementExists = tasksPool.some(
      (candidate) =>
        candidate.id !== item.id &&
        isTaskTemplateActive(candidate) &&
        candidate.target_profile === item.target_profile &&
        candidate.level === item.level &&
        candidate.step_in_level === item.step_in_level
    );
    if (!replacementExists) {
      toast.error("Create a replacement task for the same profile/level/step before deleting this one.");
      return;
    }
    setDeletingTemplateId(item.id);
    try {
      const response = await adminApi.updateTasksPoolItem(item.id, {
        is_active: false,
      });
      setTasksPool((prev) => prev.map((row) => (row.id === item.id ? response.tasks_pool : row)));
      toast.success("Task template archived.");
      if (editingTemplateId === item.id) startCreateTemplate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to archive task template");
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const replaceTemplate = async (item: TasksPoolItem) => {
    const payload = parseTemplateForm();
    if (!payload) return;
    if (editingTemplateId !== item.id) {
      toast.error("Click Edit on the template first, adjust content, then use Replace.");
      return;
    }
    setSavingTemplate(true);
    try {
      const created = await adminApi.createTasksPoolItem({
        ...payload,
        replaces_task_id: item.id,
      });
      await adminApi.updateTasksPoolItem(item.id, { is_active: false });
      setTasksPool((prev) => [created.tasks_pool, ...prev.filter((row) => row.id !== item.id)]);
      toast.success("Template replaced. Old one archived, new one active.");
      startCreateTemplate();
      await loadPool();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to replace task template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const activeTemplates = useMemo(
    () =>
      tasksPool
        .filter(isTaskTemplateActive)
        .sort(
          (a, b) =>
            String(a.target_profile ?? "").localeCompare(String(b.target_profile ?? "")) ||
            (a.level ?? 0) - (b.level ?? 0) ||
            (a.step_in_level ?? 0) - (b.step_in_level ?? 0)
        ),
    [tasksPool]
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/80 bg-card/85 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-wide">Task Templates (Pool)</h3>
          <Button size="sm" variant="outline" onClick={startCreateTemplate} disabled={savingTemplate}>
            New template
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_120px_120px_auto]">
          <textarea
            value={templateForm.text}
            onChange={(event) => setTemplateForm((prev) => ({ ...prev, text: event.target.value }))}
            placeholder="Task text..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={templateForm.target_profile}
            onChange={(event) =>
              setTemplateForm((prev) => ({ ...prev, target_profile: event.target.value as TaskTargetProfile }))
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {TASK_TARGET_PROFILES.map((profile) => (
              <option key={profile} value={profile}>
                {profile}
              </option>
            ))}
          </select>
          <Input
            value={templateForm.level}
            onChange={(event) => setTemplateForm((prev) => ({ ...prev, level: event.target.value }))}
            type="number"
            min={1}
            placeholder="Level"
          />
          <Input
            value={templateForm.step_in_level}
            onChange={(event) => setTemplateForm((prev) => ({ ...prev, step_in_level: event.target.value }))}
            type="number"
            min={1}
            max={10}
            placeholder="Step"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void saveTemplate()} disabled={savingTemplate}>
              {editingTemplateId ? "Update" : "Create"}
            </Button>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {activeTemplates.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No active task templates in pool.
            </p>
          ) : (
            activeTemplates.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/80 bg-background/60 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{taskLabel(item.text)}</p>
                    <p className="text-xs text-muted-foreground">{formatTaskTemplateLabel(item)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEditTemplate(item)} disabled={savingTemplate}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void replaceTemplate(item)}
                      disabled={savingTemplate || editingTemplateId !== item.id}
                      title={editingTemplateId !== item.id ? "Edit this template first, then click Replace." : undefined}
                    >
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void softDeleteTemplate(item)}
                      disabled={deletingTemplateId === item.id}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

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
          const created = await adminApi.createTasksPoolItem({
            text,
            target_profile: "The Overwhelmed",
            level: 1,
            step_in_level: 1,
          });
          return {
            id: created.tasks_pool.id,
            label: taskLabel(created.tasks_pool.text),
            subLabel: formatTaskTemplateLabel(created.tasks_pool),
          };
        }}
      />
    </div>
  );
}
