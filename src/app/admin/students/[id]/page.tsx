"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ChevronLeft, Send, Pencil, Trash2, Check, X } from "lucide-react";
import SectionCard from "@/components/admin/SectionCard";
import SelectFromPoolModal, { type PoolItem } from "@/components/admin/SelectFromPoolModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminApi,
  type StudentProfile,
  type PostQuestion,
  type WarmUpTask,
  type WarmUpPoolTask,
  type FocusTask,
  type FocusTaskPoolItem,
} from "@/lib/api/admin-client";
import { getUserMetricQuestions, patchUserMetricQuestions } from "@/lib/api/client";
import MetricsSection from "@/components/admin/MetricsSection";
import { toast } from "sonner";

// —— Editable list row: text + hover Edit/Delete; edit = inline input + Check/X ——
function EditableListItem({
  text,
  onEdit,
  onDelete,
  saving,
}: {
  text: string;
  onEdit: (newText: string) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    setDraft(text);
  }, [text]);

  const handleSave = () => {
    const t = draft.trim();
    if (t) onEdit(t);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="group flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setEditing(false);
          }}
          className="h-7 flex-1 min-w-0 rounded border border-input bg-background px-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
          autoFocus
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded p-1 text-primary hover:bg-primary/10"
          aria-label="Save"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
      <span className="min-w-0 flex-1 text-sm">{text}</span>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          className="rounded p-1 text-destructive hover:bg-destructive/10"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// —— Edit/Create warm-up task modal: text + Max score (0–1); Save sends both. ——
function WarmUpTaskEditModal({
  open,
  onOpenChange,
  task,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: WarmUpTask | null;
  onSave: (data: { text: string; max_performance_score: number }) => Promise<void>;
  saving: boolean;
}) {
  const [text, setText] = useState("");
  const [scoreInput, setScoreInput] = useState("1");

  useEffect(() => {
    if (open) {
      setText(task?.text ?? "");
      setScoreInput(String(task?.max_performance_score ?? 1));
    }
  }, [open, task?.text, task?.max_performance_score]);

  const handleSave = async () => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      toast.error("Question text is required.");
      return;
    }
    const clampedScore = Math.min(1, Math.max(0, Number(scoreInput) || 1));
    try {
      await onSave({ text: trimmedText, max_performance_score: clampedScore });
      onOpenChange(false);
    } catch {
      // onSave already toasts error
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warm-up-edit-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="warm-up-edit-title" className="text-lg font-semibold mb-4">
          {task ? "Edit warm-up task" : "Add warm-up task"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Question text</label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. How are you doing today?"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max score (0–1)</label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

const POST_ANSWER_TYPES = ["text", "scale", "binary"] as const;

// —— Edit post-recording question (pool): text + answer_type ——
function PostQuestionEditModal({
  open,
  onOpenChange,
  question,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: PostQuestion | null;
  onSave: (data: { text: string; answer_type: string }) => Promise<void>;
  saving: boolean;
}) {
  const [text, setText] = useState("");
  const [answerType, setAnswerType] = useState("text");

  useEffect(() => {
    if (open && question) {
      setText(question.text);
      setAnswerType(question.answer_type || "text");
    }
  }, [open, question]);

  const handleSave = async () => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      toast.error("Question text is required.");
      return;
    }
    try {
      await onSave({ text: trimmedText, answer_type: answerType });
      onOpenChange(false);
    } catch {
      // onSave already toasts error
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-question-edit-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="post-question-edit-title" className="text-lg font-semibold mb-4">
          Edit post-recording question
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Question text</label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. How did this session feel?"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Answer type</label>
            <select
              value={answerType}
              onChange={(e) => setAnswerType(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {POST_ANSWER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// —— Edit/Create focus task modal: text + Max score (0–1); same pattern as warm-up. ——
function FocusTaskEditModal({
  open,
  onOpenChange,
  task,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: FocusTask | null;
  onSave: (data: { text: string; max_performance_score: number }) => Promise<void>;
  saving: boolean;
}) {
  const [text, setText] = useState("");
  const [scoreInput, setScoreInput] = useState("1");

  useEffect(() => {
    if (open) {
      setText(task?.text ?? "");
      setScoreInput(String(task?.max_performance_score ?? 1));
    }
  }, [open, task?.text, task?.max_performance_score]);

  const handleSave = async () => {
    const trimmedText = text.trim();
    if (!trimmedText) {
      toast.error("Task text is required.");
      return;
    }
    const clampedScore = Math.min(1, Math.max(0, Number(scoreInput) || 1));
    try {
      await onSave({ text: trimmedText, max_performance_score: clampedScore });
      onOpenChange(false);
    } catch {
      // onSave already toasts error
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-task-edit-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="focus-task-edit-title" className="text-lg font-semibold mb-4">
          {task ? "Edit focus task" : "Add focus task"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Task text</label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. What do you want to improve in this session?"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max score (0–1)</label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStudentProfilePage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [postQuestions, setPostQuestions] = useState<PostQuestion[]>([]);
  const [warmUpTasks, setWarmUpTasks] = useState<WarmUpTask[]>([]);
  const [userMetricQuestions, setUserMetricQuestions] = useState({
    metric_question_1: "",
    metric_question_2: "",
    metric_question_3: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalWarmUp, setModalWarmUp] = useState(false);
  const [warmUpPoolTasks, setWarmUpPoolTasks] = useState<WarmUpPoolTask[]>([]);
  const [warmUpPoolLoading, setWarmUpPoolLoading] = useState(false);
  const [warmUpEditOpen, setWarmUpEditOpen] = useState(false);
  const [warmUpEditTask, setWarmUpEditTask] = useState<WarmUpTask | null>(null);
  const [modalQuestions, setModalQuestions] = useState(false);
  const [postQuestionEditOpen, setPostQuestionEditOpen] = useState(false);
  const [postQuestionEdit, setPostQuestionEdit] = useState<PostQuestion | null>(null);

  const [modalFocus, setModalFocus] = useState(false);
  const [focusPoolTasks, setFocusPoolTasks] = useState<FocusTaskPoolItem[]>([]);
  const [focusPoolLoading, setFocusPoolLoading] = useState(false);
  const [focusEditOpen, setFocusEditOpen] = useState(false);
  const [focusEditTask, setFocusEditTask] = useState<FocusTask | null>(null);
  const [focusTasks, setFocusTasks] = useState<FocusTask[]>([]);
  const [warmUpTasksError, setWarmUpTasksError] = useState<string | null>(null);
  const [focusTasksError, setFocusTasksError] = useState<string | null>(null);

  const [overridesDraft, setOverridesDraft] = useState({
    assigned_post_question_ids: [] as string[],
  });
  const [contextDraft, setContextDraft] = useState("");

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setWarmUpTasksError(null);
    setFocusTasksError(null);
    // Load profile first; then load pool data (questions, warm-up tasks, metrics)
    adminApi
      .getStudentProfile(id)
      .then((p) => {
        setProfile(p);
        setOverridesDraft({
          assigned_post_question_ids: p.overrides?.assigned_post_question_ids ?? [],
        });
        const sp = p.speaker_profile || {};
        const parts = [
          sp.main_goal,
          sp.motivation,
          sp.strong_points,
          sp.weak_points,
          sp.coach_notes,
        ].filter(Boolean);
        setContextDraft(parts.join("\n\n"));
        return Promise.allSettled([
          adminApi.getPostQuestions(),
          adminApi.getWarmUpTasks(id),
          adminApi.getFocusTasks(id),
          getUserMetricQuestions(),
        ]);
      })
      .then((results) => {
        if (!results) return;
        const [questionsRes, warmUpRes, focusRes, userMetricsRes] = results;
        if (questionsRes.status === "fulfilled") setPostQuestions(questionsRes.value);
        else toast.error(questionsRes.reason?.message ?? "Could not load questions");
        if (warmUpRes.status === "fulfilled") {
          setWarmUpTasks(warmUpRes.value);
          setWarmUpTasksError(null);
        } else {
          const msg = warmUpRes.reason?.message ?? "Could not load warm-up tasks";
          setWarmUpTasksError(msg);
          toast.error(msg);
        }
        // Empty focus_tasks (200 + []) is success; only show error when the request actually failed.
        if (focusRes.status === "fulfilled") {
          setFocusTasks(focusRes.value);
          setFocusTasksError(null);
        } else {
          const msg = focusRes.reason?.message ?? "Could not load focus tasks";
          setFocusTasksError(msg);
          toast.error(msg);
        }
        if (userMetricsRes.status === "fulfilled") setUserMetricQuestions(userMetricsRes.value);
        else toast.error(userMetricsRes.reason?.message ?? "Could not load metric questions");
      })
      .catch((e) => {
        toast.error(e.message);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => load(), [load]);

  // Load warm-up task pool when "Select Warm-up Tasks" modal opens
  useEffect(() => {
    if (!modalWarmUp || !id) return;
    setWarmUpPoolLoading(true);
    adminApi
      .getWarmUpTaskPool()
      .then(setWarmUpPoolTasks)
      .catch((e) => toast.error(e?.message ?? "Could not load pool"))
      .finally(() => setWarmUpPoolLoading(false));
  }, [modalWarmUp, id]);

  // Load focus task pool when "Manage list" modal opens
  useEffect(() => {
    if (!modalFocus || !id) return;
    setFocusPoolLoading(true);
    adminApi
      .getFocusTaskPool()
      .then(setFocusPoolTasks)
      .catch((e) => toast.error(e?.message ?? "Could not load pool"))
      .finally(() => setFocusPoolLoading(false));
  }, [modalFocus, id]);

  const saveOverrides = () => {
    setSaving(true);
    adminApi
      .putOverrides(id, {
        assigned_post_question_ids: overridesDraft.assigned_post_question_ids,
      })
      .then(() => {
        toast.success("Saved");
        load();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const saveSpeakerProfile = () => {
    setSaving(true);
    adminApi
      .putSpeakerProfile(id, { coach_notes: contextDraft })
      .then(() => {
        toast.success("Profile saved");
        load();
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const sendAssignment = () => {
    adminApi.sendAssignment(id).then(() => toast.success("Homework sent")).catch((e) => toast.error(e.message));
  };

  // Warm-up: pool = global warm-up-task-pool; pre-select by student's pool_task_id (or match by text); confirm = sync pool_task_ids
  const warmUpPool: PoolItem[] = warmUpPoolTasks.map((p) => ({
    id: p.id,
    label: p.text,
    subLabel: p.max_performance_score != null ? `Max score: ${p.max_performance_score}` : undefined,
  }));
  const warmUpSelectedIds: string[] = (() => {
    const ordered = [...warmUpTasks].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    return ordered
      .map((t) => t.pool_task_id ?? warmUpPoolTasks.find((p) => p.text === t.text)?.id)
      .filter((x): x is string => Boolean(x));
  })();
  const handleWarmUpConfirm = (selectedIds: string[]) => {
    setModalWarmUp(false);
    const ordered = warmUpPoolTasks.map((p) => p.id).filter((id) => selectedIds.includes(id));
    setSaving(true);
    adminApi
      .putStudentWarmUpTasksSync(id, { pool_task_ids: ordered })
      .then(() => {
        load();
        toast.success("Warm-up tasks updated");
      })
      .catch((e) => toast.error(e?.message ?? "Failed to save"))
      .finally(() => setSaving(false));
  };
  const handleWarmUpCreate = async (text: string): Promise<PoolItem> => {
    // POST body: minimal { text }; backend can default order_index and max_performance_score
    const res = await adminApi.createWarmUpPoolTask({ text });
    const task = res.warm_up_task;
    setWarmUpPoolTasks((prev) => [...prev, task]);
    return {
      id: task.id,
      label: task.text,
      subLabel: task.max_performance_score != null ? `Max score: ${task.max_performance_score}` : undefined,
    };
  };

  const handleWarmUpEditModalSave = async (data: { text: string; max_performance_score: number }) => {
    setSaving(true);
    try {
      if (warmUpEditTask) {
        await adminApi.updateWarmUpTask(id, warmUpEditTask.id, {
          text: data.text,
          max_performance_score: data.max_performance_score,
        });
        toast.success("Updated");
      } else {
        await adminApi.createWarmUpTask(id, {
          text: data.text,
          order_index: warmUpTasks.length,
          max_performance_score: data.max_performance_score,
        });
        toast.success("Added");
      }
      load();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  // Post-recording questions: pool = global; 0 or any number; confirm = save assigned_post_question_ids
  const questionsPool: PoolItem[] = postQuestions.map((q) => ({ id: q.id, label: q.text }));
  const handleQuestionsConfirm = (selectedIds: string[]) => {
    setOverridesDraft((prev) => ({ ...prev, assigned_post_question_ids: selectedIds }));
    setModalQuestions(false);
    toast.success("Selection updated. Click Save to persist.");
  };
  const handleQuestionsCreate = async (text: string): Promise<PoolItem> => {
    const res = await adminApi.createPostQuestion({ text, answer_type: "text" });
    setPostQuestions((prev) => [...prev, res.question]);
    return { id: res.question.id, label: res.question.text };
  };

  const handlePostQuestionEditSave = async (data: { text: string; answer_type: string }) => {
    if (!postQuestionEdit) return;
    setSaving(true);
    try {
      await adminApi.updatePostQuestion(postQuestionEdit.id, { text: data.text, answer_type: data.answer_type });
      toast.success("Question updated");
      load();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const deleteWarmUpTask = (taskId: string) => {
    setSaving(true);
    adminApi
      .deleteWarmUpTask(id, taskId)
      .then(() => { load(); toast.success("Deleted"); })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  // Focus tasks: pool + per-student list (same pattern as warm-up)
  const focusPool: PoolItem[] = focusPoolTasks.map((p) => ({
    id: p.id,
    label: p.text,
    subLabel: p.max_performance_score != null ? `Max score: ${p.max_performance_score}` : undefined,
  }));
  const focusSelectedIds: string[] = (() => {
    const ordered = [...focusTasks].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    return ordered
      .map((t) => t.pool_task_id ?? focusPoolTasks.find((p) => p.text === t.text)?.id)
      .filter((x): x is string => Boolean(x));
  })();
  const handleFocusConfirm = (selectedIds: string[]) => {
    setModalFocus(false);
    const ordered = focusPoolTasks.map((p) => p.id).filter((pid) => selectedIds.includes(pid));
    setSaving(true);
    adminApi
      .putStudentFocusTasksSync(id, { pool_task_ids: ordered })
      .then(() => {
        load();
        toast.success("Focus tasks updated");
      })
      .catch((e) => toast.error(e?.message ?? "Failed to save"))
      .finally(() => setSaving(false));
  };
  const handleFocusCreate = async (text: string): Promise<PoolItem> => {
    const res = await adminApi.createFocusTaskPoolItem({ text, order_index: 0, max_performance_score: 1 });
    const item = res.focus_task;
    setFocusPoolTasks((prev) => [...prev, item]);
    return {
      id: item.id,
      label: item.text,
      subLabel: item.max_performance_score != null ? `Max score: ${item.max_performance_score}` : undefined,
    };
  };
  const handleFocusEditModalSave = async (data: { text: string; max_performance_score: number }) => {
    setSaving(true);
    try {
      if (focusEditTask) {
        await adminApi.updateFocusTask(id, focusEditTask.id, {
          text: data.text,
          max_performance_score: data.max_performance_score,
        });
        toast.success("Updated");
      } else {
        await adminApi.createFocusTask(id, {
          text: data.text,
          order_index: focusTasks.length,
          max_performance_score: data.max_performance_score,
        });
        toast.success("Added");
      }
      load();
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    } finally {
      setSaving(false);
    }
  };
  const deleteFocusTask = (taskId: string) => {
    setSaving(true);
    adminApi
      .deleteFocusTask(id, taskId)
      .then(() => { load(); toast.success("Deleted"); })
      .catch((e) => toast.error(e.message))
      .finally(() => setSaving(false));
  };

  const assignedQuestions = postQuestions.filter((q) => overridesDraft.assigned_post_question_ids.includes(q.id));

  const reports = (profile?.sessions ?? [])
    .filter((s) => s.report_preview?.report_text_preview)
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
    .slice(0, 10);

  const saveUserMetricQuestions = async (data: {
    metric_question_1: string;
    metric_question_2: string;
    metric_question_3: string;
  }) => {
    setSaving(true);
    try {
      await patchUserMetricQuestions(data);
      setUserMetricQuestions(data);
      toast.success("Metric questions saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Students
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{profile.email || profile.user_id}</h1>
      </div>

      {/* Homework Configuration */}
      <SectionCard
        title="Homework Configuration"
        description="Select items from the global pool or create new ones. New items are added to the pool for reuse."
        action={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={sendAssignment} className="gap-2">
              <Send className="h-4 w-4" aria-hidden /> Send Homework
            </Button>
            <Button type="button" onClick={saveOverrides} disabled={saving}>
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Warm-up Tasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Warm-up Tasks</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWarmUpEditTask(null);
                    setWarmUpEditOpen(true);
                  }}
                >
                  + Add
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setModalWarmUp(true)}>
                  Manage list
                </Button>
              </div>
            </div>
            {warmUpTasksError && (
              <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                {warmUpTasksError}
              </p>
            )}
            <ul className="space-y-2">
              {warmUpTasks.map((t) => (
                <li key={t.id} className="group flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">{t.text}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Max score: {t.max_performance_score ?? 1}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setWarmUpEditTask(t);
                        setWarmUpEditOpen(true);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteWarmUpTask(t.id)}
                      disabled={saving}
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {warmUpTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No warm-up tasks. Click + Add to create one.</p>
            )}
          </div>

          {/* Focus tasks: same pattern as warm-up (pool + per-student list, add/edit/delete, no limit) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Focus tasks</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFocusEditTask(null);
                    setFocusEditOpen(true);
                  }}
                >
                  + Add
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setModalFocus(true)}>
                  Manage list
                </Button>
              </div>
            </div>
            {focusTasksError && (
              <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                {focusTasksError}
              </p>
            )}
            <ul className="space-y-2">
              {[...focusTasks]
                .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                .map((q) => (
                  <li key={q.id} className="group flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm">{q.text}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Max score: {q.max_performance_score ?? 1}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setFocusEditTask(q);
                          setFocusEditOpen(true);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFocusTask(q.id)}
                        disabled={saving}
                        className="rounded p-1 text-destructive hover:bg-destructive/10"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
            {focusTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No focus tasks. Click + Add to create one.</p>
            )}
          </div>

          {/* Post-Recording Questions: list with Add (pool + create), Edit (modal), Remove (unassign). No limit. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Post-Recording Questions ({assignedQuestions.length} assigned)
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalQuestions(true)}>
                Add post-recording question
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional. Add, edit, or remove questions for this student. No limit.
            </p>
            <ul className="space-y-2">
              {assignedQuestions.map((q) => (
                <li key={q.id} className="group flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">{q.text}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{q.answer_type || "text"}</span>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setPostQuestionEdit(q);
                        setPostQuestionEditOpen(true);
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOverridesDraft((prev) => ({
                          ...prev,
                          assigned_post_question_ids: prev.assigned_post_question_ids.filter((x) => x !== q.id),
                        }))
                      }
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {assignedQuestions.length === 0 && (
              <p className="text-sm text-muted-foreground">No questions. Click Add post-recording question to create or choose from the pool.</p>
            )}
          </div>

          {/* Metrics: 3 custom questions (user metric questions) */}
          <MetricsSection
            metric_question_1={userMetricQuestions.metric_question_1}
            metric_question_2={userMetricQuestions.metric_question_2}
            metric_question_3={userMetricQuestions.metric_question_3}
            onSave={saveUserMetricQuestions}
            saving={saving}
          />
        </div>
      </SectionCard>

      {/* Speaker Profile */}
      <SectionCard
        title="Speaker Profile"
        description="Goals, motivation, and coach notes."
        action={
          <Button type="button" onClick={saveSpeakerProfile} disabled={saving}>
            Save
          </Button>
        }
      >
        <label className="block text-sm font-medium mb-2">Context</label>
        <textarea
          value={contextDraft}
          onChange={(e) => setContextDraft(e.target.value)}
          placeholder="Enter student context, goals, motivation, personality traits, and any notes for coaching..."
          rows={8}
          className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </SectionCard>

      {/* Reports History */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Reports History</h2>
        <div className="space-y-3">
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            reports.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-muted/30 p-4 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Report — {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {s.report_preview?.report_text_preview ?? ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <WarmUpTaskEditModal
        open={warmUpEditOpen}
        onOpenChange={(open) => {
          setWarmUpEditOpen(open);
          if (!open) setWarmUpEditTask(null);
        }}
        task={warmUpEditTask}
        onSave={handleWarmUpEditModalSave}
        saving={saving}
      />
      <SelectFromPoolModal
        open={modalWarmUp}
        onOpenChange={setModalWarmUp}
        title="Select Warm-up Tasks"
        pool={warmUpPool}
        selectedIds={warmUpSelectedIds}
        onConfirm={handleWarmUpConfirm}
        allowCreate
        onCreateNew={handleWarmUpCreate}
        poolLoading={warmUpPoolLoading}
      />
      <FocusTaskEditModal
        open={focusEditOpen}
        onOpenChange={(open) => {
          setFocusEditOpen(open);
          if (!open) setFocusEditTask(null);
        }}
        task={focusEditTask}
        onSave={handleFocusEditModalSave}
        saving={saving}
      />
      <SelectFromPoolModal
        open={modalFocus}
        onOpenChange={setModalFocus}
        title="Select Focus Tasks"
        pool={focusPool}
        selectedIds={focusSelectedIds}
        onConfirm={handleFocusConfirm}
        allowCreate
        onCreateNew={handleFocusCreate}
        poolLoading={focusPoolLoading}
      />
      <SelectFromPoolModal
        open={modalQuestions}
        onOpenChange={setModalQuestions}
        title="Add post-recording question"
        pool={questionsPool}
        selectedIds={overridesDraft.assigned_post_question_ids}
        onConfirm={handleQuestionsConfirm}
        allowCreate
        onCreateNew={handleQuestionsCreate}
      />
      <PostQuestionEditModal
        open={postQuestionEditOpen}
        onOpenChange={(open) => {
          setPostQuestionEditOpen(open);
          if (!open) setPostQuestionEdit(null);
        }}
        question={postQuestionEdit}
        onSave={handlePostQuestionEditSave}
        saving={saving}
      />
    </div>
  );
}
