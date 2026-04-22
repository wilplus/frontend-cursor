"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Send, Pencil, Trash2, Check, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import ReportDetailModal from "@/components/admin/ReportDetailModal";
import CompactReportPreviewCard from "@/components/reports/CompactReportPreviewCard";
import SectionCard from "@/components/admin/SectionCard";
import LatestSessionMetrics from "@/components/admin/LatestSessionMetrics";
import SelectFromPoolModal, { type PoolItem } from "@/components/admin/SelectFromPoolModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminApi,
  getStudentSniperProgressFromProfile,
  type SendAssignmentResponse,
  type StudentProfile,
  type StudentSniperProgress,
  type PostQuestion,
  type StudentTask,
  type TasksPoolItem,
  type FocusTask,
  type FocusTaskPoolItem,
  type CoachSuggestionResponse,
} from "@/lib/api/admin-client";
import type { CompactReportPreview } from "@/lib/reports/compact-preview";
import { toCompactReportPreview } from "@/lib/reports/compact-preview";
// Metrics question UI is currently hidden; avoid loading/saving dead data paths here.
import MetricsSection from "@/components/admin/MetricsSection";
import { toast } from "sonner";
import {
  adminRichTextContentClassName,
  sanitizeRichHtml,
  stripHtmlToText,
} from "@/lib/sanitizeRichHtml";
import { resolveSessionRowWpm } from "@/lib/admin/resolveWpm";
import {
  formatTaskTemplateLabel,
  isTaskTemplateActive,
  TASK_TARGET_PROFILES,
  type TaskTargetProfile,
} from "@/lib/tasks/taskTemplateLabels";

function getStudentSniperProgressFromAssignmentResponse(
  userId: string,
  response: SendAssignmentResponse
): StudentSniperProgress | null {
  const nestedProfile = response.sniper_profile;
  const realtimeLevel = response.realtime_level ?? nestedProfile?.realtime_level ?? null;
  const realtimeStep = response.realtime_step ?? nestedProfile?.realtime_step ?? null;
  const sessionsWithPitchCount = nestedProfile?.sessions_with_pitch_count ?? null;
  const realtimePitchBaselineSt = nestedProfile?.realtime_pitch_baseline_st ?? null;
  const updatedAt = nestedProfile?.updated_at ?? null;

  if (
    realtimeLevel == null &&
    realtimeStep == null &&
    sessionsWithPitchCount == null &&
    realtimePitchBaselineSt == null &&
    updatedAt == null
  ) {
    return null;
  }

  return {
    user_id: nestedProfile?.user_id ?? userId,
    realtime_level: realtimeLevel,
    realtime_step: realtimeStep,
    sessions_with_pitch_count: sessionsWithPitchCount,
    realtime_pitch_baseline_st: realtimePitchBaselineSt,
    updated_at: updatedAt,
  };
}

function parseOptionalPositiveInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isInteger(numeric) || numeric < 1) {
    throw new Error("Current realtime level and step must be whole numbers greater than or equal to 1.");
  }
  return numeric;
}

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

// —— Edit/Create student task modal (tasks / tasks_pool): text + Max score (0–1). ——
function StudentTaskEditModal({
  open,
  onOpenChange,
  task,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: StudentTask | null;
  onSave: (data: { text: string; max_performance_score: number }) => Promise<void>;
  saving: boolean;
}) {
  const [text, setText] = useState("");
  const [scoreInput, setScoreInput] = useState("1");
  const editorRef = useRef<HTMLDivElement | null>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      setText(task?.text ?? "");
      setScoreInput(String(task?.max_performance_score ?? 1));
    }
  }, [open, task?.text, task?.max_performance_score]);

  useEffect(() => {
    if (!open || !editorRef.current) return;
    editorRef.current.innerHTML = text;
  }, [open, text]);

  const handleSave = async () => {
    const plainText = stripHtmlToText(text);
    if (!plainText) {
      toast.error("Task text is required.");
      return;
    }
    const clampedScore = Math.min(1, Math.max(0, Number(scoreInput) || 1));
    try {
      await onSave({ text, max_performance_score: clampedScore });
      onOpenChange(false);
    } catch {
      // onSave already toasts error
    }
  };

  const applyEditorCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setText(editorRef.current?.innerHTML ?? "");
  };

  if (!open) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-task-edit-title"
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="student-task-edit-title" className="text-lg font-semibold mb-4">
          {task ? "Edit task" : "Add task"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Task text</label>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => applyEditorCommand("bold")}>
                  Bold
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyEditorCommand("italic")}>
                  Italic
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyEditorCommand("insertUnorderedList")}>
                  Bullet list
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyEditorCommand("insertOrderedList")}>
                  Numbered list
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = window.prompt("Enter link URL");
                    if (!url) return;
                    applyEditorCommand("createLink", url);
                  }}
                >
                  Link
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => applyEditorCommand("removeFormat")}>
                  Clear format
                </Button>
              </div>
              <div
                ref={editorRef}
                className="min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-within:ring-2 focus-within:ring-ring [&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
                role="textbox"
                aria-label="Task text"
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setText((e.currentTarget as HTMLDivElement).innerHTML)}
              />
              <p className="text-xs text-muted-foreground">
                Rich text supported. This text is shown to the student in the Task step.
              </p>
            </div>
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
  if (typeof document !== "undefined" && document.body) {
    return createPortal(overlay, document.body);
  }
  return overlay;
}

function CreateTaskTemplateModal({
  open,
  onOpenChange,
  initialText,
  onConfirm,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText: string;
  onConfirm: (data: { target_profile: TaskTargetProfile; level: number; step_in_level: number }) => Promise<void>;
  saving: boolean;
}) {
  const [targetProfile, setTargetProfile] = useState<TaskTargetProfile>("The Overwhelmed");
  const [levelInput, setLevelInput] = useState("1");
  const [stepInput, setStepInput] = useState("1");
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setTargetProfile("The Overwhelmed");
    setLevelInput("1");
    setStepInput("1");
  }, [open]);

  const handleSave = async () => {
    const level = Number.parseInt(levelInput, 10);
    const step = Number.parseInt(stepInput, 10);
    if (!Number.isFinite(level) || level < 1) {
      toast.error("Level must be >= 1.");
      return;
    }
    if (!Number.isFinite(step) || step < 1 || step > 10) {
      toast.error("Step in level must be between 1 and 10.");
      return;
    }
    await onConfirm({
      target_profile: targetProfile,
      level,
      step_in_level: step,
    });
    onOpenChange(false);
  };

  if (!open) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-template-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-lg p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-template-title" className="text-lg font-semibold mb-4">
          Add Task Template Labels
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Task text</label>
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {initialText || "(empty)"}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Student profile</label>
            <select
              value={targetProfile}
              onChange={(event) => setTargetProfile(event.target.value as TaskTargetProfile)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {TASK_TARGET_PROFILES.map((profile) => (
                <option key={profile} value={profile}>
                  {profile}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Level</label>
              <Input
                type="number"
                min={1}
                value={levelInput}
                onChange={(event) => setLevelInput(event.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Step in level</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={stepInput}
                onChange={(event) => setStepInput(event.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? "Saving..." : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
  if (typeof document !== "undefined" && document.body) {
    return createPortal(overlay, document.body);
  }
  return overlay;
}

const POST_ANSWER_TYPES = ["text", "scale", "binary"] as const;

// —— Create/Edit post-recording question (per-student): text + answer_type; same pattern as tasks/focus. ——
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

  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      setText(question?.text ?? "");
      setAnswerType(question?.answer_type ?? "text");
    }
  }, [open, question?.text, question?.answer_type]);

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

  const overlay = (
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
          {question ? "Edit post-recording question" : "Add post-recording question"}
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
  if (typeof document !== "undefined" && document.body) {
    return createPortal(overlay, document.body);
  }
  return overlay;
}

// —— Edit/Create focus task modal: text + Max score (0–1); same pattern as student tasks. ——
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

  useBodyScrollLock(open);

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

  const overlay = (
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
  if (typeof document !== "undefined" && document.body) {
    return createPortal(overlay, document.body);
  }
  return overlay;
}

export default function AdminStudentProfilePage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [studentSniperProgress, setStudentSniperProgress] = useState<StudentSniperProgress | null>(null);
  const [studentName, setStudentName] = useState("");
  const [pricePerLiveLessonUsd, setPricePerLiveLessonUsd] = useState("");
  const [creditsValue, setCreditsValue] = useState("");
  const [studentTasks, setStudentTasks] = useState<StudentTask[]>([]);
  const [userMetricQuestions, setUserMetricQuestions] = useState({
    metric_question_1: "",
    metric_question_2: "",
    metric_question_3: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [learningDataOpen, setLearningDataOpen] = useState(false);

  const [modalTasksPool, setModalTasksPool] = useState(false);
  const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false);
  const [createTemplateText, setCreateTemplateText] = useState("");
  const [createTemplateSaving, setCreateTemplateSaving] = useState(false);
  const [tasksPoolItems, setTasksPoolItems] = useState<TasksPoolItem[]>([]);
  const [tasksPoolLoading, setTasksPoolLoading] = useState(false);
  const [studentTaskEditOpen, setStudentTaskEditOpen] = useState(false);
  const [studentTaskEdit, setStudentTaskEdit] = useState<StudentTask | null>(null);
  const [postQuestionEditOpen, setPostQuestionEditOpen] = useState(false);
  const [postQuestionEdit, setPostQuestionEdit] = useState<PostQuestion | null>(null);
  const [postRecordingQuestions, setPostRecordingQuestions] = useState<PostQuestion[]>([]);
  const [postRecordingQuestionsError, setPostRecordingQuestionsError] = useState<string | null>(null);

  const [modalFocus, setModalFocus] = useState(false);
  const [focusPoolTasks, setFocusPoolTasks] = useState<FocusTaskPoolItem[]>([]);
  const [focusPoolLoading, setFocusPoolLoading] = useState(false);
  const [focusEditOpen, setFocusEditOpen] = useState(false);
  const [focusEditTask, setFocusEditTask] = useState<FocusTask | null>(null);
  const [focusTasks, setFocusTasks] = useState<FocusTask[]>([]);
  const [studentTasksError, setStudentTasksError] = useState<string | null>(null);
  const [focusTasksError, setFocusTasksError] = useState<string | null>(null);
  const [queuedStudentTaskUpserts, setQueuedStudentTaskUpserts] = useState<Array<{
    id: string;
    text: string;
    max_performance_score: number;
    order_index: number;
  }>>([]);
  const [queuedStudentTaskDeletes, setQueuedStudentTaskDeletes] = useState<string[]>([]);
  const [queuedFocusUpserts, setQueuedFocusUpserts] = useState<Array<{
    id: string;
    text: string;
    max_performance_score: number;
    order_index: number;
  }>>([]);
  const [queuedFocusDeletes, setQueuedFocusDeletes] = useState<string[]>([]);
  const [queuedPostQuestionUpserts, setQueuedPostQuestionUpserts] = useState<Array<{
    id: string;
    text: string;
    answer_type: string;
  }>>([]);
  const [queuedPostQuestionDeletes, setQueuedPostQuestionDeletes] = useState<string[]>([]);

  /** Pending list selections (not saved yet). Null = use server state. */
  const [pendingTasksPoolIds, setPendingTasksPoolIds] = useState<string[] | null>(null);
  const [pendingFocusIds, setPendingFocusIds] = useState<string[] | null>(null);
  const [pendingPostQuestionIds, setPendingPostQuestionIds] = useState<string[] | null>(null);

  const [contextDraft, setContextDraft] = useState("");
  const [assignmentVideoDescription, setAssignmentVideoDescription] = useState("");
  const [selectedSimilarIds, setSelectedSimilarIds] = useState<Set<string>>(new Set());
  const [currentRealtimeLevel, setCurrentRealtimeLevel] = useState("");
  const [currentRealtimeStep, setCurrentRealtimeStep] = useState("");
  const [adminReportPreviews, setAdminReportPreviews] = useState<Record<string, CompactReportPreview | null>>({});
  const [adminReportPreviewLoading, setAdminReportPreviewLoading] = useState<Record<string, boolean>>({});
  const [reportModalSession, setReportModalSession] = useState<
    (NonNullable<StudentProfile["sessions"]>[number] & { report_preview?: { report_text_preview?: string } }) | null
  >(null);

  // AI Coach Assistant state
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<CoachSuggestionResponse | null>(null);
  const [aiHistory, setAiHistory] = useState<Array<{ role: "user" | "assistant"; content: string; timestamp: string }>>([]);
  const [aiHistoryOpen, setAiHistoryOpen] = useState(false);
  const loadVersionRef = useRef(0);
  const tasksPoolCacheRef = useRef(false);
  const focusPoolCacheRef = useRef(false);
  const pendingPoolTemplateCreateRef = useRef<{
    text: string;
    resolve: (item: PoolItem | void) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    const currentLoadVersion = ++loadVersionRef.current;
    setLoading(true);
    setStudentSniperProgress(null);
    setStudentTasksError(null);
    setFocusTasksError(null);
    setPostRecordingQuestionsError(null);
    // Load all sections in parallel so profile render does not block downstream data.
    Promise.allSettled([
      adminApi.getStudentProfile(id),
      adminApi.getStudentTasks(id),
      adminApi.getStudentSniperProgress(id),
    ])
      .then((results) => {
        if (currentLoadVersion !== loadVersionRef.current) return;

        const [
          profileRes,
          studentTasksRes,
          sniperProgressRes,
        ] = results;

        if (profileRes.status !== "fulfilled") {
          throw profileRes.reason;
        }

        const p = profileRes.value;
        if (p.user_id && p.user_id !== id) {
          throw new Error(
            `Profile mismatch: requested student ${id} but received ${p.user_id}.`
          );
        }
        setProfile(p);
        const profileSniperProgress = getStudentSniperProgressFromProfile(p);
        setStudentSniperProgress(profileSniperProgress);
        setCurrentRealtimeLevel(
          profileSniperProgress?.realtime_level != null ? String(profileSniperProgress.realtime_level) : ""
        );
        setCurrentRealtimeStep(
          profileSniperProgress?.realtime_step != null ? String(profileSniperProgress.realtime_step) : ""
        );
        const rawName = (p as { name?: string | null; display_name?: string | null }).name
          ?? (p as { name?: string | null; display_name?: string | null }).display_name
          ?? "";
        setStudentName(rawName);
        const rawPrice =
          (p as { price_per_live_lesson?: number | string | null }).price_per_live_lesson ?? null;
        setPricePerLiveLessonUsd(
          rawPrice == null || rawPrice === ""
            ? ""
            : Number.isFinite(Number(rawPrice))
              ? String(Number(rawPrice))
              : ""
        );
        const rawCredits = p.credits ?? null;
        setCreditsValue(rawCredits == null ? "" : String(rawCredits));
        const sp = p.speaker_profile || {};
        const legacyJoined = [
          sp.main_goal,
          sp.motivation,
          sp.strong_points,
          sp.weak_points,
          sp.charismatic_traits,
          sp.hobbies_interests,
          sp.personality_type,
          sp.coach_notes,
        ]
          .filter(Boolean)
          .join("\n\n");
        // “Student Learning Profile” saves this textarea to `coach_notes` only; prefer it when set so reload matches save.
        setContextDraft(typeof sp.coach_notes === "string" ? sp.coach_notes : legacyJoined);
        setPendingTasksPoolIds(null);
        setPendingFocusIds(null);
        setPendingPostQuestionIds(null);
        setQueuedStudentTaskUpserts([]);
        setQueuedStudentTaskDeletes([]);
        setQueuedFocusUpserts([]);
        setQueuedFocusDeletes([]);
        setQueuedPostQuestionUpserts([]);
        setQueuedPostQuestionDeletes([]);

        if (studentTasksRes.status === "fulfilled") {
          setStudentTasks(studentTasksRes.value);
          setStudentTasksError(null);
        } else {
          const msg = studentTasksRes.reason?.message ?? "Could not load tasks";
          setStudentTasksError(msg);
          toast.error(msg);
        }

        setFocusTasks([]);
        setFocusTasksError(null);
        setPostRecordingQuestions([]);
        setPostRecordingQuestionsError(null);

        if (sniperProgressRes.status === "fulfilled" && sniperProgressRes.value) {
          setStudentSniperProgress(sniperProgressRes.value);
          setCurrentRealtimeLevel(
            sniperProgressRes.value.realtime_level != null ? String(sniperProgressRes.value.realtime_level) : ""
          );
          setCurrentRealtimeStep(
            sniperProgressRes.value.realtime_step != null ? String(sniperProgressRes.value.realtime_step) : ""
          );
        } else {
          setStudentSniperProgress(profileSniperProgress);
        }
      })
      .catch((e) => {
        if (currentLoadVersion !== loadVersionRef.current) return;
        toast.error(e.message);
        setProfile(null);
        setStudentSniperProgress(null);
      })
      .finally(() => {
        if (currentLoadVersion === loadVersionRef.current) setLoading(false);
      });
  }, [id]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    tasksPoolCacheRef.current = false;
    focusPoolCacheRef.current = false;
  }, [id]);

  // Load AI Coach suggestion history on mount
  useEffect(() => {
    if (!id) return;
    adminApi.getCoachSuggestionHistory(id).then((res) => {
      setAiHistory(res.messages || []);
    }).catch(() => {});
  }, [id]);

  const sendAiMessage = async () => {
    if (!aiMessage.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await adminApi.sendCoachSuggestion(id, aiMessage.trim());
      setAiSuggestion(res);
      const hist = await adminApi.getCoachSuggestionHistory(id);
      setAiHistory(hist.messages || []);
      setAiMessage("");
    } catch (e) {
      toast.error((e as Error)?.message ?? "AI suggestion failed");
    } finally {
      setAiLoading(false);
    }
  };

  // Load tasks pool when the modal opens
  useEffect(() => {
    if (!modalTasksPool || !id) return;
    if (tasksPoolCacheRef.current) return;
    setTasksPoolLoading(true);
    adminApi
      .getTasksPool()
      .then((items) => {
        setTasksPoolItems(items);
        tasksPoolCacheRef.current = true;
      })
      .catch((e) => toast.error(e?.message ?? "Could not load pool"))
      .finally(() => setTasksPoolLoading(false));
  }, [modalTasksPool, id]);

  // Focus task endpoints are tombstoned in backend; keep this section disabled.
  useEffect(() => {
    setFocusPoolTasks([]);
    setFocusPoolLoading(false);
    focusPoolCacheRef.current = true;
  }, [id]);

  /** Save all batched changes (speaker profile, metrics, overrides, list syncs). */
  const saveAllChanges = async () => {
    const normalizedName = studentName.trim();
    const normalizedPrice = pricePerLiveLessonUsd.trim();
    const normalizedCredits = creditsValue.trim();
    if (normalizedPrice !== "" && !Number.isFinite(Number(normalizedPrice))) {
      toast.error("Live lesson price must be a valid number in USD.");
      return;
    }
    if (normalizedCredits !== "" && !Number.isFinite(Number(normalizedCredits))) {
      toast.error("Credits must be a valid number.");
      return;
    }

    let nextRealtimeLevel: number | null;
    let nextRealtimeStep: number | null;
    try {
      nextRealtimeLevel = parseOptionalPositiveInteger(currentRealtimeLevel);
      nextRealtimeStep = parseOptionalPositiveInteger(currentRealtimeStep);
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }

    setSaving(true);
    try {
      for (const taskId of queuedStudentTaskDeletes) {
        await adminApi.deleteStudentTask(id, taskId);
      }
      for (const row of queuedStudentTaskUpserts) {
        if (row.id.startsWith("draft-")) {
          await adminApi.createTasksPoolItemAndAssign(id, {
            text: row.text,
            order_index: row.order_index,
            max_performance_score: row.max_performance_score,
          });
        } else {
          await adminApi.updateStudentTask(id, row.id, {
            text: row.text,
            order_index: row.order_index,
            max_performance_score: row.max_performance_score,
          });
        }
      }
      for (const focusId of queuedFocusDeletes) {
        await adminApi.deleteFocusTask(id, focusId);
      }
      for (const focus of queuedFocusUpserts) {
        if (focus.id.startsWith("draft-")) {
          await adminApi.createFocusTask(id, {
            text: focus.text,
            order_index: focus.order_index,
            max_performance_score: focus.max_performance_score,
          });
        } else {
          await adminApi.updateFocusTask(id, focus.id, {
            text: focus.text,
            order_index: focus.order_index,
            max_performance_score: focus.max_performance_score,
          });
        }
      }
      for (const questionId of queuedPostQuestionDeletes) {
        await adminApi.deletePostRecordingQuestion(id, questionId);
      }
      for (const question of queuedPostQuestionUpserts) {
        if (question.id.startsWith("draft-")) {
          await adminApi.createPostRecordingQuestion(id, {
            text: question.text,
            answer_type: question.answer_type,
          });
        } else {
          await adminApi.updatePostRecordingQuestion(id, question.id, {
            text: question.text,
            answer_type: question.answer_type,
          });
        }
      }
      await adminApi.patchStudent(id, {
        name: normalizedName === "" ? null : normalizedName,
        price_per_live_lesson:
          normalizedPrice === "" ? null : Math.max(0, Number(normalizedPrice)),
        credits:
          normalizedCredits === "" ? null : Math.max(0, Math.round(Number(normalizedCredits))),
      });
      const persistedRealtimeLevel = studentSniperProgress?.realtime_level ?? null;
      const persistedRealtimeStep = studentSniperProgress?.realtime_step ?? null;
      const progressionChanged =
        nextRealtimeLevel !== persistedRealtimeLevel || nextRealtimeStep !== persistedRealtimeStep;

      if (progressionChanged) {
        try {
          const updatedSniperProgress = await adminApi.putStudentSniperProgress(id, {
            realtime_level: nextRealtimeLevel,
            realtime_step: nextRealtimeStep,
          });
          setStudentSniperProgress(updatedSniperProgress);
          setCurrentRealtimeLevel(
            updatedSniperProgress?.realtime_level != null ? String(updatedSniperProgress.realtime_level) : ""
          );
          setCurrentRealtimeStep(
            updatedSniperProgress?.realtime_step != null ? String(updatedSniperProgress.realtime_step) : ""
          );
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  realtime_level: updatedSniperProgress?.realtime_level ?? null,
                  realtime_step: updatedSniperProgress?.realtime_step ?? null,
                  sniper_profile: updatedSniperProgress,
                }
              : prev
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Failed to update realtime progression";
          if (
            msg.includes("PGRST204") ||
            msg.includes("realtime_level") ||
            msg.includes("user_sniper_profile") ||
            msg.includes("student_profile")
          ) {
            throw new Error(
              "Could not update current unlocked step because backend schema is missing realtime progression columns. Please deploy the latest backend migrations and reload PostgREST schema cache."
            );
          }
          throw e;
        }
      }
      await adminApi.putSpeakerProfile(id, { coach_notes: contextDraft });
      if (pendingTasksPoolIds !== null) {
        await adminApi.putStudentTasksSync(id, { pool_task_ids: pendingTasksPoolIds });
        setPendingTasksPoolIds(null);
      }
      if (pendingFocusIds !== null) {
        await adminApi.putStudentFocusTasksSync(id, { pool_task_ids: pendingFocusIds });
        setPendingFocusIds(null);
      }
      if (pendingPostQuestionIds !== null) {
        await adminApi.putStudentPostRecordingQuestionsSync(id, { pool_question_ids: pendingPostQuestionIds });
        setPendingPostQuestionIds(null);
      }
      setQueuedStudentTaskUpserts([]);
      setQueuedStudentTaskDeletes([]);
      setQueuedFocusUpserts([]);
      setQueuedFocusDeletes([]);
      setQueuedPostQuestionUpserts([]);
      setQueuedPostQuestionDeletes([]);
      tasksPoolCacheRef.current = false;
      focusPoolCacheRef.current = false;
      toast.success("All changes saved");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSimilarStudent = (userId: string) => {
    setSelectedSimilarIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const sendAssignment = () => {
    const videoDesc = assignmentVideoDescription.trim();
    if (videoDesc.length > 2000) {
      toast.error("Message to student must be 2000 characters or less");
      return;
    }
    const body: { video_description?: string; additional_user_ids?: string[] } = {};
    if (videoDesc) body.video_description = videoDesc;
    if (selectedSimilarIds.size > 0) body.additional_user_ids = [...selectedSimilarIds];
    adminApi
      .sendAssignment(id, Object.keys(body).length > 0 ? body : undefined)
      .then((response) => {
        const progress = getStudentSniperProgressFromAssignmentResponse(id, response);
        if (progress) {
          setStudentSniperProgress(progress);
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  realtime_level: progress.realtime_level ?? prev.realtime_level ?? null,
                  realtime_step: progress.realtime_step ?? prev.realtime_step ?? null,
                  sniper_profile: {
                    ...(prev.sniper_profile ?? { user_id: progress.user_id }),
                    ...progress,
                  },
                }
              : prev
          );
        }
        const count = 1 + selectedSimilarIds.size;
        toast.success(count > 1 ? `Homework sent to ${count} students` : "Homework sent");
        setAssignmentVideoDescription("");
        setSelectedSimilarIds(new Set());
      })
      .catch((e) => toast.error(e.message));
  };

  // Tasks (mirrors focus_tasks): pool + per-student list; confirm = PUT sync pool_task_ids.
  const tasksPoolModalItems: PoolItem[] = tasksPoolItems.map((p) => ({
    id: p.id,
    label: p.text,
    subLabel: formatTaskTemplateLabel(p),
    labelHtml: true,
  })).filter((item) => {
    const source = tasksPoolItems.find((row) => row.id === item.id);
    return source ? isTaskTemplateActive(source) : true;
  });
  const tasksPoolSelectedIds: string[] = (() => {
    const ordered = [...studentTasks].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    return ordered
      .map((t) => t.pool_task_id ?? tasksPoolItems.find((p) => p.text === t.text)?.id)
      .filter((x): x is string => Boolean(x));
  })();
  /** Display list: pending selection or server list. When pending, show tasks from pool. */
  const displayStudentTasks = pendingTasksPoolIds !== null
    ? pendingTasksPoolIds
        .map((pid) => tasksPoolItems.find((p) => p.id === pid))
        .filter((x): x is TasksPoolItem => x != null)
    : studentTasks;
  const handleTasksPoolConfirm = (selectedIds: string[]) => {
    setModalTasksPool(false);
    const ordered = tasksPoolItems.map((p) => p.id).filter((pid) => selectedIds.includes(pid));
    setPendingTasksPoolIds(ordered);
  };
  const requestCreatePoolTemplate = (text: string): Promise<PoolItem | void> =>
    new Promise((resolve, reject) => {
      pendingPoolTemplateCreateRef.current = {
        text,
        resolve,
        reject,
      };
      setCreateTemplateText(text);
      setCreateTemplateModalOpen(true);
    });
  const handleCreateTemplateModalConfirm = async (data: {
    target_profile: TaskTargetProfile;
    level: number;
    step_in_level: number;
  }) => {
    const pending = pendingPoolTemplateCreateRef.current;
    if (!pending) return;
    setCreateTemplateSaving(true);
    try {
      const created = await adminApi.createTasksPoolItem({
        text: pending.text,
        target_profile: data.target_profile,
        level: data.level,
        step_in_level: data.step_in_level,
        is_active: true,
      });
      const item = created.tasks_pool;
      setTasksPoolItems((prev) => [item, ...prev]);
      pending.resolve({
        id: item.id,
        label: item.text,
        subLabel: formatTaskTemplateLabel(item),
        labelHtml: true,
      });
      pendingPoolTemplateCreateRef.current = null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to create task template");
      pending.reject(err);
    } finally {
      setCreateTemplateSaving(false);
    }
  };
  const handleCreateTemplateModalOpenChange = (open: boolean) => {
    setCreateTemplateModalOpen(open);
    if (!open) {
      const pending = pendingPoolTemplateCreateRef.current;
      if (pending) pending.resolve();
      pendingPoolTemplateCreateRef.current = null;
    }
  };
  const handleStudentTaskEditSave = async (data: { text: string; max_performance_score: number }) => {
    const targetId = studentTaskEdit?.id ?? `draft-${crypto.randomUUID()}`;
    const orderIndex = studentTaskEdit?.order_index ?? studentTasks.length;
    setStudentTasks((prev) => {
      if (studentTaskEdit) {
        return prev.map((t) =>
          t.id === studentTaskEdit.id
            ? { ...t, text: data.text, max_performance_score: data.max_performance_score, order_index: orderIndex }
            : t
        );
      }
      return [
        ...prev,
        {
          id: targetId,
          user_id: id,
          text: data.text,
          order_index: orderIndex,
          max_performance_score: data.max_performance_score,
        },
      ];
    });
    setQueuedStudentTaskDeletes((prev) => prev.filter((qid) => qid !== targetId));
    setQueuedStudentTaskUpserts((prev) => {
      const next = prev.filter((q) => q.id !== targetId);
      next.push({
        id: targetId,
        text: data.text,
        max_performance_score: data.max_performance_score,
        order_index: orderIndex,
      });
      return next;
    });
    toast.success("Queued. Click Save all changes.");
  };

  // Per-student post-recording questions display (pool/sync removed; pendingPostQuestionIds is now always null).
  const displayPostRecordingQuestions = postRecordingQuestions;

  const handlePostQuestionEditSave = async (data: { text: string; answer_type: string }) => {
    const targetId = postQuestionEdit?.id ?? `draft-${crypto.randomUUID()}`;
    setPostRecordingQuestions((prev) => {
      if (postQuestionEdit) {
        return prev.map((q) =>
          q.id === postQuestionEdit.id ? { ...q, text: data.text, answer_type: data.answer_type } : q
        );
      }
      return [...prev, { id: targetId, text: data.text, answer_type: data.answer_type }];
    });
    setQueuedPostQuestionDeletes((prev) => prev.filter((qid) => qid !== targetId));
    setQueuedPostQuestionUpserts((prev) => {
      const next = prev.filter((q) => q.id !== targetId);
      next.push({ id: targetId, text: data.text, answer_type: data.answer_type });
      return next;
    });
    toast.success("Queued. Click Save all changes.");
  };

  const deletePostRecordingQuestion = (questionId: string) => {
    setPostRecordingQuestions((prev) => prev.filter((q) => q.id !== questionId));
    setQueuedPostQuestionUpserts((prev) => prev.filter((q) => q.id !== questionId));
    if (!questionId.startsWith("draft-")) {
      setQueuedPostQuestionDeletes((prev) => (prev.includes(questionId) ? prev : [...prev, questionId]));
    }
    toast.success("Queued. Click Save all changes.");
  };

  const deleteStudentTaskDraft = (taskId: string) => {
    setStudentTasks((prev) => prev.filter((t) => t.id !== taskId));
    setQueuedStudentTaskUpserts((prev) => prev.filter((q) => q.id !== taskId));
    if (!taskId.startsWith("draft-")) {
      setQueuedStudentTaskDeletes((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
    }
    toast.success("Queued. Click Save all changes.");
  };

  // Focus tasks (canonical). Tasks and post-recording mirror this pattern.
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
  const displayFocusTasks = pendingFocusIds !== null
    ? pendingFocusIds
        .map((pid) => focusPoolTasks.find((p) => p.id === pid))
        .filter((x): x is FocusTaskPoolItem => x != null)
    : [...focusTasks].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const handleFocusConfirm = (selectedIds: string[]) => {
    setModalFocus(false);
    const ordered = focusPoolTasks.map((p) => p.id).filter((pid) => selectedIds.includes(pid));
    setPendingFocusIds(ordered);
  };
  const handleFocusCreate = async (text: string): Promise<PoolItem | void> => {
    try {
      const res = await adminApi.createFocusTaskPoolItem({ text, order_index: 0, max_performance_score: 1 });
      const item = res.task_focus;
      if (!item?.id || item.text == null) {
        toast.error("Unexpected response from server");
        return;
      }
      setFocusPoolTasks((prev) => [...prev, item]);
      return {
        id: item.id,
        label: item.text,
        subLabel: item.max_performance_score != null ? `Max score: ${item.max_performance_score}` : undefined,
      };
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed to add to pool");
      throw e;
    }
  };
  const handleFocusEditModalSave = async (data: { text: string; max_performance_score: number }) => {
    const targetId = focusEditTask?.id ?? `draft-${crypto.randomUUID()}`;
    const orderIndex = focusEditTask?.order_index ?? focusTasks.length;
    setFocusTasks((prev) => {
      if (focusEditTask) {
        return prev.map((t) =>
          t.id === focusEditTask.id
            ? { ...t, text: data.text, max_performance_score: data.max_performance_score, order_index: orderIndex }
            : t
        );
      }
      return [
        ...prev,
        {
          id: targetId,
          user_id: id,
          text: data.text,
          order_index: orderIndex,
          max_performance_score: data.max_performance_score,
        },
      ];
    });
    setQueuedFocusDeletes((prev) => prev.filter((qid) => qid !== targetId));
    setQueuedFocusUpserts((prev) => {
      const next = prev.filter((q) => q.id !== targetId);
      next.push({
        id: targetId,
        text: data.text,
        max_performance_score: data.max_performance_score,
        order_index: orderIndex,
      });
      return next;
    });
    toast.success("Queued. Click Save all changes.");
  };
  const deleteFocusTask = (taskId: string) => {
    setFocusTasks((prev) => prev.filter((t) => t.id !== taskId));
    setQueuedFocusUpserts((prev) => prev.filter((q) => q.id !== taskId));
    if (!taskId.startsWith("draft-")) {
      setQueuedFocusDeletes((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
    }
    toast.success("Queued. Click Save all changes.");
  };

  const assignedQuestions = postRecordingQuestions;

  // Backend now returns delivered reports only; render that list directly.
  const reports = (profile?.sessions ?? [])
    .sort((a, b) => (b.completed_at || b.created_at || "").localeCompare(a.completed_at || a.created_at || ""))
    .slice(0, 20);

  useEffect(() => {
    if (!id || reports.length === 0) return;
    reports.forEach((session) => {
      if (adminReportPreviews[session.id] !== undefined || adminReportPreviewLoading[session.id]) return;
      setAdminReportPreviewLoading((prev) => ({ ...prev, [session.id]: true }));
      adminApi
        .getStudentSessionReport(id, session.id)
        .then((report) => {
          setAdminReportPreviews((prev) => ({ ...prev, [session.id]: toCompactReportPreview(report) }));
        })
        .catch(() => {
          setAdminReportPreviews((prev) => ({ ...prev, [session.id]: null }));
        })
        .finally(() => {
          setAdminReportPreviewLoading((prev) => ({ ...prev, [session.id]: false }));
        });
    });
  }, [id, reports, adminReportPreviews, adminReportPreviewLoading]);

  useEffect(() => {
    if (reports.length === 0) return;
    const id = setInterval(() => {
      setAdminReportPreviews((prev) => {
        const next = { ...prev };
        let changed = false;
        reports.forEach((session) => {
          if (next[session.id] === null) {
            delete next[session.id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 8000);
    return () => clearInterval(id);
  }, [reports]);

  /** Metrics are batched; onSave only updates local state. Persisted on "Save all changes". */
  const setMetricsDraft = (data: {
    metric_question_1: string;
    metric_question_2: string;
    metric_question_3: string;
  }) => setUserMetricQuestions(data);

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
        <h1 className="mt-2 text-3xl font-bold">{studentName.trim() || profile.email || profile.user_id}</h1>
        {profile.email ? <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p> : null}
      </div>

      <SectionCard
        title="Student Details"
        description="Basic student fields managed by admin."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Name</label>
            <Input
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Student name"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Price per live lesson (USD)</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={pricePerLiveLessonUsd}
              onChange={(e) => setPricePerLiveLessonUsd(e.target.value)}
              placeholder="e.g. 49.99"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Credits</label>
            <Input
              type="number"
              min={0}
              step={1}
              value={creditsValue}
              onChange={(e) => setCreditsValue(e.target.value)}
              placeholder="e.g. 5"
              disabled={saving}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Current unlocked level</label>
            <Input
              type="number"
              min={1}
              step={1}
              value={currentRealtimeLevel}
              onChange={(e) => setCurrentRealtimeLevel(e.target.value)}
              placeholder="e.g. 1"
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Current unlocked step</label>
            <Input
              type="number"
              min={1}
              step={1}
              value={currentRealtimeStep}
              onChange={(e) => setCurrentRealtimeStep(e.target.value)}
              placeholder="e.g. 1"
              disabled={saving}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Latest session metrics"
        description="Speech metrics from the most recent completed sniper session."
      >
        <LatestSessionMetrics sessions={profile.sessions} />
      </SectionCard>

      {/* Homework Configuration */}
      <SectionCard
        title="Homework Configuration"
        description="Select items from the global pool or create new ones. New items are added to the pool for reuse."
      >
        <div className="space-y-6">
          {/* Message to the student — shown in assignment email */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Message</label>
            <textarea
              value={assignmentVideoDescription}
              onChange={(e) => setAssignmentVideoDescription(e.target.value)}
              placeholder="content of the message"
              rows={4}
              maxLength={2000}
              className="w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Max 2000 characters. Shown in the assignment email when you send homework.</p>
          </div>

          {/* Tasks (student / pool) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Task</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStudentTaskEdit(null);
                    setStudentTaskEditOpen(true);
                  }}
                >
                  + Add
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setModalTasksPool(true)}>
                  Manage list
                </Button>
              </div>
            </div>
            {studentTasksError && (
              <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                {studentTasksError}
              </p>
            )}
            <div className="min-h-[6rem] rounded-md border border-border bg-muted/30 p-3">
            <ul className="space-y-2">
              {displayStudentTasks.map((t) => (
                <li key={t.id} className="group flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <div
                    className={adminRichTextContentClassName}
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(t.text ?? "") }}
                  />
                  {"pool_task_id" in t && t.pool_task_id ? (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatTaskTemplateLabel(
                        tasksPoolItems.find((row) => row.id === t.pool_task_id) ?? {}
                      )}
                    </span>
                  ) : null}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {pendingTasksPoolIds === null && "pool_task_id" in t && (
                      <button
                        type="button"
                        onClick={() => {
                          setStudentTaskEdit(t as StudentTask);
                          setStudentTaskEditOpen(true);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        pendingTasksPoolIds !== null
                          ? setPendingTasksPoolIds((prev) => (prev ?? []).filter((pid) => pid !== t.id))
                          : deleteStudentTaskDraft(t.id)
                      }
                      disabled={saving}
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                      aria-label={pendingTasksPoolIds !== null ? "Remove from list" : "Delete"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {displayStudentTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No tasks. Click + Add to create one or Manage list to choose from the pool.</p>
            )}
            </div>
          </div>

          {/* Similar students — shown once a task is chosen */}
          {displayStudentTasks.length > 0 &&
            (profile.similar_students_by_wpm?.length ?? 0) > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Also send to similar students:
              </p>
              <div className="space-y-1.5">
                {(profile.similar_students_by_wpm ?? []).map((s) => (
                  <label
                    key={s.user_id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-2.5 cursor-pointer hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSimilarIds.has(s.user_id)}
                      onChange={() => toggleSimilarStudent(s.user_id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm flex-1">{s.name || s.email || s.user_id}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{Math.round(s.wpm)} WPM</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {false && (
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
            <div className="min-h-[6rem] rounded-md border border-border bg-muted/30 p-3">
            <ul className="space-y-2">
              {displayFocusTasks.map((t) => (
                <li key={t.id} className="group flex flex-wrap items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">{t.text}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Max score: {t.max_performance_score ?? 1}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {pendingFocusIds === null && "order_index" in t && (
                      <button
                        type="button"
                        onClick={() => {
                          setFocusEditTask(t as FocusTask);
                          setFocusEditOpen(true);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        pendingFocusIds !== null
                          ? setPendingFocusIds((prev) => (prev ?? []).filter((pid) => pid !== t.id))
                          : deleteFocusTask(t.id)
                      }
                      disabled={saving}
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                      aria-label={pendingFocusIds !== null ? "Remove from list" : "Delete"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {displayFocusTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">No focus tasks. Click + Add to create one or Manage list to choose from the pool.</p>
            )}
            </div>
          </div>
          )}

          {false && (
            <MetricsSection
              metric_question_1={userMetricQuestions.metric_question_1}
              metric_question_2={userMetricQuestions.metric_question_2}
              metric_question_3={userMetricQuestions.metric_question_3}
              onSave={setMetricsDraft}
              saving={saving}
            />
          )}

          <Button type="button" onClick={sendAssignment} className="gap-2">
            <Send className="h-4 w-4" aria-hidden />
            {selectedSimilarIds.size > 0
              ? `Send Homework to ${1 + selectedSimilarIds.size} students`
              : "Send Homework"}
          </Button>
        </div>
      </SectionCard>

      {/* AI Coach Assistant */}
      <SectionCard
        title="AI Coach Assistant"
        description="Ask AI for homework messages, task suggestions, and video scripts."
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <textarea
              value={aiMessage}
              onChange={(e) => setAiMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  sendAiMessage();
                }
              }}
              placeholder="Describe what you need (homework message, task idea, video script)…"
              rows={3}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
              disabled={aiLoading}
            />
            <Button
              type="button"
              onClick={sendAiMessage}
              disabled={aiLoading || !aiMessage.trim()}
              className="self-end gap-2"
            >
              {aiLoading ? "Thinking…" : "Ask AI"}
            </Button>
          </div>

          {aiSuggestion && (
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
              {aiSuggestion.homework_message && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-700 dark:bg-orange-950/30">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-orange-600 dark:text-orange-400">Homework Message</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{aiSuggestion.homework_message}</p>
                </div>
              )}
              {aiSuggestion.task_suggestion && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-700 dark:bg-blue-950/30">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">Task Suggestion</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{aiSuggestion.task_suggestion}</p>
                </div>
              )}
              {aiSuggestion.video_script && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950/30">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Video Script</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{aiSuggestion.video_script}</p>
                </div>
              )}
            </div>
          )}

          {/* History toggle */}
          <div>
            <button
              type="button"
              onClick={() => setAiHistoryOpen(!aiHistoryOpen)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              History ({aiHistory.length})
            </button>

            {aiHistoryOpen && aiHistory.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await adminApi.clearCoachSuggestionHistory(id);
                        setAiHistory([]);
                        setAiSuggestion(null);
                        toast.success("History cleared");
                      } catch (e) {
                        toast.error((e as Error)?.message ?? "Failed to clear history");
                      }
                    }}
                    className="text-xs text-destructive hover:underline"
                  >
                    Clear history
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2 rounded-md border border-border p-3">
                  {aiHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`rounded-md px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "ml-8 bg-muted/40 text-right"
                          : "mr-8 border border-border bg-background"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Student Learning Profile — changes saved with "Save all changes" below */}
      <SectionCard
        title="Student Learning Profile"
        description="Goals, motivation, coach notes, and all measured learning parameters."
      >
        <label className="block text-sm font-medium mb-2">Context</label>
        <textarea
          value={contextDraft}
          onChange={(e) => setContextDraft(e.target.value)}
          placeholder="Enter student context, goals, motivation, personality traits, and any notes for coaching..."
          rows={8}
          className="w-full rounded-md border border-input bg-muted/50 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />

        {/* Collapsible full data */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setLearningDataOpen((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${learningDataOpen ? "rotate-90" : ""}`} />
            {learningDataOpen ? "Hide" : "Show"} all tracked data
          </button>

          {learningDataOpen && (() => {
            const sp = profile.speaker_profile;
            const sn = studentSniperProgress;
            const mem = profile.coaching_memory;
            const allSessions = profile.sessions ?? [];

            const fmt = (v: number | null | undefined, decimals = 2) =>
              v != null ? v.toFixed(decimals) : null;
            const pct = (v: number | null | undefined) =>
              v != null ? `${(v * 100).toFixed(0)}%` : null;

            const Row = ({ label, value }: { label: string; value: string | number | null | undefined }) =>
              value != null && value !== "" ? (
                <div className="flex gap-3 py-1.5 border-b border-border/40 last:border-0">
                  <span className="w-52 shrink-0 text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs break-words min-w-0">{String(value)}</span>
                </div>
              ) : null;

            const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{title}</p>
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-1">{children}</div>
              </div>
            );

            const Empty = ({ msg }: { msg: string }) => (
              <p className="text-xs text-muted-foreground py-2">{msg}</p>
            );

            return (
              <div className="mt-4">

                <Section title="Student Profile — Speaker & Personality">
                  <Row label="Main goal" value={sp?.main_goal} />
                  <Row label="Motivation" value={sp?.motivation} />
                  <Row label="Strong points" value={sp?.strong_points} />
                  <Row label="Weak points" value={sp?.weak_points} />
                  <Row label="Charismatic traits" value={sp?.charismatic_traits} />
                  <Row label="Hobbies / interests" value={sp?.hobbies_interests} />
                  <Row label="Personality type" value={sp?.personality_type} />
                  <Row label="Coach notes" value={sp?.coach_notes} />
                  {!sp && <Empty msg="No speaker profile yet." />}
                </Section>

                <Section title="Training Progression — Sniper Baselines">
                  <Row label="Level" value={sn?.realtime_level} />
                  <Row label="Step" value={sn?.realtime_step} />
                  <Row label="Session count" value={sn?.session_count} />
                  <Row label="Sessions w/ energy" value={sn?.sessions_with_energy_count} />
                  <Row label="Sessions w/ pitch" value={sn?.sessions_with_pitch_count} />
                  <Row label="Pitch baseline (st)" value={fmt(sn?.realtime_pitch_baseline_st)} />
                  <Row label="Baseline WPM" value={fmt(sn?.baseline_wpm, 1)} />
                  <Row label="Baseline pause (ms)" value={fmt(sn?.baseline_pause_ms, 0)} />
                  <Row label="Baseline dynamic (dB)" value={fmt(sn?.baseline_dynamic_db)} />
                  <Row label="Baseline emphasis/min" value={fmt(sn?.baseline_emphasis_per_min)} />
                  <Row label="Baseline energy ratio" value={fmt(sn?.baseline_energy_ratio, 3)} />
                  <Row label="Baseline fatigue (s)" value={fmt(sn?.baseline_fatigue_sec, 1)} />
                  <Row label="Profile updated" value={sn?.updated_at ? new Date(sn.updated_at).toLocaleString() : null} />
                  {!sn && <Empty msg="No sniper profile yet." />}
                </Section>

                <Section title="Coaching Memory & Momentum">
                  <Row label="Last 5 scores" value={mem?.last_5_scores?.length ? mem.last_5_scores.map((v) => pct(v)).join(" → ") : null} />
                  <Row label="Recent focus task IDs" value={mem?.recent_focus_task_ids?.length ? mem.recent_focus_task_ids.join(", ") : null} />
                  <Row label="Updated" value={mem?.updated_at ? new Date(mem.updated_at).toLocaleString() : null} />
                  {!mem && <Empty msg="No coaching memory yet." />}
                </Section>

                <Section title="Performance, Scoring & Speech — Per Session">
                  {allSessions.length === 0 ? (
                    <Empty msg="No sessions yet." />
                  ) : (
                    <div className="overflow-x-auto -mx-4 px-4">
                      <table className="w-full text-xs mt-2 mb-2 min-w-[860px]">
                        <thead>
                          <tr className="text-muted-foreground border-b border-border">
                            <th className="text-left py-1.5 pr-3 font-medium">Date</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Score</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Task</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Q1</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Q2</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Q3</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Grade</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Stage</th>
                            <th className="text-right py-1.5 pr-3 font-medium">WPM</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Fillers</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Dur (s)</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Pause (ms)</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Dynamic (dB)</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Pitch (st)</th>
                            <th className="text-right py-1.5 pr-3 font-medium">Energy</th>
                            <th className="text-right py-1.5 pr-3 font-medium">ML quality</th>
                            <th className="text-right py-1.5 font-medium">Self rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allSessions.map((s) => {
                            const sm = s.sniper_metrics;
                            const rv = s.review;
                            const rp = s.recording_preview;
                            const rowWpm = resolveSessionRowWpm(s as unknown as Record<string, unknown>);
                            return (
                              <tr key={s.id} className="border-t border-border/30 hover:bg-muted/20">
                                <td className="py-1.5 pr-3 whitespace-nowrap">{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{pct(s.score) ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{pct(s.task_score) ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{pct(s.question_1_score) ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{pct(s.question_2_score) ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{pct(s.question_3_score) ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{s.report_grade != null ? `${s.report_grade}/10` : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{sm?.stage_score != null ? sm.stage_score.toFixed(1) : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{rowWpm != null ? rowWpm.toFixed(0) : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{rp?.filler_words_count?.total != null ? rp.filler_words_count.total : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{rp?.duration_ms != null ? (rp.duration_ms / 1000).toFixed(0) : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{sm?.pause_ms != null ? sm.pause_ms.toFixed(0) : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{sm?.dynamic_db != null ? sm.dynamic_db.toFixed(1) : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{sm?.pitch_center_st != null ? sm.pitch_center_st.toFixed(1) : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{sm?.energy_ratio != null ? sm.energy_ratio.toFixed(3) : "—"}</td>
                                <td className="py-1.5 pr-3 text-right">{rv?.overall_quality ?? "—"}</td>
                                <td className="py-1.5 text-right">{sm?.student_rating_1_10 ?? "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>

              </div>
            );
          })()}
        </div>
      </SectionCard>

      {/* Reports History */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Reports History</h2>
        <div className="space-y-3">
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            reports.map((s) => (
              <CompactReportPreviewCard
                key={s.id}
                title={`Report — ${s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}`}
                preview={adminReportPreviews[s.id] ?? null}
                loading={!!adminReportPreviewLoading[s.id]}
                onOpen={() => setReportModalSession(s)}
              />
            ))
          )}
        </div>
      </div>

      {/* Save all batched changes — at the end of the page */}
      <div className="sticky bottom-0 flex justify-end border-t bg-card/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <Button type="button" onClick={saveAllChanges} disabled={saving} size="lg">
          {saving ? "Saving…" : "Save all changes"}
        </Button>
      </div>

      {/* Modals */}
      <StudentTaskEditModal
        open={studentTaskEditOpen}
        onOpenChange={(open) => {
          setStudentTaskEditOpen(open);
          if (!open) setStudentTaskEdit(null);
        }}
        task={studentTaskEdit}
        onSave={handleStudentTaskEditSave}
        saving={saving}
      />
      <SelectFromPoolModal
        open={modalTasksPool}
        onOpenChange={setModalTasksPool}
        title="Select Tasks"
        pool={tasksPoolModalItems}
        selectedIds={pendingTasksPoolIds ?? tasksPoolSelectedIds}
        onConfirm={handleTasksPoolConfirm}
        poolLoading={tasksPoolLoading}
        allowCreate
        onCreateNew={requestCreatePoolTemplate}
      />
      <CreateTaskTemplateModal
        open={createTemplateModalOpen}
        onOpenChange={handleCreateTemplateModalOpenChange}
        initialText={createTemplateText}
        onConfirm={handleCreateTemplateModalConfirm}
        saving={createTemplateSaving}
      />
      {false && (
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
      )}
      {false && (
      <SelectFromPoolModal
        open={modalFocus}
        onOpenChange={setModalFocus}
        title="Select Focus Tasks"
        pool={focusPool}
        selectedIds={pendingFocusIds ?? focusSelectedIds}
        onConfirm={handleFocusConfirm}
        allowCreate
        onCreateNew={handleFocusCreate}
        poolLoading={focusPoolLoading}
      />
      )}
      {false && (
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
      )}
      <ReportDetailModal
        open={!!reportModalSession}
        onOpenChange={(open) => {
          if (!open) setReportModalSession(null);
        }}
        userId={id}
        studentEmail={profile?.email ?? null}
        session={reportModalSession}
        onGradeSaved={load}
      />
    </div>
  );
}
