"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, PencilLine, Send, Sparkles, Waves } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AcousticDojoWorkspace from "@/components/admin/dojo/AcousticDojoWorkspace";
import { stripHtmlToText } from "@/lib/sanitizeRichHtml";
import {
  adminApi,
  type CopilotCohortStack,
  type CopilotStudentDraft,
  type CopilotStudentQueueItem,
  type StudentTask,
  type TasksPoolItem,
} from "@/lib/api/admin-client";

type QueueFilter = "all" | "pending" | "audit" | "done";

const LEARNING_ARCHETYPES = [
  {
    key: "Perfectionist-Avoider",
    subtitle: "Uses hedging language, WPM drops mid-sentence, avoids assertive statements",
  },
  {
    key: "Anxious-Rusher",
    subtitle: "High WPM under pressure, filler spikes, shortened pauses between ideas",
  },
  {
    key: "Monotone-Expert",
    subtitle: "Strong content but flat delivery, narrow pitch range, low emotion variance",
  },
  {
    key: "Confident-Unfocused",
    subtitle: "High energy but scattered structure, topic drift, weak transitions",
  },
] as const;

function formatName(student: CopilotStudentQueueItem): string {
  return (
    student.profile?.name?.trim() ||
    student.profile?.email?.trim() ||
    student.student_id.slice(0, 10)
  );
}

function formatSession(student: CopilotStudentQueueItem): string {
  const raw = student.session_id ?? "";
  if (!raw) return "Session #—";
  const compact = raw.split("-")[0];
  return `Session #${compact}`;
}

function queueStateDot(state: CopilotStudentQueueItem["state"]): string {
  if (state === "Sent") return "bg-emerald-500";
  if (state === "Ready") return "bg-amber-500";
  return "bg-rose-500";
}

function queueRecency(student: CopilotStudentQueueItem): string {
  const raw =
    student.updated_at ??
    student.completed_at ??
    student.profile?.completed_at ??
    null;
  if (!raw) return "recently";
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return "recently";
  const diffMs = Date.now() - when.getTime();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (diffMs < hour) return "just now";
  if (diffMs < day) return `${Math.max(1, Math.round(diffMs / hour))}h ago`;
  if (diffMs < 7 * day) return `${Math.max(1, Math.round(diffMs / day))}d ago`;
  return when.toLocaleDateString();
}

function parseSessionNumber(sessionId?: string | null): number | null {
  if (!sessionId) return null;
  const match = sessionId.match(/\d+/);
  if (!match) return null;
  const numeric = Number.parseInt(match[0], 10);
  return Number.isFinite(numeric) ? numeric : null;
}

function extractConfidencePercent(input: string): number | null {
  const match = input.match(/(\d{1,3})\s*%/);
  if (!match) return null;
  const numeric = Number.parseInt(match[1], 10);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, numeric));
}

function queueStateBadge(state: CopilotStudentQueueItem["state"]): string {
  if (state === "Sent") return "bg-emerald-100 text-emerald-700";
  if (state === "Ready") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function toEvidence(insight: string, fallback: string): string[] {
  const text = insight.trim() || fallback.trim();
  if (!text) return [];
  return text
    .split(/[.\n]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function inferArchetype(value: string): string {
  const lower = value.toLowerCase();
  const found = LEARNING_ARCHETYPES.find((item) =>
    lower.includes(item.key.toLowerCase())
  );
  return found?.key ?? LEARNING_ARCHETYPES[0].key;
}

function reviewerScoreFromMetadata(metadata: CopilotStudentDraft["metadata"]): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const raw = (metadata as Record<string, unknown>).reviewer_score;
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string") return raw;
  return "";
}

function parseOptionalPercent(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mergeMetadataReviewerScore(
  existing: CopilotStudentDraft["metadata"],
  reviewerScore: number | null
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (reviewerScore == null) {
    delete base.reviewer_score;
  } else {
    base.reviewer_score = reviewerScore;
  }
  return base;
}

function formatAiBaselineNumber(label: string, ai: number | null | undefined, current: number | null | undefined): string | null {
  if (ai == null || !Number.isFinite(ai)) return null;
  if (current != null && Number.isFinite(current) && current !== ai) {
    return `AI suggested ${label} ${ai} (you edited: ${current})`;
  }
  return `AI suggested ${label} ${ai}`;
}

function formatAiBaselineText(label: string, ai: string | null | undefined, current: string | null | undefined): string | null {
  const aiTrim = (ai ?? "").trim();
  if (!aiTrim) return null;
  const curTrim = (current ?? "").trim();
  if (curTrim && curTrim !== aiTrim) {
    return `AI ${label} differs from your edit`;
  }
  return `AI ${label}`;
}

export default function TrainingStudioWorkspace() {
  const [pipelineView, setPipelineView] = useState<"agentic" | "voice">("agentic");
  const [cohorts, setCohorts] = useState<CopilotCohortStack[]>([]);
  const [students, setStudents] = useState<CopilotStudentQueueItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<CopilotStudentQueueItem | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<CopilotStudentDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [selectedArchetype, setSelectedArchetype] = useState<string>(LEARNING_ARCHETYPES[0].key);

  const [editingInsight, setEditingInsight] = useState(false);
  const [editingMessage, setEditingMessage] = useState(false);
  const [insightValue, setInsightValue] = useState("");
  const [taskValue, setTaskValue] = useState("");
  const [messageValue, setMessageValue] = useState("");
  const [scriptValue, setScriptValue] = useState("");
  const [editingScript, setEditingScript] = useState(false);
  const [gradeInput, setGradeInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [reviewerScoreInput, setReviewerScoreInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [sendingAssignment, setSendingAssignment] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [loadingTaskOptions, setLoadingTaskOptions] = useState(false);
  const [taskOptions, setTaskOptions] = useState<Array<{ id: string; text: string; source: "student" | "pool" }>>([]);
  const [annotationChips, setAnnotationChips] = useState<Array<{ chip_key: string; label: string; section?: string | null }>>([]);
  const [selectedReasonChips, setSelectedReasonChips] = useState<string[]>([]);
  const [reasonChipCustom, setReasonChipCustom] = useState("");
  const [savingProfileClassification, setSavingProfileClassification] = useState(false);

  const loadCohorts = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const response = await adminApi.getCopilotCohorts({ limit: 50, offset: 0 });
      setCohorts(response.cohorts ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load cohorts");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  const loadStudents = useCallback(async (cohortIds: string[]) => {
    if (cohortIds.length === 0) {
      setStudents([]);
      setSelectedStudent(null);
      return;
    }
    setLoadingQueue(true);
    try {
      const responses = await Promise.all(
        cohortIds.map((cohortId) =>
          adminApi.getCopilotCohortStudents(cohortId, {
            limit: 100,
            offset: 0,
          })
        )
      );
      const deduped = new Map<string, CopilotStudentQueueItem>();
      for (const response of responses) {
        for (const student of response.students ?? []) {
          const key = `${student.student_id}:${student.session_id ?? ""}`;
          if (!deduped.has(key)) deduped.set(key, student);
        }
      }
      const list = Array.from(deduped.values());
      setStudents(list);
      setSelectedStudent((previous) => {
        if (!previous) return list[0] ?? null;
        return list.find((item) => item.student_id === previous.student_id) ?? list[0] ?? null;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load students");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  const loadDraft = useCallback(async (student: CopilotStudentQueueItem | null) => {
    if (!student) {
      setSelectedDraft(null);
      return;
    }
    setLoading(true);
    try {
      const response = await adminApi.getCopilotStudentDrafts(student.student_id, student.session_id ? { session_id: student.session_id } : undefined);
      const draft = response.drafts?.[0] ?? null;
      setSelectedDraft(draft);
      setInsightValue(draft?.corrected_insight ?? draft?.ai_insight ?? "");
      setTaskValue(draft?.task_draft ?? draft?.ai_task_suggestion ?? "");
      setMessageValue(draft?.email_draft ?? draft?.ai_email_draft ?? "");
      setScriptValue(draft?.script_draft ?? draft?.ai_script_draft ?? "");
      setGradeInput(
        typeof draft?.grade_draft === "number" && Number.isFinite(draft.grade_draft)
          ? String(draft.grade_draft)
          : typeof draft?.ai_grade_draft === "number" && Number.isFinite(draft.ai_grade_draft)
            ? String(draft.ai_grade_draft)
            : ""
      );
      setCommentInput(draft?.comment_draft ?? draft?.ai_comment_draft ?? "");
      setReviewerScoreInput(reviewerScoreFromMetadata(draft?.metadata));
      setSelectedArchetype(
        student.profile?.behavioral_profile?.trim() ||
          inferArchetype(
            `${draft?.ai_insight ?? ""} ${student.profile?.behavioral_profile_justification ?? student.profile?.justification ?? ""}`
          )
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load student draft");
      setSelectedDraft(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCohorts();
  }, [loadCohorts]);

  useEffect(() => {
    const cohortIds = cohorts.map((cohort) => cohort.id).filter(Boolean);
    if (cohortIds.length === 0) {
      setStudents([]);
      setSelectedStudent(null);
      return;
    }
    void loadStudents(cohortIds);
  }, [cohorts, loadStudents]);

  useEffect(() => {
    if (!selectedStudent) {
      void loadDraft(null);
      return;
    }
    void loadDraft(selectedStudent);
  }, [loadDraft, selectedStudent?.student_id, selectedStudent?.session_id]);

  useEffect(() => {
    adminApi
      .getCopilotAnnotationChips()
      .then((response) => {
        const chips = (response.chips ?? []).filter((chip) => chip?.chip_key && chip?.label);
        setAnnotationChips(chips);
      })
      .catch(() => {
        setAnnotationChips([]);
      });
  }, []);

  useEffect(() => {
    setSelectedReasonChips([]);
    setReasonChipCustom("");
  }, [selectedStudent?.student_id, selectedStudent?.session_id]);

  const sortedStudents = useMemo(() => {
    const statusOrder: Record<CopilotStudentQueueItem["state"], number> = {
      Draft: 0,
      Ready: 1,
      Sent: 2,
    };
    return [...students].sort((a, b) => {
      const stateDiff = statusOrder[a.state] - statusOrder[b.state];
      if (stateDiff !== 0) return stateDiff;
      const queueA = a.queue_position ?? Number.MAX_SAFE_INTEGER;
      const queueB = b.queue_position ?? Number.MAX_SAFE_INTEGER;
      if (queueA !== queueB) return queueA - queueB;
      return formatName(a).localeCompare(formatName(b));
    });
  }, [students]);

  const queueCounts = useMemo(() => {
    const all = sortedStudents.length;
    const pending = sortedStudents.filter((item) => item.state === "Draft").length;
    const audit = sortedStudents.filter((item) => item.state === "Ready").length;
    const done = sortedStudents.filter((item) => item.state === "Sent").length;
    return { all, pending, audit, done };
  }, [sortedStudents]);

  const filteredStudents = useMemo(() => {
    if (queueFilter === "all") return sortedStudents;
    if (queueFilter === "pending") return sortedStudents.filter((item) => item.state === "Draft");
    if (queueFilter === "audit") return sortedStudents.filter((item) => item.state === "Ready");
    return sortedStudents.filter((item) => item.state === "Sent");
  }, [queueFilter, sortedStudents]);

  const currentInsight = selectedDraft?.ai_insight ?? selectedStudent?.profile?.justification ?? "";
  const evidence = useMemo(
    () => toEvidence(currentInsight, selectedStudent?.profile?.justification ?? ""),
    [currentInsight, selectedStudent?.profile?.justification]
  );
  const confidencePercent = useMemo(() => {
    return (
      extractConfidencePercent(
        selectedStudent?.profile?.behavioral_profile_justification ??
          selectedStudent?.profile?.justification ??
          ""
      ) ?? 82
    );
  }, [selectedStudent?.profile?.behavioral_profile_justification, selectedStudent?.profile?.justification]);
  const reviewSessionLabel = useMemo(() => {
    if (!selectedStudent) return "Review";
    const count = selectedStudent.profile?.session_count ?? parseSessionNumber(selectedStudent.session_id);
    if (count == null) return "Review";
    return `Review — Session ${count}`;
  }, [selectedStudent]);
  const planSessionLabel = useMemo(() => {
    if (!selectedStudent) return "Plan";
    const count = selectedStudent.profile?.session_count ?? parseSessionNumber(selectedStudent.session_id);
    if (count == null) return "Plan";
    return `Plan — Session ${count + 1}`;
  }, [selectedStudent]);

  const displayScorePercent = useMemo(() => {
    const fromDraft = selectedDraft?.score_for_display;
    if (typeof fromDraft === "number" && Number.isFinite(fromDraft)) return fromDraft;
    const fromProfile = selectedStudent?.profile?.canonical_score_for_display;
    if (typeof fromProfile === "number" && Number.isFinite(fromProfile)) return fromProfile;
    return null;
  }, [selectedDraft?.score_for_display, selectedStudent?.profile?.canonical_score_for_display]);

  const parsedGradeInput = useMemo(() => {
    const t = gradeInput.trim();
    if (!t) return null;
    const n = Number.parseFloat(t);
    return Number.isNaN(n) ? null : n;
  }, [gradeInput]);

  const gradeAiHint = useMemo(
    () => formatAiBaselineNumber("grade", selectedDraft?.ai_grade_draft, parsedGradeInput ?? selectedDraft?.grade_draft ?? null),
    [parsedGradeInput, selectedDraft?.ai_grade_draft, selectedDraft?.grade_draft]
  );
  const commentAiHint = useMemo(
    () => formatAiBaselineText("comment", selectedDraft?.ai_comment_draft, commentInput),
    [commentInput, selectedDraft?.ai_comment_draft]
  );
  const emailAiHint = useMemo(
    () => formatAiBaselineText("email", selectedDraft?.ai_email_draft, messageValue),
    [messageValue, selectedDraft?.ai_email_draft]
  );
  const taskAiHint = useMemo(
    () =>
      formatAiBaselineText(
        "task",
        stripHtmlToText(selectedDraft?.ai_task_suggestion),
        stripHtmlToText(taskValue)
      ),
    [selectedDraft?.ai_task_suggestion, taskValue]
  );
  const insightSectionChips = useMemo(
    () => annotationChips.filter((chip) => (chip.section ?? "insight") === "insight"),
    [annotationChips]
  );
  const classificationSectionChips = useMemo(
    () => annotationChips.filter((chip) => chip.section === "classification"),
    [annotationChips]
  );

  const persistArchetype = useCallback(
    async (archetype: string) => {
      if (!selectedStudent) return;
      setSelectedArchetype(archetype);
      setSavingProfileClassification(true);
      try {
        await adminApi.patchStudentProfileClassification(selectedStudent.student_id, {
          behavioral_profile: archetype,
          ...(selectedReasonChips[0] ? { reason_chip: selectedReasonChips[0] } : {}),
          ...(reasonChipCustom.trim() ? { reason_chip_custom: reasonChipCustom.trim() } : {}),
        });
        toast.success("Learning profile saved.");
        await loadStudents(cohorts.map((cohort) => cohort.id));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save profile");
      } finally {
        setSavingProfileClassification(false);
      }
    },
    [cohorts, loadStudents, reasonChipCustom, selectedReasonChips, selectedStudent]
  );

  const saveScoreGradeComment = useCallback(async () => {
    if (!selectedStudent) return;
    const gradeTrim = gradeInput.trim();
    const grade =
      gradeTrim === "" ? null : Number.parseFloat(gradeTrim);
    if (grade != null && Number.isNaN(grade)) {
      toast.error("Grade must be a number.");
      return;
    }
    const reviewerScore = parseOptionalPercent(reviewerScoreInput);
    if (reviewerScoreInput.trim() !== "" && reviewerScore == null) {
      toast.error("Your score must be a number from 0 to 100.");
      return;
    }
    setSaving(true);
    try {
      await adminApi.updateCopilotStudentDrafts(selectedStudent.student_id, {
        session_id: selectedStudent.session_id ?? null,
        grade_draft: grade,
        comment_draft: commentInput.trim() || null,
        task_draft: taskValue.trim() || null,
        email_draft: messageValue.trim() || null,
        script_draft: scriptValue.trim() || null,
        metadata: mergeMetadataReviewerScore(selectedDraft?.metadata, reviewerScore),
        reason_chips: selectedReasonChips.map((chip_key) => ({ chip_key })),
        reason_chip_custom: reasonChipCustom.trim() || null,
      });
      toast.success("Score, grade, and comment saved for AI feedback.");
      await loadDraft(selectedStudent);
      await loadStudents(cohorts.map((cohort) => cohort.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save feedback");
    } finally {
      setSaving(false);
    }
  }, [
    cohorts,
    commentInput,
    gradeInput,
    loadDraft,
    loadStudents,
    messageValue,
    reviewerScoreInput,
    selectedDraft?.metadata,
    scriptValue,
    selectedReasonChips,
    reasonChipCustom,
    selectedStudent,
    taskValue,
  ]);

  const saveDraftFields = useCallback(async (patch: Partial<CopilotStudentDraft>) => {
    if (!selectedStudent) return;
    const gradeFromInput =
      gradeInput.trim() === ""
        ? null
        : Number.parseFloat(gradeInput.trim());
    const grade_draft =
      patch.grade_draft !== undefined
        ? patch.grade_draft
        : gradeFromInput != null && !Number.isNaN(gradeFromInput)
          ? gradeFromInput
          : selectedDraft?.grade_draft ?? null;
    const comment_draft =
      patch.comment_draft !== undefined
        ? patch.comment_draft
        : commentInput.trim() || null;
    const reviewerScore = parseOptionalPercent(reviewerScoreInput);
    setSaving(true);
    try {
      await adminApi.updateCopilotStudentDrafts(selectedStudent.student_id, {
        session_id: selectedStudent.session_id ?? null,
        grade_draft,
        comment_draft,
        task_draft: (patch.task_draft ?? taskValue) || null,
        email_draft: (patch.email_draft ?? messageValue) || null,
        script_draft:
          patch.script_draft !== undefined ? patch.script_draft : scriptValue.trim() || null,
        metadata: mergeMetadataReviewerScore(selectedDraft?.metadata, reviewerScore),
        reason_chips: selectedReasonChips.map((chip_key) => ({ chip_key })),
        reason_chip_custom: reasonChipCustom.trim() || null,
      });
      toast.success("Saved.");
      await loadDraft(selectedStudent);
      await loadStudents(cohorts.map((cohort) => cohort.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    cohorts,
    commentInput,
    gradeInput,
    loadDraft,
    loadStudents,
    messageValue,
    reviewerScoreInput,
    reasonChipCustom,
    selectedReasonChips,
    selectedDraft?.grade_draft,
    selectedDraft?.metadata,
    scriptValue,
    selectedDraft?.script_draft,
    selectedStudent,
    taskValue,
  ]);

  const saveInsight = useCallback(async () => {
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await adminApi.updateCopilotStudentAudit(selectedStudent.student_id, {
        session_id: selectedStudent.session_id ?? null,
        good_as_is: false,
        corrected_insight: insightValue.trim() || null,
        reason_chips: selectedReasonChips.map((chip_key) => ({ chip_key })),
        reason_chip_custom: reasonChipCustom.trim() || null,
      });
      toast.success("Insight updated.");
      await loadDraft(selectedStudent);
      setEditingInsight(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update insight");
    } finally {
      setSaving(false);
    }
  }, [insightValue, loadDraft, reasonChipCustom, selectedReasonChips, selectedStudent]);

  const approveAiForSelectedStudent = useCallback(async () => {
    if (!selectedStudent) return;
    if (selectedStudent.state === "Sent") {
      toast.message("This student is already marked sent.");
      return;
    }
    setApprovingAll(true);
    try {
      await adminApi.updateCopilotStudentAudit(selectedStudent.student_id, {
        session_id: selectedStudent.session_id ?? null,
        good_as_is: true,
        reason_chips: selectedReasonChips.length > 0 ? selectedReasonChips.map((chip_key) => ({ chip_key })) : undefined,
        reason_chip_custom: reasonChipCustom.trim() || null,
      });
      await adminApi.approveCopilotStudent(selectedStudent.student_id, {
        session_id: selectedStudent.session_id ?? undefined,
        draft_id: selectedDraft?.id,
        idempotency_key: crypto.randomUUID(),
      });
      toast.success("AI suggestions approved for this student.");
      await loadDraft(selectedStudent);
      await loadStudents(cohorts.map((cohort) => cohort.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approve failed");
    } finally {
      setApprovingAll(false);
    }
  }, [
    cohorts,
    loadDraft,
    loadStudents,
    reasonChipCustom,
    selectedDraft?.id,
    selectedReasonChips,
    selectedStudent,
  ]);

  const openTaskSwapModal = useCallback(async () => {
    if (!selectedStudent) return;
    setTaskModalOpen(true);
    setLoadingTaskOptions(true);
    try {
      const [studentTasks, poolTasks] = await Promise.all([
        adminApi.getStudentTasks(selectedStudent.student_id),
        adminApi.getTasksPool(),
      ]);
      const merged = new Map<string, { id: string; text: string; source: "student" | "pool" }>();
      for (const task of studentTasks as StudentTask[]) {
        if (!task.text?.trim()) continue;
        const key = `student:${task.id}`;
        merged.set(key, { id: task.id, text: task.text, source: "student" });
      }
      for (const task of poolTasks as TasksPoolItem[]) {
        if (!task.text?.trim()) continue;
        const key = `pool:${task.id}`;
        merged.set(key, { id: task.id, text: task.text, source: "pool" });
      }
      setTaskOptions(Array.from(merged.values()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load task options");
      setTaskOptions([]);
    } finally {
      setLoadingTaskOptions(false);
    }
  }, [selectedStudent]);

  const chooseTask = useCallback((taskText: string) => {
    setTaskValue(taskText);
    void saveDraftFields({ task_draft: taskText });
    setTaskModalOpen(false);
  }, [saveDraftFields]);

  const sendAssignment = useCallback(async () => {
    if (!selectedStudent) return;
    setSendingAssignment(true);
    try {
      await adminApi.sendAssignment(selectedStudent.student_id, {
        video_description: messageValue.trim() || undefined,
      });
      toast.success("Assignment sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send assignment");
    } finally {
      setSendingAssignment(false);
    }
  }, [messageValue, selectedStudent]);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-[42px] font-semibold tracking-[-0.01em]">Training Studio</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Review AI decisions, correct mistakes, and generate training data.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setPipelineView("agentic")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
            pipelineView === "agentic" ? "bg-background text-foreground" : "text-muted-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Agentic Pipeline
        </button>
        <button
          type="button"
          onClick={() => setPipelineView("voice")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium ${
            pipelineView === "voice" ? "bg-background text-foreground" : "text-muted-foreground"
          }`}
        >
          <Waves className="h-4 w-4" />
          Voice Pipeline
        </button>
      </div>

      {pipelineView === "voice" ? (
        <AcousticDojoWorkspace showHeader={false} />
      ) : (
      <>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden border-border/90 bg-card/95 p-0 shadow-sm">
          <div className="grid grid-cols-4 border-b bg-muted/35 text-center text-xs font-medium">
            <button className={`px-2 py-2 ${queueFilter === "all" ? "border-b-2 border-amber-500 text-foreground" : "text-muted-foreground"}`} onClick={() => setQueueFilter("all")} type="button">
              All ({queueCounts.all})
            </button>
            <button className={`px-2 py-2 ${queueFilter === "pending" ? "border-b-2 border-amber-500 text-foreground" : "text-muted-foreground"}`} onClick={() => setQueueFilter("pending")} type="button">
              Pending ({queueCounts.pending})
            </button>
            <button className={`px-2 py-2 ${queueFilter === "audit" ? "border-b-2 border-amber-500 text-foreground" : "text-muted-foreground"}`} onClick={() => setQueueFilter("audit")} type="button">
              Audit ({queueCounts.audit})
            </button>
            <button className={`px-2 py-2 ${queueFilter === "done" ? "border-b-2 border-amber-500 text-foreground" : "text-muted-foreground"}`} onClick={() => setQueueFilter("done")} type="button">
              Done ({queueCounts.done})
            </button>
          </div>
          <div className="max-h-[74vh] overflow-y-auto">
            {loadingQueue ? (
              <p className="p-3 text-base text-muted-foreground">Loading queue...</p>
            ) : filteredStudents.length === 0 ? (
              <p className="p-3 text-base text-muted-foreground">No students in this bucket.</p>
            ) : (
              filteredStudents.map((student) => {
                const active = selectedStudent?.student_id === student.student_id;
                return (
                  <button
                    key={`${student.student_id}-${student.session_id ?? "none"}`}
                    type="button"
                    onClick={() => setSelectedStudent(student)}
                    className={`w-full border-b px-3 py-3 text-left transition-colors ${
                      active ? "bg-amber-50/70 dark:bg-amber-950/20" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold leading-none">{formatName(student)}</p>
                      {student.state === "Sent" ? (
                        <span className="inline-grid h-5 w-5 place-items-center rounded bg-emerald-500 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className={`h-3 w-3 rounded-full ${queueStateDot(student.state)}`} />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <p>{formatSession(student)}</p>
                      <p>{queueRecency(student)}</p>
                    </div>
                    <p className="text-xs text-destructive/90">
                      {(student.draft_count ?? 0) > 0 ? `${student.draft_count ?? 0} items pending` : "No pending items"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-4xl font-semibold leading-none">
                {selectedStudent?.profile?.email || selectedStudent?.profile?.name || "Select a student"}
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                {selectedStudent
                  ? `${formatSession(selectedStudent)} · Score: ${displayScorePercent != null ? `${displayScorePercent}%` : "—"}`
                  : "No student selected"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedStudent ? (
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${queueStateBadge(selectedStudent.state)}`}>
                  {selectedStudent.state === "Draft" ? "Pending Review" : selectedStudent.state}
                </span>
              ) : null}
              <Button
                className="h-11 px-4 text-sm"
                onClick={() => void approveAiForSelectedStudent()}
                disabled={approvingAll || !selectedStudent || selectedStudent.state === "Sent"}
              >
                {approvingAll ? "Approving..." : "Accept AI for this student"}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{reviewSessionLabel}</p>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Score & Grade</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  {selectedStudent?.state === "Draft" ? "Pending" : selectedStudent?.state ?? "—"}
                </span>
                <Button
                  className="h-9 px-3 text-sm"
                  onClick={() => void saveScoreGradeComment()}
                  disabled={saving || !selectedStudent || loading}
                >
                  {saving ? "Saving..." : "Save feedback"}
                </Button>
              </div>
            </div>
            <div className="grid gap-6 px-5 py-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">AI score (read-only)</p>
                <p className="text-5xl font-semibold">
                  {displayScorePercent ?? "—"}
                  {displayScorePercent != null ? "%" : ""}
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="training-studio-reviewer-score" className="text-sm text-muted-foreground">
                  Your score (0–100, sent to AI)
                </label>
                <Input
                  id="training-studio-reviewer-score"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  placeholder="e.g. 72"
                  value={reviewerScoreInput}
                  onChange={(e) => setReviewerScoreInput(e.target.value)}
                  disabled={!selectedStudent || loading}
                  className="text-base"
                />
                <p className="text-xs text-muted-foreground">
                  Sent as draft metadata (reviewer score) when the API stores it.
                </p>
              </div>
            </div>
            <div className="grid gap-6 border-t px-5 py-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="training-studio-grade" className="text-sm text-muted-foreground">
                  Grade
                </label>
                <Input
                  id="training-studio-grade"
                  type="number"
                  step="any"
                  placeholder="e.g. 3.5"
                  value={gradeInput}
                  onChange={(e) => setGradeInput(e.target.value)}
                  disabled={!selectedStudent || loading}
                  className="text-base"
                />
                {gradeAiHint ? <p className="text-xs text-muted-foreground">{gradeAiHint}</p> : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="training-studio-comment" className="text-sm text-muted-foreground">
                  Comment (feedback to AI)
                </label>
                <textarea
                  id="training-studio-comment"
                  rows={4}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  disabled={!selectedStudent || loading}
                  placeholder="Corrections, context, or grading notes…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed"
                />
                {commentAiHint ? <p className="text-xs text-muted-foreground">{commentAiHint}</p> : null}
              </div>
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">AI Coach Insight</h3>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                Needs Review
              </span>
            </div>
            <div className="space-y-3 px-5 py-4">
              {editingInsight ? (
                <textarea
                  rows={4}
                  value={insightValue}
                  onChange={(event) => setInsightValue(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              ) : (
                <p className="rounded-lg border bg-muted/20 px-3 py-2 text-base leading-7">
                  {selectedDraft?.ai_insight || "No AI insight yet."}
                </p>
              )}
              <div className="space-y-2 rounded-lg border bg-muted/10 px-3 py-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Reason chips</p>
                <div className="flex flex-wrap gap-2">
                  {(insightSectionChips.length > 0 ? insightSectionChips : annotationChips).map((chip) => {
                    const selected = selectedReasonChips.includes(chip.chip_key);
                    return (
                      <button
                        key={chip.chip_key}
                        type="button"
                        onClick={() =>
                          setSelectedReasonChips((previous) =>
                            previous.includes(chip.chip_key)
                              ? previous.filter((item) => item !== chip.chip_key)
                              : [...previous, chip.chip_key]
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs ${
                          selected ? "border-amber-300 bg-amber-100 text-amber-800" : "hover:bg-muted/40"
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                <Input
                  value={reasonChipCustom}
                  onChange={(event) => setReasonChipCustom(event.target.value)}
                  placeholder="Optional custom reason"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="h-11 px-4 text-sm"
                  onClick={() => {
                    if (editingInsight) {
                      void saveInsight();
                    } else {
                      setEditingInsight(true);
                    }
                  }}
                  disabled={saving || !selectedStudent}
                >
                  {editingInsight ? "Save correction" : "Write Correction"}
                </Button>
                <Button className="h-11 px-4 text-sm" variant="outline" onClick={() => setEditingInsight(false)} disabled={!editingInsight}>
                  <Check className="mr-2 h-4 w-4" /> Good as-is
                </Button>
              </div>
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{planSessionLabel}</p>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Learning Profile</h3>
            </div>
            <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">AI Classified As</p>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                    {selectedArchetype}
                  </span>
                  <span className="text-sm text-muted-foreground">{confidencePercent}% confidence</span>
                </div>
                <div className="space-y-2">
                  {evidence.map((line, index) => (
                    <p key={`${line}-${index}`} className="rounded-md border bg-muted/20 px-3 py-2 text-base leading-7">
                      {line}
                    </p>
                  ))}
                  {evidence.length === 0 ? (
                    <p className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                      No evidence captured yet.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Your Call</p>
                {classificationSectionChips.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {classificationSectionChips.map((chip) => {
                      const selected = selectedReasonChips.includes(chip.chip_key);
                      return (
                        <button
                          key={chip.chip_key}
                          type="button"
                          onClick={() =>
                            setSelectedReasonChips((previous) =>
                              previous.includes(chip.chip_key)
                                ? previous.filter((item) => item !== chip.chip_key)
                                : [...previous, chip.chip_key]
                            )
                          }
                          className={`rounded-full border px-3 py-1 text-xs ${
                            selected ? "border-amber-300 bg-amber-100 text-amber-800" : "hover:bg-muted/40"
                          }`}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {LEARNING_ARCHETYPES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => void persistArchetype(item.key)}
                    disabled={savingProfileClassification || !selectedStudent}
                    className={`w-full rounded-lg border px-3 py-2 text-left ${
                      selectedArchetype === item.key ? "border-amber-200 bg-amber-50" : "hover:bg-muted/30"
                    }`}
                  >
                    <p className="text-xl font-semibold">{item.key}</p>
                    <p className="text-sm text-muted-foreground leading-snug">{item.subtitle}</p>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Suggested Task</h3>
              <Button
                variant="outline"
                className="h-11 px-4 text-sm"
                onClick={() => void openTaskSwapModal()}
                disabled={saving || !selectedStudent}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                Swap
              </Button>
            </div>
            <div className="px-5 py-4">
              <>
                <p className="text-xl font-semibold">
                  {stripHtmlToText(taskValue || selectedDraft?.task_draft) || "No task selected"}
                </p>
                {taskAiHint ? <p className="mt-1 text-xs text-muted-foreground">{taskAiHint}</p> : null}
                <p className="text-sm text-muted-foreground">Task ID: {selectedStudent?.queue_position != null ? `t${selectedStudent.queue_position}` : "t2"}</p>
              </>
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Message to Student</h3>
              <Button
                variant="outline"
                className="h-11 px-4 text-sm"
                onClick={() => {
                  if (editingMessage) {
                    void saveDraftFields({ email_draft: messageValue.trim() || null });
                    setEditingMessage(false);
                  } else {
                    setEditingMessage(true);
                  }
                }}
                disabled={saving || !selectedStudent}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                {editingMessage ? "Save" : "Edit"}
              </Button>
            </div>
            <div className="px-5 py-4">
              {editingMessage ? (
                <textarea
                  rows={5}
                  value={messageValue}
                  onChange={(event) => setMessageValue(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-snug"
                />
              ) : (
                <p className="text-base leading-7">{messageValue || selectedDraft?.email_draft || "No message drafted yet."}</p>
              )}
              {emailAiHint ? <p className="mt-2 text-xs text-muted-foreground">{emailAiHint}</p> : null}
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Video script</h3>
              <Button
                variant="outline"
                className="h-11 px-4 text-sm"
                onClick={() => {
                  if (editingScript) {
                    void saveDraftFields({ script_draft: scriptValue.trim() || null });
                    setEditingScript(false);
                  } else {
                    setEditingScript(true);
                  }
                }}
                disabled={saving || !selectedStudent}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                {editingScript ? "Save" : "Edit"}
              </Button>
            </div>
            <div className="px-5 py-4">
              {editingScript ? (
                <textarea
                  rows={6}
                  value={scriptValue}
                  onChange={(event) => setScriptValue(event.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-snug"
                  placeholder="Script lines for the student video…"
                />
              ) : (
                <p className="text-base leading-7 whitespace-pre-wrap">
                  {scriptValue || selectedDraft?.script_draft || "No script drafted yet."}
                </p>
              )}
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              className="h-11 px-5 text-sm"
              onClick={() => void sendAssignment()}
              disabled={sendingAssignment || !selectedStudent}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendingAssignment ? "Sending..." : "Send Assignment"}
            </Button>
          </div>
        </div>
      </div>
      {taskModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <Card className="w-full max-w-2xl border-border/90 bg-card p-0 shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-2xl font-semibold">Swap Task</h3>
              <Button variant="ghost" className="h-9 px-3 text-sm" onClick={() => setTaskModalOpen(false)}>
                Close
              </Button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
              {loadingTaskOptions ? (
                <p className="text-sm text-muted-foreground">Loading task options...</p>
              ) : taskOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks available from student or pool APIs.</p>
              ) : (
                <div className="space-y-2">
                  {taskOptions.map((task) => (
                    <button
                      key={`${task.source}-${task.id}`}
                      type="button"
                      onClick={() => chooseTask(task.text)}
                      className="w-full rounded-lg border px-3 py-3 text-left transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base line-clamp-4">{stripHtmlToText(task.text)}</p>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs uppercase text-muted-foreground">
                          {task.source}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : null}
      </>
      )}
    </div>
  );
}
