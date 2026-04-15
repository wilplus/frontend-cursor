"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Check, ChevronRight, PencilLine, RefreshCw, Send, Sparkles, Waves } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AcousticDojoWorkspace from "@/components/admin/dojo/AcousticDojoWorkspace";
import LatestSessionMetrics from "@/components/admin/LatestSessionMetrics";
import ReportDetailModal from "@/components/admin/ReportDetailModal";
import CompactReportPreviewCard from "@/components/reports/CompactReportPreviewCard";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { adminRichTextContentClassName, sanitizeRichHtml, stripHtmlToText } from "@/lib/sanitizeRichHtml";
import { formatTaskTemplateLabel, isTaskTemplateActive } from "@/lib/tasks/taskTemplateLabels";
import { resolveSessionRowWpm } from "@/lib/admin/resolveWpm";
import { toCompactReportPreview, type CompactReportPreview } from "@/lib/reports/compact-preview";
import {
  adminApi,
  COPILOT_REFERENCE_VIDEO_MAX_BYTES,
  uploadCopilotReferenceVideoWithProgress,
  type AdminCopilotReferenceVideo,
  type CopilotReferenceVideoUploadJobPayload,
  type CopilotCohortStack,
  type CopilotReferenceVideoUploadProgress,
  type DraftGenerationStatus,
  type CopilotStudentDraft,
  type CopilotStudentQueueItem,
  type StudentProfile,
  type StudentTask,
  type TasksPoolItem,
} from "@/lib/api/admin-client";
import { homeworkApi } from "@/lib/api/homework-client";
import {
  DRAFT_GENERATION_MAX_RETRIES,
  getDraftGenerationBannerState,
  getEffectiveDraftGenerationStatus,
  hasAnyUsableDraftContent,
  hasUsableDraftContent,
  nextDraftGenerationDelayMs,
  shouldHydrateDraftEditor,
  shouldPollDraftGeneration,
} from "@/components/admin/training/draft-generation";

type QueueFilter = "all" | "pending" | "audit" | "done";
type PipelineStage = "queued" | "running_tts" | "running_video" | "uploading" | "sent" | "failed";

const TRAINING_STUDIO_QUEUE_ARCHIVED_KEY = "training-studio-queue-archived-v1";

const REFERENCE_VIDEOS_PAGE_SIZE = 10;
const PIPELINE_TERMINAL_STAGES = new Set<PipelineStage>(["sent", "failed"]);
const PIPELINE_STAGES: PipelineStage[] = [
  "queued",
  "running_tts",
  "running_video",
  "uploading",
  "sent",
  "failed",
];

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

function queueArchiveKey(student: CopilotStudentQueueItem): string {
  return `${student.student_id}:${student.session_id ?? ""}`;
}

/** Session / queue row creation time for sorting (not lesson submission aliases). */
function queueItemSessionTimeMs(student: CopilotStudentQueueItem): number {
  const raw = student.session_created_at ?? student.created_at ?? null;
  if (!raw) return Number.POSITIVE_INFINITY;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function formatSessionCreatedDate(student: CopilotStudentQueueItem): string {
  const raw = student.session_created_at ?? student.created_at ?? null;
  if (!raw) return "Session date unknown";
  const when = new Date(raw);
  if (Number.isNaN(when.getTime())) return "Session date unknown";
  return when.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Red = not yet reviewed (Draft), yellow = in progress / needs review (Ready), green = sent. */
function coachQueueStatusDotClass(student: CopilotStudentQueueItem): string {
  if (student.state === "Sent") return "bg-emerald-500";
  if (student.state === "Ready") return "bg-amber-400";
  return "bg-rose-500";
}

function queueRecency(student: CopilotStudentQueueItem): string {
  const raw = student.session_created_at ?? student.created_at ?? null;
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

function statusDisplayLabel(state: CopilotStudentQueueItem["state"]): string {
  if (state === "Draft") return "Pending";
  if (state === "Ready") return "Needs Review";
  return "Sent";
}

function toPipelineStage(value: unknown): PipelineStage | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  if (v === "queued" || v === "running_tts" || v === "running_video" || v === "uploading" || v === "sent" || v === "failed") {
    return v;
  }
  return null;
}

function formatPipelineStageLabel(stage: PipelineStage): string {
  if (stage === "running_tts") return "Running TTS";
  if (stage === "running_video") return "Rendering Video";
  if (stage === "queued") return "Queued";
  if (stage === "uploading") return "Uploading";
  if (stage === "sent") return "Sent";
  return "Failed";
}

function formatReferenceTags(tags: string[] | null | undefined): string {
  if (!Array.isArray(tags) || tags.length === 0) return "No tags";
  return tags.join(", ");
}

function formatReferenceCreatedAt(raw: string | null | undefined): string {
  if (!raw) return "Unknown date";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString();
}

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function matchesQueueFilter(item: CopilotStudentQueueItem, filter: QueueFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return item.state === "Draft";
  if (filter === "audit") return item.state === "Ready";
  return item.state === "Sent";
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

function formatUnitPercent(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "—";
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

function draftEditorValuesFromDraft(draft: CopilotStudentDraft | null) {
  return {
    insight: draft?.corrected_insight ?? draft?.ai_insight ?? "",
    task: draft?.task_draft ?? draft?.ai_task_suggestion ?? "",
    message: draft?.email_draft ?? draft?.ai_email_draft ?? "",
    script: draft?.script_draft ?? draft?.ai_script_draft ?? "",
    grade:
      typeof draft?.grade_draft === "number" && Number.isFinite(draft.grade_draft)
        ? String(draft.grade_draft)
        : typeof draft?.ai_grade_draft === "number" && Number.isFinite(draft.ai_grade_draft)
          ? String(draft.ai_grade_draft)
          : "",
    comment: draft?.comment_draft ?? draft?.ai_comment_draft ?? "",
    reviewerScore: reviewerScoreFromMetadata(draft?.metadata),
  };
}

export default function TrainingStudioWorkspace() {
  const [pipelineView, setPipelineView] = useState<"agentic" | "voice">("agentic");
  const [cohorts, setCohorts] = useState<CopilotCohortStack[]>([]);
  const [students, setStudents] = useState<CopilotStudentQueueItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<CopilotStudentQueueItem | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<CopilotStudentDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [archivedQueueKeys, setArchivedQueueKeys] = useState<Set<string>>(() => new Set());
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [selectedArchetype, setSelectedArchetype] = useState<string>(LEARNING_ARCHETYPES[0].key);
  const [profileJustificationInput, setProfileJustificationInput] = useState("");

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
  const [sendingHomework, setSendingHomework] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage | null>(null);
  const [pipelineStatusError, setPipelineStatusError] = useState<string | null>(null);
  const [pipelineStatusPolling, setPipelineStatusPolling] = useState(false);
  const [latestFeedbackVideoUrl, setLatestFeedbackVideoUrl] = useState<string | null>(null);
  const [referenceVideos, setReferenceVideos] = useState<AdminCopilotReferenceVideo[]>([]);
  const [referenceVideosTotal, setReferenceVideosTotal] = useState(0);
  const [referenceVideosOffset, setReferenceVideosOffset] = useState(0);
  const [referenceVideosLoading, setReferenceVideosLoading] = useState(false);
  const [referenceVideosRefreshing, setReferenceVideosRefreshing] = useState(false);
  const [referenceVideosUploadLoading, setReferenceVideosUploadLoading] = useState(false);
  const [referenceVideoUploadProgress, setReferenceVideoUploadProgress] =
    useState<CopilotReferenceVideoUploadProgress | null>(null);
  const [referenceVideoServerJob, setReferenceVideoServerJob] =
    useState<CopilotReferenceVideoUploadJobPayload | null>(null);
  const [referenceVideoFile, setReferenceVideoFile] = useState<File | null>(null);
  const [referenceVideoTitle, setReferenceVideoTitle] = useState("");
  const [referenceVideoTags, setReferenceVideoTags] = useState("");
  const [referenceVideoUniversal, setReferenceVideoUniversal] = useState(false);
  const [referenceVideoExpandedTranscriptIds, setReferenceVideoExpandedTranscriptIds] = useState<string[]>([]);
  const [referenceVideoPlaybackUrlById, setReferenceVideoPlaybackUrlById] = useState<Record<string, string>>({});
  const [referenceVideoPreviewLoadingId, setReferenceVideoPreviewLoadingId] = useState<string | null>(null);
  const [attachReferenceVideoLoadingId, setAttachReferenceVideoLoadingId] = useState<string | null>(null);
  const [fullOverrideAttached, setFullOverrideAttached] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [loadingTaskOptions, setLoadingTaskOptions] = useState(false);
  const [savingTaskOptionId, setSavingTaskOptionId] = useState<string | null>(null);
  const [deletingTaskOptionId, setDeletingTaskOptionId] = useState<string | null>(null);
  const [editingTaskOptionId, setEditingTaskOptionId] = useState<string | null>(null);
  const [taskOptionEditValue, setTaskOptionEditValue] = useState("");
  const [taskOptions, setTaskOptions] = useState<
    Array<{ id: string; text: string; source: "student" | "pool"; subLabel?: string }>
  >([]);
  const [annotationChips, setAnnotationChips] = useState<Array<{ chip_key: string; label: string; section?: string | null }>>([]);
  const [selectedReasonChips, setSelectedReasonChips] = useState<string[]>([]);
  const [reasonChipCustom, setReasonChipCustom] = useState("");
  const [savingProfileClassification, setSavingProfileClassification] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsProfile, setDetailsProfile] = useState<StudentProfile | null>(null);
  const [detailsReportPreviews, setDetailsReportPreviews] = useState<Record<string, CompactReportPreview | null>>({});
  const [detailsReportPreviewLoading, setDetailsReportPreviewLoading] = useState<Record<string, boolean>>({});
  const [detailsReportModalSession, setDetailsReportModalSession] = useState<StudentProfile["sessions"][number] | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [draftGenerationStatus, setDraftGenerationStatus] = useState<DraftGenerationStatus | null>(null);
  const [draftGenerationSessionId, setDraftGenerationSessionId] = useState<string | null>(null);
  const [draftGenerationRetries, setDraftGenerationRetries] = useState(0);
  const [draftGenerationRetriesExhausted, setDraftGenerationRetriesExhausted] = useState(false);
  const [draftGenerationPolling, setDraftGenerationPolling] = useState(false);
  const [hasUsableDraftFromServer, setHasUsableDraftFromServer] = useState(false);
  const [homeworkPlayback, setHomeworkPlayback] = useState<{
    loading: boolean;
    error: string | null;
    audioUrl: string | null;
    failed: boolean;
  }>({ loading: false, error: null, audioUrl: null, failed: false });
  const activeStudentKeyRef = useRef<string | null>(null);
  const hasUnsavedDraftEditsRef = useRef(false);
  const referenceVideoUploadAbortRef = useRef<AbortController | null>(null);
  const referenceVideoUploadProgressRafRef = useRef<number | null>(null);
  const referenceVideoUploadProgressPendingRef = useRef<CopilotReferenceVideoUploadProgress | null>(null);

  useBodyScrollLock(taskModalOpen);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TRAINING_STUDIO_QUEUE_ARCHIVED_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      setArchivedQueueKeys(
        new Set(parsed.filter((x): x is string => typeof x === "string"))
      );
    } catch {
      /* ignore */
    }
  }, []);

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
      return [] as CopilotStudentQueueItem[];
    }

    // Progressive loading: render rows as each cohort resolves (instead of waiting for all).
    const deduped = new Map<string, CopilotStudentQueueItem>();
    const applyList = () => {
      const list = Array.from(deduped.values());
      setStudents(list);
      setSelectedStudent((previous) => {
        if (!previous) return list[0] ?? null;
        const exact =
          list.find(
            (item) =>
              item.student_id === previous.student_id &&
              (item.session_id ?? "") === (previous.session_id ?? "")
          ) ?? null;
        if (exact) return exact;
        return list.find((item) => item.student_id === previous.student_id) ?? list[0] ?? null;
      });
      return list;
    };

    setLoadingQueue(true);
    try {
      let firstErrorShown = false;
      await Promise.all(
        cohortIds.map(async (cohortId) => {
          try {
            const response = await adminApi.getCopilotCohortStudents(cohortId, {
              limit: 100,
              offset: 0,
            });
            for (const student of response.students ?? []) {
              const key = `${student.student_id}:${student.session_id ?? ""}`;
              if (!deduped.has(key)) deduped.set(key, student);
            }
            applyList();
          } catch (error) {
            if (!firstErrorShown) {
              firstErrorShown = true;
              toast.error(error instanceof Error ? error.message : "Failed to load students");
            }
          }
        })
      );
      return applyList();
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  const archiveStudentQueueRow = useCallback((student: CopilotStudentQueueItem) => {
    const key = queueArchiveKey(student);
    setArchivedQueueKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      try {
        localStorage.setItem(TRAINING_STUDIO_QUEUE_ARCHIVED_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
    toast.success("Session hidden from this list");
  }, []);

  const profileLearningMeta = useMemo(() => {
    const profile = selectedStudent?.profile as Record<string, unknown> | undefined;
    const maybeLearning = profile?.learning_profile;
    return maybeLearning && typeof maybeLearning === "object"
      ? (maybeLearning as Record<string, unknown>)
      : null;
  }, [selectedStudent?.profile]);

  const displayJustification = useMemo(() => {
    const fromLearningProfile = profileLearningMeta?.display_justification;
    if (typeof fromLearningProfile === "string" && fromLearningProfile.trim()) {
      return fromLearningProfile.trim();
    }
    const fromOverride = profileLearningMeta?.profile_override_justification;
    if (typeof fromOverride === "string" && fromOverride.trim()) {
      return fromOverride.trim();
    }
    const fromBehavioral = selectedStudent?.profile?.behavioral_profile_justification;
    if (typeof fromBehavioral === "string" && fromBehavioral.trim()) return fromBehavioral.trim();
    return selectedStudent?.profile?.justification ?? "";
  }, [
    profileLearningMeta?.display_justification,
    profileLearningMeta?.profile_override_justification,
    selectedStudent?.profile?.behavioral_profile_justification,
    selectedStudent?.profile?.justification,
  ]);

  const draftEditorBaseline = useMemo(
    () => draftEditorValuesFromDraft(selectedDraft),
    [
      selectedDraft?.ai_comment_draft,
      selectedDraft?.ai_email_draft,
      selectedDraft?.ai_grade_draft,
      selectedDraft?.ai_insight,
      selectedDraft?.ai_script_draft,
      selectedDraft?.ai_task_suggestion,
      selectedDraft?.comment_draft,
      selectedDraft?.corrected_insight,
      selectedDraft?.email_draft,
      selectedDraft?.grade_draft,
      selectedDraft?.metadata,
      selectedDraft?.script_draft,
      selectedDraft?.task_draft,
    ]
  );

  const hasUnsavedDraftEdits = useMemo(() => {
    if (!selectedStudent) return false;
    if (editingInsight || editingMessage || editingScript) return true;
    return (
      insightValue !== draftEditorBaseline.insight ||
      taskValue !== draftEditorBaseline.task ||
      messageValue !== draftEditorBaseline.message ||
      scriptValue !== draftEditorBaseline.script ||
      gradeInput !== draftEditorBaseline.grade ||
      commentInput !== draftEditorBaseline.comment ||
      reviewerScoreInput !== draftEditorBaseline.reviewerScore
    );
  }, [
    commentInput,
    draftEditorBaseline.comment,
    draftEditorBaseline.grade,
    draftEditorBaseline.insight,
    draftEditorBaseline.message,
    draftEditorBaseline.reviewerScore,
    draftEditorBaseline.script,
    draftEditorBaseline.task,
    editingInsight,
    editingMessage,
    editingScript,
    gradeInput,
    insightValue,
    messageValue,
    reviewerScoreInput,
    scriptValue,
    selectedStudent,
    taskValue,
  ]);

  useEffect(() => {
    hasUnsavedDraftEditsRef.current = hasUnsavedDraftEdits;
  }, [hasUnsavedDraftEdits]);

  useEffect(() => {
    activeStudentKeyRef.current = selectedStudent
      ? `${selectedStudent.student_id}::${selectedStudent.session_id ?? ""}`
      : null;
  }, [selectedStudent?.session_id, selectedStudent?.student_id]);

  const hydrateDraftEditor = useCallback(
    (student: CopilotStudentQueueItem, draft: CopilotStudentDraft | null) => {
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
        (typeof profileLearningMeta?.coach_override_profile === "string"
          ? profileLearningMeta.coach_override_profile.trim()
          : "") ||
          student.profile?.behavioral_profile?.trim() ||
          inferArchetype(
            `${draft?.ai_insight ?? ""} ${student.profile?.behavioral_profile_justification ?? student.profile?.justification ?? ""}`
          )
      );
    },
    [profileLearningMeta?.coach_override_profile]
  );

  const loadDraft = useCallback(
    async (
      student: CopilotStudentQueueItem | null,
      options?: { background?: boolean; silentError?: boolean }
    ) => {
      if (!student) {
        setSelectedDraft(null);
        setDraftGenerationStatus(null);
        setDraftGenerationSessionId(null);
        setDraftGenerationRetries(0);
        setDraftGenerationRetriesExhausted(false);
        setDraftGenerationPolling(false);
        setHasUsableDraftFromServer(false);
        return null;
      }
      const isBackground = options?.background === true;
      if (!isBackground) setLoading(true);
      try {
        const sessionHint = student.session_id?.trim() || selectedDraft?.session_id?.trim() || undefined;
        const response = await adminApi.getCopilotStudentDrafts(
          student.student_id,
          sessionHint ? { session_id: sessionHint } : undefined
        );
        const requestStudentKey = `${student.student_id}::${student.session_id ?? ""}`;
        if (activeStudentKeyRef.current !== requestStudentKey) return null;
        const hasUsableFromResponse = hasAnyUsableDraftContent(response.drafts);
        setHasUsableDraftFromServer(hasUsableFromResponse);

        setDraftGenerationStatus(response.draft_generation_status ?? null);
        setDraftGenerationSessionId(response.draft_generation_session_id ?? null);

        const draft =
          (selectedDraft?.id
            ? response.drafts?.find((item) => item.id === selectedDraft.id) ?? null
            : null) ??
          response.drafts?.[0] ??
          null;

        const shouldHydrate = shouldHydrateDraftEditor({
          isBackgroundRefresh: isBackground,
          hasUnsavedEdits: hasUnsavedDraftEditsRef.current,
        });
        if (shouldHydrate) {
          hydrateDraftEditor(student, draft);
        } else {
          // Keep incoming draft metadata fresh, but do not clobber in-progress local edits.
          setSelectedDraft(draft);
        }

        return {
          ...response,
          drafts: response.drafts ?? [],
          selectedDraft: draft,
          hasUsableDraftContent: hasUsableFromResponse,
        };
      } catch (error) {
        if (!options?.silentError) {
          toast.error(error instanceof Error ? error.message : "Failed to load student draft");
        }
        if (!isBackground) {
          setSelectedDraft(null);
          setDraftGenerationStatus(null);
          setDraftGenerationSessionId(null);
          setHasUsableDraftFromServer(false);
        }
        return null;
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [hydrateDraftEditor, selectedDraft?.id, selectedDraft?.session_id]
  );

  useEffect(() => {
    setProfileJustificationInput(displayJustification);
  }, [displayJustification, selectedStudent?.student_id, selectedStudent?.session_id]);

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
    setDraftGenerationRetries(0);
    setDraftGenerationRetriesExhausted(false);
    setDraftGenerationPolling(false);
    setHasUsableDraftFromServer(false);
    void loadDraft(selectedStudent);
  }, [loadDraft, selectedStudent?.student_id, selectedStudent?.session_id]);

  const hasUsableSelectedDraftContent = useMemo(
    () => hasUsableDraftFromServer || hasUsableDraftContent(selectedDraft),
    [
      hasUsableDraftFromServer,
      selectedDraft?.ai_email_draft,
      selectedDraft?.ai_script_draft,
      selectedDraft?.ai_task_suggestion,
      selectedDraft?.email_draft,
      selectedDraft?.script_draft,
      selectedDraft?.task_draft,
    ]
  );

  useEffect(() => {
    const metadata =
      selectedDraft?.metadata &&
      typeof selectedDraft.metadata === "object" &&
      !Array.isArray(selectedDraft.metadata)
        ? (selectedDraft.metadata as Record<string, unknown>)
        : null;
    const attached =
      metadata?.full_video_override === true ||
      metadata?.has_full_video_override === true ||
      typeof metadata?.reference_video_id === "string";
    setFullOverrideAttached(attached);
  }, [selectedDraft?.metadata]);

  const effectiveDraftGenerationStatus = useMemo(
    () =>
      getEffectiveDraftGenerationStatus({
        status: draftGenerationStatus,
        hasUsableDraftContent: hasUsableSelectedDraftContent,
      }),
    [draftGenerationStatus, hasUsableSelectedDraftContent]
  );

  useEffect(() => {
    if (!selectedStudent) return;
    const shouldPoll = shouldPollDraftGeneration({
      status: effectiveDraftGenerationStatus,
      hasUsableDraftContent: hasUsableSelectedDraftContent,
      retryCount: draftGenerationRetries,
      isEditing: hasUnsavedDraftEdits,
      maxRetries: DRAFT_GENERATION_MAX_RETRIES,
    });
    if (!shouldPoll) {
      setDraftGenerationPolling(false);
      return;
    }

    const delayMs = nextDraftGenerationDelayMs(draftGenerationRetries);
    setDraftGenerationPolling(true);

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      const refreshed = await loadDraft(selectedStudent, { background: true, silentError: true });
      if (cancelled) return;
      setDraftGenerationPolling(false);
      if (!refreshed) {
        toast.error("Could not refresh draft generation state.");
        setDraftGenerationRetries(DRAFT_GENERATION_MAX_RETRIES);
        setDraftGenerationRetriesExhausted(true);
        return;
      }

      const shouldStopBecauseReady =
        refreshed.draft_generation_status === "ready" || refreshed.hasUsableDraftContent;
      const shouldStopBecauseFinalState =
        refreshed.draft_generation_status === "failed" ||
        refreshed.draft_generation_status === "not_started";
      if (shouldStopBecauseReady || shouldStopBecauseFinalState) {
        setDraftGenerationRetries(0);
        setDraftGenerationRetriesExhausted(false);
        return;
      }

      // Still pending and no usable content.
      setDraftGenerationRetries((previous) => {
        const next = previous + 1;
        if (next >= DRAFT_GENERATION_MAX_RETRIES) {
          setDraftGenerationRetriesExhausted(true);
        }
        return next;
      });
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      setDraftGenerationPolling(false);
    };
  }, [
    draftGenerationRetries,
    effectiveDraftGenerationStatus,
    hasUnsavedDraftEdits,
    hasUsableSelectedDraftContent,
    loadDraft,
    selectedStudent,
  ]);

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
    setPipelineStage(null);
    setPipelineStatusError(null);
    setPipelineStatusPolling(false);
    setLatestFeedbackVideoUrl(null);
    setFullOverrideAttached(false);
  }, [selectedStudent?.student_id, selectedStudent?.session_id]);

  useEffect(() => {
    setDetailsOpen(false);
    setDetailsError(null);
    setDetailsProfile(null);
    setDetailsReportPreviews({});
    setDetailsReportPreviewLoading({});
    setDetailsReportModalSession(null);
  }, [selectedStudent?.student_id]);

  useEffect(() => {
    if (!detailsOpen || !selectedStudent) return;
    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError(null);
    adminApi
      .getStudentProfile(selectedStudent.student_id)
      .then((profile) => {
        if (cancelled) return;
        setDetailsProfile(profile);
      })
      .catch((error) => {
        if (cancelled) return;
        setDetailsError(error instanceof Error ? error.message : "Failed to load student details");
        setDetailsProfile(null);
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailsOpen, selectedStudent]);

  const detailsReports = useMemo(() => {
    const sessions = detailsProfile?.sessions ?? [];
    return [...sessions]
      .sort((a, b) => (b.completed_at || b.created_at || "").localeCompare(a.completed_at || a.created_at || ""))
      .slice(0, 5);
  }, [detailsProfile?.sessions]);

  const detailsSessionRows = useMemo(() => {
    const sessions = detailsProfile?.sessions ?? [];
    return [...sessions]
      .sort((a, b) => (b.completed_at || b.created_at || "").localeCompare(a.completed_at || a.created_at || ""))
      .slice(0, 10);
  }, [detailsProfile?.sessions]);

  useEffect(() => {
    if (!detailsOpen || !selectedStudent || detailsReports.length === 0) return;
    detailsReports.forEach((session) => {
      if (detailsReportPreviews[session.id] !== undefined || detailsReportPreviewLoading[session.id]) return;
      setDetailsReportPreviewLoading((prev) => ({ ...prev, [session.id]: true }));
      adminApi
        .getStudentSessionReport(selectedStudent.student_id, session.id)
        .then((report) => {
          setDetailsReportPreviews((prev) => ({ ...prev, [session.id]: toCompactReportPreview(report) }));
        })
        .catch(() => {
          setDetailsReportPreviews((prev) => ({ ...prev, [session.id]: null }));
        })
        .finally(() => {
          setDetailsReportPreviewLoading((prev) => ({ ...prev, [session.id]: false }));
        });
    });
  }, [detailsOpen, detailsReportPreviewLoading, detailsReportPreviews, detailsReports, selectedStudent]);

  const sortedStudents = useMemo(() => {
    const statusOrder: Record<CopilotStudentQueueItem["state"], number> = {
      Draft: 0,
      Ready: 1,
      Sent: 2,
    };
    return [...students].sort((a, b) => {
      const stateDiff = statusOrder[a.state] - statusOrder[b.state];
      if (stateDiff !== 0) return stateDiff;
      const timeDiff = queueItemSessionTimeMs(a) - queueItemSessionTimeMs(b);
      if (timeDiff !== 0) return timeDiff;
      const queueA = a.queue_position ?? Number.MAX_SAFE_INTEGER;
      const queueB = b.queue_position ?? Number.MAX_SAFE_INTEGER;
      if (queueA !== queueB) return queueA - queueB;
      return formatName(a).localeCompare(formatName(b));
    });
  }, [students]);

  const studentsMinusArchived = useMemo(
    () => sortedStudents.filter((s) => !archivedQueueKeys.has(queueArchiveKey(s))),
    [sortedStudents, archivedQueueKeys]
  );

  const queueCounts = useMemo(() => {
    const list = studentsMinusArchived;
    const all = list.length;
    const pending = list.filter((item) => item.state === "Draft").length;
    const audit = list.filter((item) => item.state === "Ready").length;
    const done = list.filter((item) => item.state === "Sent").length;
    return { all, pending, audit, done };
  }, [studentsMinusArchived]);

  const filteredStudents = useMemo(() => {
    const list = studentsMinusArchived;
    if (queueFilter === "all") return list;
    if (queueFilter === "pending") return list.filter((item) => item.state === "Draft");
    if (queueFilter === "audit") return list.filter((item) => item.state === "Ready");
    return list.filter((item) => item.state === "Sent");
  }, [queueFilter, studentsMinusArchived]);

  useEffect(() => {
    if (!selectedStudent) return;
    if (!archivedQueueKeys.has(queueArchiveKey(selectedStudent))) return;
    const base = sortedStudents.filter((s) => !archivedQueueKeys.has(queueArchiveKey(s)));
    const visible =
      queueFilter === "all"
        ? base
        : queueFilter === "pending"
          ? base.filter((item) => item.state === "Draft")
          : queueFilter === "audit"
            ? base.filter((item) => item.state === "Ready")
            : base.filter((item) => item.state === "Sent");
    setSelectedStudent(visible[0] ?? null);
  }, [archivedQueueKeys, queueFilter, selectedStudent, sortedStudents]);

  const canLoadPreviousReferenceVideos = referenceVideosOffset > 0;
  const canLoadNextReferenceVideos =
    referenceVideosOffset + REFERENCE_VIDEOS_PAGE_SIZE < referenceVideosTotal;

  /** Cohort queue rows often omit session_id; the loaded draft usually has it (required for insight-audit BFF fallback). */
  const copilotSessionId = useMemo(() => {
    const fromQueue = selectedStudent?.session_id?.trim();
    if (fromQueue) return fromQueue;
    const fromDraft = selectedDraft?.session_id?.trim();
    return fromDraft || null;
  }, [selectedDraft?.session_id, selectedStudent?.session_id]);

  useEffect(() => {
    const sid = copilotSessionId;
    const studentId = selectedStudent?.student_id?.trim();
    if (!sid) {
      setHomeworkPlayback({ loading: false, error: null, audioUrl: null, failed: false });
      return;
    }
    let cancelled = false;
    setHomeworkPlayback({ loading: true, error: null, audioUrl: null, failed: false });
    /** Coach/student homework report routes differ; Training Studio must load the student's report as admin. */
    const reportPromise =
      studentId != null && studentId !== ""
        ? adminApi.getStudentSessionReport(studentId, sid)
        : homeworkApi.getReport(sid);
    reportPromise
      .then(async (data) => {
        if (cancelled) return;
        const rec1 = "recording_1" in data ? data.recording_1 : undefined;
        const direct =
          data.final_recording?.audio_url ??
          data.recording?.audio_url ??
          rec1?.audio_url ??
          null;
        if (direct) {
          setHomeworkPlayback({ loading: false, error: null, audioUrl: direct, failed: false });
          return;
        }
        const recordingId = data.final_recording?.id ?? rec1?.id;
        if (recordingId) {
          try {
            const r =
              studentId != null && studentId !== ""
                ? await adminApi.getRecordingPlaybackUrl(recordingId)
                : await homeworkApi.getRecordingPlaybackUrl(recordingId);
            if (cancelled) return;
            setHomeworkPlayback({
              loading: false,
              error: null,
              audioUrl: r.audio_url?.trim() ? r.audio_url : null,
              failed: false,
            });
          } catch {
            if (!cancelled) {
              setHomeworkPlayback({ loading: false, error: null, audioUrl: null, failed: false });
            }
          }
          return;
        }
        setHomeworkPlayback({ loading: false, error: null, audioUrl: null, failed: false });
      })
      .catch((e) => {
        if (!cancelled) {
          setHomeworkPlayback({
            loading: false,
            error: e instanceof Error ? e.message : "Failed to load homework playback",
            audioUrl: null,
            failed: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [copilotSessionId, selectedStudent?.student_id]);

  /**
   * Queue rows often omit session_id; React state can also lag behind the network response.
   * Refetch drafts / audit so approve + send homework can always target the right session.
   */
  const resolveCopilotSessionAndDraftId = useCallback(async (): Promise<{
    sessionId: string;
    draftId: string | undefined;
  } | null> => {
    if (!selectedStudent) return null;

    const fromQueue = selectedStudent.session_id?.trim();
    if (fromQueue) {
      return {
        sessionId: fromQueue,
        draftId: selectedDraft?.id?.trim() ? selectedDraft.id : undefined,
      };
    }

    const fromDraftState = selectedDraft?.session_id?.trim();
    if (fromDraftState) {
      return {
        sessionId: fromDraftState,
        draftId: selectedDraft?.id?.trim() ? selectedDraft.id : undefined,
      };
    }

    try {
      const { drafts } = await adminApi.getCopilotStudentDrafts(selectedStudent.student_id);
      const withSession = drafts.find((d) => d.session_id?.trim());
      if (withSession?.session_id?.trim()) {
        return {
          sessionId: withSession.session_id.trim(),
          draftId: withSession.id?.trim() ? withSession.id : undefined,
        };
      }
    } catch {
      /* continue to audit */
    }

    try {
      const { audit } = await adminApi.getCopilotStudentAudit(selectedStudent.student_id);
      const sid = audit?.session_id?.trim();
      if (sid) {
        return {
          sessionId: sid,
          draftId: audit?.id?.trim() ? audit.id : undefined,
        };
      }
    } catch {
      /* give up */
    }

    return null;
  }, [selectedDraft?.id, selectedDraft?.session_id, selectedStudent]);

  const currentInsight = selectedDraft?.ai_insight ?? selectedStudent?.profile?.justification ?? "";
  const evidence = useMemo(() => toEvidence(currentInsight, displayJustification), [currentInsight, displayJustification]);
  const confidencePercent = useMemo(() => {
    return (
      extractConfidencePercent(
        displayJustification ||
          selectedStudent?.profile?.behavioral_profile_justification ||
          ""
      ) ?? 82
    );
  }, [displayJustification, selectedStudent?.profile?.behavioral_profile_justification]);
  const aiClassifiedAs = useMemo(() => {
    return (
      selectedStudent?.profile?.behavioral_profile?.trim() ||
      inferArchetype(
        `${selectedDraft?.ai_insight ?? ""} ${selectedStudent?.profile?.behavioral_profile_justification ?? ""}`
      )
    );
  }, [
    selectedDraft?.ai_insight,
    selectedStudent?.profile?.behavioral_profile,
    selectedStudent?.profile?.behavioral_profile_justification,
  ]);
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

  const draftGenerationBannerState = useMemo(
    () =>
      getDraftGenerationBannerState({
        status: effectiveDraftGenerationStatus,
        hasUsableDraftContent: hasUsableSelectedDraftContent,
        retriesExhausted: draftGenerationRetriesExhausted,
      }),
    [draftGenerationRetriesExhausted, effectiveDraftGenerationStatus, hasUsableSelectedDraftContent]
  );

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
        const overrideJustification = profileJustificationInput.trim() || null;
        await adminApi.patchStudentProfileClassification(selectedStudent.student_id, {
          coach_override_profile: archetype,
          profile_override_justification: overrideJustification,
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
    [cohorts, loadStudents, profileJustificationInput, reasonChipCustom, selectedReasonChips, selectedStudent]
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
      const resolved =
        copilotSessionId != null
          ? { sessionId: copilotSessionId, draftId: selectedDraft?.id?.trim() ? selectedDraft.id : undefined }
          : await resolveCopilotSessionAndDraftId();
      if (!resolved) {
        toast.error(
          "Could not find a session for this copilot draft. Refresh the queue or check that the backend returns session_id on drafts/audit."
        );
        return;
      }
      await adminApi.updateCopilotStudentDrafts(selectedStudent.student_id, {
        session_id: resolved.sessionId,
        grade_draft: grade,
        comment_draft: commentInput.trim() || null,
        task_draft: taskValue.trim() || null,
        email_draft: messageValue.trim() || null,
        script_draft: scriptValue.trim() || null,
        metadata: mergeMetadataReviewerScore(selectedDraft?.metadata, reviewerScore),
        reason_chips: selectedReasonChips.map((chip_key) => ({ chip_key })),
        reason_chip_custom: reasonChipCustom.trim() || null,
      });
      const refreshed = await adminApi.getCopilotStudentDrafts(selectedStudent.student_id, {
        session_id: resolved.sessionId,
      });
      const refreshedDraft =
        (resolved.draftId
          ? refreshed.drafts.find((item) => item.id === resolved.draftId) ?? null
          : null) ?? refreshed.drafts?.[0] ?? null;
      hydrateDraftEditor(selectedStudent, refreshedDraft);
      toast.success("Feedback saved. Click Accept AI for this student to move it to the next review state.");
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
    copilotSessionId,
    hydrateDraftEditor,
    resolveCopilotSessionAndDraftId,
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
      const resolved =
        copilotSessionId != null
          ? { sessionId: copilotSessionId, draftId: selectedDraft?.id?.trim() ? selectedDraft.id : undefined }
          : await resolveCopilotSessionAndDraftId();
      if (!resolved) {
        toast.error(
          "Could not find a session for this copilot draft. Refresh the queue or check that the backend returns session_id on drafts/audit."
        );
        return;
      }
      await adminApi.updateCopilotStudentDrafts(selectedStudent.student_id, {
        session_id: resolved.sessionId,
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
      const refreshed = await adminApi.getCopilotStudentDrafts(selectedStudent.student_id, {
        session_id: resolved.sessionId,
      });
      const refreshedDraft =
        (resolved.draftId
          ? refreshed.drafts.find((item) => item.id === resolved.draftId) ?? null
          : null) ?? refreshed.drafts?.[0] ?? null;
      hydrateDraftEditor(selectedStudent, refreshedDraft);
      toast.success("Saved.");
      await loadStudents(cohorts.map((cohort) => cohort.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    cohorts,
    commentInput,
    copilotSessionId,
    gradeInput,
    loadStudents,
    messageValue,
    reviewerScoreInput,
    reasonChipCustom,
    resolveCopilotSessionAndDraftId,
    hydrateDraftEditor,
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
      const resolved =
        copilotSessionId != null
          ? { sessionId: copilotSessionId, draftId: selectedDraft?.id?.trim() ? selectedDraft.id : undefined }
          : await resolveCopilotSessionAndDraftId();
      if (!resolved) {
        toast.error(
          "Could not find a session for this copilot draft. Refresh the queue or check that the backend returns session_id on drafts/audit."
        );
        return;
      }
      await adminApi.updateCopilotStudentAudit(selectedStudent.student_id, {
        session_id: resolved.sessionId,
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
  }, [
    copilotSessionId,
    insightValue,
    loadDraft,
    reasonChipCustom,
    resolveCopilotSessionAndDraftId,
    selectedDraft?.id,
    selectedReasonChips,
    selectedStudent,
  ]);

  const approveAiForSelectedStudent = useCallback(async () => {
    if (!selectedStudent) return;
    if (selectedStudent.state === "Sent") {
      toast.message("This student is already marked sent.");
      return;
    }
    const currentFilter = queueFilter;
    const fallbackFromCurrentTab = (() => {
      const idx = filteredStudents.findIndex(
        (item) =>
          item.student_id === selectedStudent.student_id &&
          (item.session_id ?? "") === (selectedStudent.session_id ?? "")
      );
      if (idx < 0) return filteredStudents[0] ?? null;
      return filteredStudents[idx + 1] ?? filteredStudents[idx - 1] ?? null;
    })();
    setApprovingAll(true);
    try {
      const resolved = await resolveCopilotSessionAndDraftId();
      if (!resolved) {
        toast.error(
          "Could not find a session for this copilot draft. Refresh the queue or check that the backend returns session_id on drafts/audit."
        );
        return;
      }
      const draftId = resolved.draftId ?? (selectedDraft?.id?.trim() ? selectedDraft.id : undefined);
      await adminApi.updateCopilotStudentAudit(selectedStudent.student_id, {
        session_id: resolved.sessionId,
        good_as_is: true,
        reason_chips: selectedReasonChips.length > 0 ? selectedReasonChips.map((chip_key) => ({ chip_key })) : undefined,
        reason_chip_custom: reasonChipCustom.trim() || null,
      });
      await adminApi.approveCopilotStudent(selectedStudent.student_id, {
        session_id: resolved.sessionId,
        draft_id: draftId,
        idempotency_key: crypto.randomUUID(),
      });
      toast.success("AI suggestions approved for this student.");
      await loadDraft(selectedStudent);
      const refreshed = await loadStudents(cohorts.map((cohort) => cohort.id));
      const exactFallback =
        fallbackFromCurrentTab == null
          ? null
          : refreshed.find(
              (item) =>
                item.student_id === fallbackFromCurrentTab.student_id &&
                (item.session_id ?? "") === (fallbackFromCurrentTab.session_id ?? "")
            ) ?? null;
      const firstInCurrentTab = refreshed.find((item) => matchesQueueFilter(item, currentFilter)) ?? null;
      setSelectedStudent(exactFallback ?? firstInCurrentTab ?? refreshed[0] ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Approve failed");
    } finally {
      setApprovingAll(false);
    }
  }, [
    cohorts,
    filteredStudents,
    loadDraft,
    loadStudents,
    queueFilter,
    reasonChipCustom,
    resolveCopilotSessionAndDraftId,
    selectedDraft?.id,
    selectedReasonChips,
    selectedStudent,
  ]);

  const loadReferenceVideos = useCallback(
    async (offset = referenceVideosOffset, mode: "load" | "refresh" = "load") => {
      if (mode === "refresh") setReferenceVideosRefreshing(true);
      else setReferenceVideosLoading(true);
      try {
        const response = await adminApi.getCopilotReferenceVideos({
          limit: REFERENCE_VIDEOS_PAGE_SIZE,
          offset,
          include_preview_url: true,
        });
        setReferenceVideos(response.reference_videos ?? []);
        setReferenceVideosTotal(response.total ?? 0);
        setReferenceVideosOffset(response.offset ?? offset);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load reference videos");
      } finally {
        setReferenceVideosLoading(false);
        setReferenceVideosRefreshing(false);
      }
    },
    [referenceVideosOffset]
  );

  const loadReferenceVideoPlaybackUrl = useCallback(async (referenceVideoId: string) => {
    if (!referenceVideoId) return;
    setReferenceVideoPreviewLoadingId(referenceVideoId);
    try {
      const response = await adminApi.getCopilotReferenceVideoPlaybackUrl(referenceVideoId, 3600);
      const signed = response.signed_url?.trim();
      if (!signed) {
        toast.error("No signed playback URL returned.");
        return;
      }
      setReferenceVideoPlaybackUrlById((previous) => ({ ...previous, [referenceVideoId]: signed }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load playback URL");
    } finally {
      setReferenceVideoPreviewLoadingId(null);
    }
  }, []);

  const flushReferenceVideoUploadProgress = useCallback(() => {
    const latest = referenceVideoUploadProgressPendingRef.current;
    if (latest) setReferenceVideoUploadProgress({ ...latest });
  }, []);

  const scheduleReferenceVideoUploadProgress = useCallback(
    (progress: CopilotReferenceVideoUploadProgress) => {
      referenceVideoUploadProgressPendingRef.current = progress;
      if (referenceVideoUploadProgressRafRef.current != null) return;
      referenceVideoUploadProgressRafRef.current = requestAnimationFrame(() => {
        referenceVideoUploadProgressRafRef.current = null;
        flushReferenceVideoUploadProgress();
      });
    },
    [flushReferenceVideoUploadProgress]
  );

  const clearReferenceVideoUploadProgressUi = useCallback(() => {
    if (referenceVideoUploadProgressRafRef.current != null) {
      cancelAnimationFrame(referenceVideoUploadProgressRafRef.current);
      referenceVideoUploadProgressRafRef.current = null;
    }
    referenceVideoUploadProgressPendingRef.current = null;
    setReferenceVideoUploadProgress(null);
    setReferenceVideoServerJob(null);
  }, []);

  const uploadReferenceVideo = useCallback(async () => {
    if (!referenceVideoFile) {
      toast.error("Choose a video file first.");
      return;
    }
    if (referenceVideoFile.size > COPILOT_REFERENCE_VIDEO_MAX_BYTES) {
      toast.error(`Video must be at most ${Math.round(COPILOT_REFERENCE_VIDEO_MAX_BYTES / (1024 * 1024))} MB.`);
      return;
    }
    clearReferenceVideoUploadProgressUi();
    const abortController = new AbortController();
    referenceVideoUploadAbortRef.current = abortController;
    setReferenceVideosUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("video_file", referenceVideoFile);
      if (selectedStudent?.student_id) formData.append("user_id", selectedStudent.student_id);
      if (copilotSessionId) formData.append("session_id", copilotSessionId);
      if (selectedDraft?.id) formData.append("draft_id", selectedDraft.id);
      if (referenceVideoTitle.trim()) formData.append("title", referenceVideoTitle.trim());
      if (referenceVideoTags.trim()) formData.append("reference_tags", referenceVideoTags.trim());
      formData.append("is_universal_video", referenceVideoUniversal ? "true" : "false");
      const response = await uploadCopilotReferenceVideoWithProgress(formData, {
        signal: abortController.signal,
        onProgress: scheduleReferenceVideoUploadProgress,
        onJobProgress: (job) => setReferenceVideoServerJob({ ...job }),
        jobPollIntervalMs: 750,
      });
      const uploaded = response.reference_video;
      if (uploaded?.id) {
        setReferenceVideos((previous) => {
          const deduped = previous.filter((item) => item.id !== uploaded.id);
          const withPreview =
            response.preview_url && response.preview_url.trim()
              ? { ...uploaded, preview_url: response.preview_url.trim() }
              : uploaded;
          return [withPreview, ...deduped];
        });
        if (response.preview_url?.trim()) {
          setReferenceVideoPlaybackUrlById((previous) => ({
            ...previous,
            [uploaded.id]: response.preview_url!.trim(),
          }));
        }
        setReferenceVideosTotal((previous) => previous + 1);
      }
      setReferenceVideoFile(null);
      setReferenceVideoTitle("");
      setReferenceVideoTags("");
      setReferenceVideoUniversal(false);
      toast.success("Reference video uploaded.");
      await loadReferenceVideos(referenceVideosOffset, "refresh");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        toast.info("Upload cancelled.");
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to upload reference video");
      }
    } finally {
      referenceVideoUploadAbortRef.current = null;
      clearReferenceVideoUploadProgressUi();
      setReferenceVideosUploadLoading(false);
    }
  }, [
    clearReferenceVideoUploadProgressUi,
    copilotSessionId,
    loadReferenceVideos,
    referenceVideoFile,
    referenceVideoTags,
    referenceVideoTitle,
    referenceVideoUniversal,
    referenceVideosOffset,
    scheduleReferenceVideoUploadProgress,
    selectedDraft?.id,
    selectedStudent?.student_id,
  ]);

  const attachReferenceVideoToDraft = useCallback(
    async (referenceVideoId: string) => {
      if (!selectedStudent || !selectedDraft?.id) {
        toast.error("Select a student draft first.");
        return;
      }
      setAttachReferenceVideoLoadingId(referenceVideoId);
      try {
        await adminApi.attachReferenceVideoToCopilotDraft(
          selectedStudent.student_id,
          selectedDraft.id,
          referenceVideoId
        );
        setFullOverrideAttached(true);
        await loadDraft(selectedStudent);
        toast.success("Full override video attached.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to attach reference video");
      } finally {
        setAttachReferenceVideoLoadingId(null);
      }
    },
    [loadDraft, selectedDraft?.id, selectedStudent]
  );

  const toggleTranscriptExpanded = useCallback((referenceVideoId: string) => {
    setReferenceVideoExpandedTranscriptIds((previous) =>
      previous.includes(referenceVideoId)
        ? previous.filter((item) => item !== referenceVideoId)
        : [...previous, referenceVideoId]
    );
  }, []);

  useEffect(() => {
    void loadReferenceVideos(referenceVideosOffset, "load");
  }, [loadReferenceVideos, referenceVideosOffset]);

  const loadTaskOptionsForStudent = useCallback(async () => {
    if (!selectedStudent) {
      setTaskOptions([]);
      return;
    }
    setLoadingTaskOptions(true);
    try {
      const [studentTasks, poolTasks] = await Promise.all([
        adminApi.getStudentTasks(selectedStudent.student_id),
        adminApi.getTasksPool(),
      ]);
      const merged = new Map<string, { id: string; text: string; source: "student" | "pool"; subLabel?: string }>();
      for (const task of studentTasks as StudentTask[]) {
        if (!task.text?.trim()) continue;
        const key = `student:${task.id}`;
        merged.set(key, { id: task.id, text: task.text, source: "student", subLabel: "Student task" });
      }
      const studentProfile = selectedStudent.profile?.behavioral_profile?.trim() ?? null;
      const activePool = (poolTasks as TasksPoolItem[]).filter((task) => {
        if (!isTaskTemplateActive(task)) return false;
        return !!task.text?.trim();
      });
      const sortedPool = [...activePool].sort((a, b) => {
        const aMatches = studentProfile != null && a.target_profile === studentProfile;
        const bMatches = studentProfile != null && b.target_profile === studentProfile;
        if (aMatches !== bMatches) return aMatches ? -1 : 1;
        const aLevel = a.level ?? Number.MAX_SAFE_INTEGER;
        const bLevel = b.level ?? Number.MAX_SAFE_INTEGER;
        if (aLevel !== bLevel) return aLevel - bLevel;
        const aStep = a.step_in_level ?? Number.MAX_SAFE_INTEGER;
        const bStep = b.step_in_level ?? Number.MAX_SAFE_INTEGER;
        if (aStep !== bStep) return aStep - bStep;
        return a.text.localeCompare(b.text);
      });
      for (const task of sortedPool) {
        const key = `pool:${task.id}`;
        const profileMatch = studentProfile && task.target_profile === studentProfile ? "Match" : null;
        const label = formatTaskTemplateLabel(task);
        merged.set(key, {
          id: task.id,
          text: task.text,
          source: "pool",
          subLabel: profileMatch ? `${label} · ${profileMatch}` : label,
        });
      }
      setTaskOptions(Array.from(merged.values()));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load task options");
      setTaskOptions([]);
    } finally {
      setLoadingTaskOptions(false);
    }
  }, [selectedStudent]);

  const openTaskSwapModal = useCallback(async () => {
    if (!selectedStudent) return;
    setTaskModalOpen(true);
    setEditingTaskOptionId(null);
    setTaskOptionEditValue("");
    await loadTaskOptionsForStudent();
  }, [loadTaskOptionsForStudent, selectedStudent]);

  const chooseTask = useCallback((taskText: string) => {
    setTaskValue(taskText);
    void saveDraftFields({ task_draft: taskText });
    setTaskModalOpen(false);
  }, [saveDraftFields]);

  const startEditingTaskOption = useCallback((optionId: string, source: "student" | "pool", text: string) => {
    setEditingTaskOptionId(`${source}:${optionId}`);
    setTaskOptionEditValue(text);
  }, []);

  const cancelEditingTaskOption = useCallback(() => {
    setEditingTaskOptionId(null);
    setTaskOptionEditValue("");
  }, []);

  const saveTaskOptionEdit = useCallback(async (optionId: string, source: "student" | "pool") => {
    if (!selectedStudent) return;
    const nextText = taskOptionEditValue.trim();
    if (!nextText) {
      toast.error("Task text cannot be empty.");
      return;
    }
    const opKey = `${source}:${optionId}`;
    setSavingTaskOptionId(opKey);
    try {
      if (source === "student") {
        await adminApi.updateStudentTask(selectedStudent.student_id, optionId, { text: nextText });
      } else {
        await adminApi.updateTasksPoolItem(optionId, { text: nextText });
      }
      toast.success("Task updated.");
      setEditingTaskOptionId(null);
      setTaskOptionEditValue("");
      await loadTaskOptionsForStudent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update task");
    } finally {
      setSavingTaskOptionId(null);
    }
  }, [loadTaskOptionsForStudent, selectedStudent, taskOptionEditValue]);

  const deleteTaskOption = useCallback(async (optionId: string, source: "student" | "pool") => {
    if (!selectedStudent) return;
    const opKey = `${source}:${optionId}`;
    setDeletingTaskOptionId(opKey);
    try {
      if (source === "student") {
        await adminApi.deleteStudentTask(selectedStudent.student_id, optionId);
      } else {
        await adminApi.deleteTasksPoolItem(optionId);
      }
      toast.success("Task deleted.");
      await loadTaskOptionsForStudent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    } finally {
      setDeletingTaskOptionId(null);
    }
  }, [loadTaskOptionsForStudent, selectedStudent]);

  const sendHomework = useCallback(async () => {
    if (!selectedStudent) return;
    const videoDescription = messageValue.trim();
    if (videoDescription.length > 2000) {
      toast.error("Homework message must be 2000 characters or less");
      return;
    }

    setSendingHomework(true);
    setPipelineStatusError(null);
    setLatestFeedbackVideoUrl(null);
    try {
      const resolved = await resolveCopilotSessionAndDraftId();
      if (!resolved) {
        toast.error(
          "Could not find a session for this copilot draft. Refresh the queue or check that the backend returns session_id on drafts/audit."
        );
        return;
      }
      let draftId = resolved.draftId ?? (selectedDraft?.id?.trim() ? selectedDraft.id : undefined);

      await adminApi.updateCopilotStudentAudit(selectedStudent.student_id, {
        session_id: resolved.sessionId,
        good_as_is: true,
        reason_chips:
          selectedReasonChips.length > 0
            ? selectedReasonChips.map((chip_key) => ({ chip_key }))
            : undefined,
        reason_chip_custom: reasonChipCustom.trim() || null,
      });

      if (!draftId) {
        const { drafts } = await adminApi.getCopilotStudentDrafts(selectedStudent.student_id, {
          session_id: resolved.sessionId,
        });
        const pick =
          drafts.find((d) => (d.session_id ?? "").trim() === resolved.sessionId) ?? drafts[0] ?? null;
        if (pick?.id?.trim()) {
          draftId = pick.id;
        }
      }

      if (!draftId) {
        toast.error(
          "No copilot draft id for this session. Save once from Training Studio or confirm the backend returns drafts for this student."
        );
        return;
      }

      await adminApi.approveSendCopilotDraft(selectedStudent.student_id, draftId, {
        session_id: resolved.sessionId,
        idempotency_key: crypto.randomUUID(),
      });
      setPipelineStage("queued");
      setPipelineStatusPolling(true);

      let finalStage: PipelineStage | null = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const statusPayload = await adminApi.getCopilotDraftPipelineStatus(
          selectedStudent.student_id,
          draftId
        );
        const stage = toPipelineStage(statusPayload.stage ?? statusPayload.status);
        if (stage) {
          setPipelineStage(stage);
          finalStage = stage;
        }
        if (stage && PIPELINE_TERMINAL_STAGES.has(stage)) break;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
      }

      try {
        const feedback = await adminApi.getCopilotDraftFeedbackVideoUrl(selectedStudent.student_id, draftId);
        const feedbackUrl = feedback.video_url?.trim() || feedback.feedback_video_url?.trim() || null;
        setLatestFeedbackVideoUrl(feedbackUrl);
      } catch {
        setLatestFeedbackVideoUrl(null);
      }

      if (finalStage === "failed") {
        setPipelineStatusError("Pipeline failed while sending homework.");
        toast.error("Approve & Send failed.");
      } else {
        toast.success(finalStage === "sent" ? "Homework sent." : "Approve & Send queued.");
      }

      await loadDraft(selectedStudent);
      const refreshed = await loadStudents(cohorts.map((cohort) => cohort.id));
      const nextReviewable = refreshed.find((item) => item.state !== "Sent") ?? null;
      setSelectedStudent(nextReviewable ?? refreshed[0] ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send homework");
      setPipelineStatusError(error instanceof Error ? error.message : "Failed to send homework");
    } finally {
      setPipelineStatusPolling(false);
      setSendingHomework(false);
    }
  }, [
    cohorts,
    loadDraft,
    loadStudents,
    messageValue,
    reasonChipCustom,
    resolveCopilotSessionAndDraftId,
    selectedDraft,
    selectedReasonChips,
    selectedStudent,
  ]);

  const selectedProfileName = selectedStudent?.profile?.name?.trim() ?? "";
  const selectedProfileEmail = selectedStudent?.profile?.email?.trim() ?? "";
  const studentHeadlineName = selectedStudent
    ? selectedProfileName || selectedProfileEmail || formatName(selectedStudent)
    : "Select a student";
  const showStudentEmailBelow =
    Boolean(selectedStudent && selectedProfileEmail) &&
    (selectedProfileName.length > 0 ? true : studentHeadlineName !== selectedProfileEmail);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Training Studio</h1>
        <p className="text-xs text-muted-foreground">
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
          <div className="flex items-center justify-end border-b bg-muted/20 px-2 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Refresh queue"
              title="Refresh queue"
              disabled={loadingQueue}
              onClick={() => void loadCohorts()}
            >
              <RefreshCw className={`h-4 w-4 ${loadingQueue ? "animate-spin" : ""}`} />
            </Button>
          </div>
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
                      <div className="flex shrink-0 items-center gap-1">
                        {queueFilter === "all" ? (
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Hide session from list"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              archiveStudentQueueRow(student);
                            }}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <span
                          className={`h-3 w-3 rounded-full ${coachQueueStatusDotClass(student)}`}
                          title={
                            student.state === "Sent"
                              ? "Homework sent"
                              : student.state === "Ready"
                                ? "In progress / needs review"
                                : "Not reviewed yet"
                          }
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <p>{formatSessionCreatedDate(student)}</p>
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
              <p className="text-xl font-semibold leading-tight text-foreground">{studentHeadlineName}</p>
              {showStudentEmailBelow ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{selectedProfileEmail}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedStudent
                  ? `${formatSessionCreatedDate(selectedStudent)} · Score: ${displayScorePercent != null ? `${displayScorePercent}%` : "—"}`
                  : "No student selected"}
              </p>
              {selectedStudent ? (
                <button
                  type="button"
                  onClick={() => setDetailsOpen((prev) => !prev)}
                  className="mt-1 inline-flex items-center gap-1 text-sm text-amber-600 transition-colors hover:text-amber-700"
                >
                  <ChevronRight className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-90" : ""}`} />
                  {detailsOpen ? "Hide details" : "See the details"}
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {selectedStudent ? (
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${queueStateBadge(selectedStudent.state)}`}>
                  {statusDisplayLabel(selectedStudent.state)}
                </span>
              ) : null}
              <Button
                className="h-11 px-4 text-sm"
                onClick={() => void approveAiForSelectedStudent()}
                disabled={
                  approvingAll ||
                  loading ||
                  !selectedStudent ||
                  selectedStudent.state === "Sent"
                }
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

          {detailsOpen ? (
            <Card className="border-border/80 bg-card/95 p-0">
              <div className="border-b px-5 py-3">
                <p className="text-xs font-medium text-muted-foreground">Student snapshot</p>
              </div>
              <div className="space-y-4 px-5 py-4">
                {detailsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading details...</p>
                ) : detailsError ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {detailsError}
                  </p>
                ) : detailsProfile ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="text-sm font-semibold">{detailsProfile.name?.trim() || "—"}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="truncate text-sm font-semibold">{detailsProfile.email?.trim() || "—"}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Credits</p>
                        <p className="text-sm font-semibold">{detailsProfile.credits ?? "—"}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Price per live lesson (USD)</p>
                        <p className="text-sm font-semibold">{detailsProfile.price_per_live_lesson ?? "—"}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Current unlocked level</p>
                        <p className="text-sm font-semibold">{detailsProfile.realtime_level ?? "—"}</p>
                      </div>
                      <div className="rounded-lg border bg-muted/20 px-3 py-2">
                        <p className="text-xs text-muted-foreground">Current unlocked step</p>
                        <p className="text-sm font-semibold">{detailsProfile.realtime_step ?? "—"}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/10 p-3">
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Coaching Memory & Momentum
                      </h4>
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <p>
                          <span className="text-muted-foreground">Last 5 scores:</span>{" "}
                          {detailsProfile.coaching_memory?.last_5_scores?.length
                            ? detailsProfile.coaching_memory.last_5_scores.map((v) => formatUnitPercent(v)).join(" -> ")
                            : "—"}
                        </p>
                        <p>
                          <span className="text-muted-foreground">Updated:</span>{" "}
                          {detailsProfile.coaching_memory?.updated_at
                            ? new Date(detailsProfile.coaching_memory.updated_at).toLocaleString()
                            : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-muted/10 p-3">
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Latest session metrics
                      </h4>
                      <LatestSessionMetrics sessions={detailsProfile.sessions} />
                    </div>

                    <div className="rounded-lg border bg-muted/10 p-3">
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Performance per session
                      </h4>
                      {detailsSessionRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No sessions yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[760px] text-xs">
                            <thead>
                              <tr className="border-b text-muted-foreground">
                                <th className="py-1.5 pr-3 text-left font-medium">Date</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Score</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Q1</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Q2</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Q3</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Grade</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Stage</th>
                                <th className="py-1.5 pr-3 text-right font-medium">WPM</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Fillers</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Pause</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Dynamic</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Pitch</th>
                                <th className="py-1.5 pr-3 text-right font-medium">Energy</th>
                                <th className="py-1.5 text-right font-medium">Self</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailsSessionRows.map((session) => {
                                const metrics = session.sniper_metrics;
                                const rowWpm = resolveSessionRowWpm(session as unknown as Record<string, unknown>);
                                return (
                                  <tr key={session.id} className="border-t border-border/40">
                                    <td className="py-1.5 pr-3">{session.created_at ? new Date(session.created_at).toLocaleDateString() : "—"}</td>
                                    <td className="py-1.5 pr-3 text-right">{formatUnitPercent(session.score)}</td>
                                    <td className="py-1.5 pr-3 text-right">{formatUnitPercent(session.question_1_score)}</td>
                                    <td className="py-1.5 pr-3 text-right">{formatUnitPercent(session.question_2_score)}</td>
                                    <td className="py-1.5 pr-3 text-right">{formatUnitPercent(session.question_3_score)}</td>
                                    <td className="py-1.5 pr-3 text-right">{session.report_grade != null ? `${session.report_grade}/10` : "—"}</td>
                                    <td className="py-1.5 pr-3 text-right">
                                      {metrics?.stage_score != null ? metrics.stage_score.toFixed(1) : "—"}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right">{rowWpm != null ? rowWpm.toFixed(0) : "—"}</td>
                                    <td className="py-1.5 pr-3 text-right">
                                      {session.recording_preview?.filler_words_count?.total ?? "—"}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right">
                                      {metrics?.pause_ms != null ? metrics.pause_ms.toFixed(0) : "—"}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right">
                                      {metrics?.dynamic_db != null ? metrics.dynamic_db.toFixed(1) : "—"}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right">
                                      {metrics?.pitch_center_st != null ? metrics.pitch_center_st.toFixed(1) : "—"}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right">
                                      {metrics?.energy_ratio != null ? metrics.energy_ratio.toFixed(3) : "—"}
                                    </td>
                                    <td className="py-1.5 text-right">{metrics?.student_rating_1_10 ?? "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border bg-muted/10 p-3">
                      <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                        Reports History
                      </h4>
                      {detailsReports.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No reports yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {detailsReports.map((session) => (
                            <CompactReportPreviewCard
                              key={session.id}
                              title={`Report — ${session.created_at ? new Date(session.created_at).toLocaleDateString() : "—"}`}
                              preview={detailsReportPreviews[session.id] ?? null}
                              loading={!!detailsReportPreviewLoading[session.id]}
                              onOpen={() => setDetailsReportModalSession(session)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No details available for this student.</p>
                )}
              </div>
            </Card>
          ) : null}

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex flex-wrap items-center justify-end gap-2 border-b px-5 py-3">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {selectedStudent ? statusDisplayLabel(selectedStudent.state) : "—"}
              </span>
              <Button
                className="h-9 px-3 text-sm"
                onClick={() => void saveScoreGradeComment()}
                disabled={saving || !selectedStudent || loading}
              >
                {saving ? "Saving..." : "Save feedback"}
              </Button>
            </div>
            <div className="border-b px-5 py-4">
              <p className="mb-2 text-sm font-medium text-muted-foreground">Homework playback</p>
              {!copilotSessionId ? (
                <p className="text-sm text-muted-foreground">No homework session linked for this student yet.</p>
              ) : homeworkPlayback.loading ? (
                <p className="text-sm text-muted-foreground">Loading recording…</p>
              ) : homeworkPlayback.error ? (
                <p className="text-sm text-muted-foreground">{homeworkPlayback.error}</p>
              ) : homeworkPlayback.audioUrl && !homeworkPlayback.failed ? (
                <audio
                  controls
                  src={homeworkPlayback.audioUrl}
                  className="w-full max-w-md rounded-lg border border-border"
                  onError={() => setHomeworkPlayback((p) => ({ ...p, failed: true }))}
                />
              ) : homeworkPlayback.failed ? (
                <p className="text-sm text-muted-foreground">Playback failed. The audio may be unavailable.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Playback not available for this session yet.</p>
              )}
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
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-xs font-medium text-muted-foreground">AI coach insight</p>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {selectedStudent ? statusDisplayLabel(selectedStudent.state) : "—"}
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

          {draftGenerationBannerState === "pending" ? (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/60 border-t-transparent" />
                <span>
                  Generating plan...
                  {draftGenerationPolling ? "" : " Waiting for update..."}
                  {draftGenerationSessionId ? ` (${draftGenerationSessionId.slice(0, 8)}...)` : ""}
                </span>
              </div>
            </div>
          ) : null}
          {draftGenerationBannerState === "failed" ? (
            <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Plan generation failed. You can generate manually.
            </div>
          ) : null}
          {draftGenerationBannerState === "retry_exhausted" ? (
            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              Still generating. Refresh in a few seconds.
            </div>
          ) : null}

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="border-b px-5 py-3">
              <p className="text-xs font-medium text-muted-foreground">Learning profile</p>
            </div>
            <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">AI Classified As</p>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                    {aiClassifiedAs}
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
                <div className="space-y-2 rounded-lg border border-border/80 bg-muted/10 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Coach justification
                  </p>
                  <textarea
                    value={profileJustificationInput}
                    onChange={(event) => setProfileJustificationInput(event.target.value)}
                    rows={4}
                    placeholder="Why this override fits the student (used in display + learning data)"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void persistArchetype(selectedArchetype)}
                      disabled={savingProfileClassification || !selectedStudent}
                    >
                      Save override
                    </Button>
                  </div>
                </div>
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
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-xs font-medium text-muted-foreground">Suggested task</p>
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
                  {stripHtmlToText(
                    taskValue || selectedDraft?.task_draft || selectedDraft?.ai_task_suggestion
                  ) || "No task selected"}
                </p>
                {taskAiHint ? <p className="mt-1 text-xs text-muted-foreground">{taskAiHint}</p> : null}
                <p className="text-sm text-muted-foreground">Task ID: {selectedStudent?.queue_position != null ? `t${selectedStudent.queue_position}` : "t2"}</p>
              </>
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-xs font-medium text-muted-foreground">Homework message</p>
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
                <p className="text-base leading-7">
                  {messageValue ||
                    selectedDraft?.email_draft ||
                    selectedDraft?.ai_email_draft ||
                    "No homework message yet."}
                </p>
              )}
              {emailAiHint ? <p className="mt-2 text-xs text-muted-foreground">{emailAiHint}</p> : null}
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-xs font-medium text-muted-foreground">Video script</p>
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
                  {scriptValue ||
                    selectedDraft?.script_draft ||
                    selectedDraft?.ai_script_draft ||
                    "No script drafted yet."}
                </p>
              )}
            </div>
          </Card>

          <Card className="border-border/80 bg-card/95 p-0">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-xs font-medium text-muted-foreground">Add videos</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadReferenceVideos(referenceVideosOffset, "refresh")}
                disabled={referenceVideosRefreshing || referenceVideosLoading}
              >
                {referenceVideosRefreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm text-muted-foreground">Video file</label>
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (file && file.size > COPILOT_REFERENCE_VIDEO_MAX_BYTES) {
                        toast.error(
                          `Video must be at most ${Math.round(COPILOT_REFERENCE_VIDEO_MAX_BYTES / (1024 * 1024))} MB.`
                        );
                        setReferenceVideoFile(null);
                        event.target.value = "";
                        return;
                      }
                      setReferenceVideoFile(file);
                    }}
                    disabled={referenceVideosUploadLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max file size {Math.round(COPILOT_REFERENCE_VIDEO_MAX_BYTES / (1024 * 1024))} MB. Large uploads use your API URL directly (
                    <code className="text-[11px]">NEXT_PUBLIC_API_URL</code>
                    ).
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Title (optional)</label>
                  <Input
                    value={referenceVideoTitle}
                    onChange={(event) => setReferenceVideoTitle(event.target.value)}
                    placeholder="Coach intro — confidence reset"
                    disabled={referenceVideosUploadLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Tags (comma-separated)</label>
                  <Input
                    value={referenceVideoTags}
                    onChange={(event) => setReferenceVideoTags(event.target.value)}
                    placeholder="confidence, pacing"
                    disabled={referenceVideosUploadLoading}
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={referenceVideoUniversal}
                    onChange={(event) => setReferenceVideoUniversal(event.target.checked)}
                    disabled={referenceVideosUploadLoading}
                  />
                  Universal video
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Selected context: {selectedStudent?.student_id ? `${formatName(selectedStudent)} · ${selectedDraft?.id ?? "No draft"}` : "No student selected"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {referenceVideosUploadLoading ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 px-3 text-sm"
                      onClick={() => referenceVideoUploadAbortRef.current?.abort()}
                    >
                      Cancel upload
                    </Button>
                  ) : null}
                  <Button
                    className="h-9 px-3 text-sm"
                    onClick={() => void uploadReferenceVideo()}
                    disabled={referenceVideosUploadLoading}
                  >
                    {referenceVideosUploadLoading ? "Uploading…" : "Upload"}
                  </Button>
                </div>
              </div>
              {referenceVideosUploadLoading ? (
                <div className="space-y-4 rounded-md border border-border/80 bg-muted/20 px-3 py-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">1. Sending file to server</p>
                    <div
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={
                        referenceVideoUploadProgress?.percent != null
                          ? referenceVideoUploadProgress.percent
                          : undefined
                      }
                      aria-valuetext={
                        referenceVideoUploadProgress
                          ? referenceVideoUploadProgress.percent != null
                            ? `${referenceVideoUploadProgress.percent}% · ${formatMegabytes(referenceVideoUploadProgress.loaded)} / ${formatMegabytes(referenceVideoUploadProgress.total)} MB`
                            : `Uploading, ${formatMegabytes(referenceVideoUploadProgress.loaded)} MB transferred`
                          : "Starting upload"
                      }
                      aria-label="Multipart upload progress"
                      className="space-y-2"
                    >
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        {referenceVideoUploadProgress?.percent != null ? (
                          <div
                            className="h-full bg-primary transition-[width] duration-150 ease-linear"
                            style={{ width: `${referenceVideoUploadProgress.percent}%` }}
                          />
                        ) : (
                          <div className="h-full w-full animate-pulse bg-primary/50" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {referenceVideoUploadProgress ? (
                          referenceVideoUploadProgress.lengthComputable &&
                          referenceVideoUploadProgress.total > 0 ? (
                            <>
                              {referenceVideoUploadProgress.percent != null
                                ? `${referenceVideoUploadProgress.percent}% · `
                                : null}
                              {formatMegabytes(referenceVideoUploadProgress.loaded)} /{" "}
                              {formatMegabytes(referenceVideoUploadProgress.total)} MB
                            </>
                          ) : (
                            <>
                              Uploading… (connection in progress) ·{" "}
                              {formatMegabytes(referenceVideoUploadProgress.loaded)} MB
                            </>
                          )
                        ) : (
                          "Starting upload…"
                        )}
                      </p>
                    </div>
                  </div>
                  {referenceVideoServerJob ? (
                    <div className="space-y-2 border-t border-border/60 pt-3">
                      <p className="text-xs font-medium text-muted-foreground">2. Server processing</p>
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={referenceVideoServerJob.percent}
                        aria-valuetext={`${referenceVideoServerJob.percent}% · ${referenceVideoServerJob.stage}${referenceVideoServerJob.message ? ` · ${referenceVideoServerJob.message}` : ""}`}
                        aria-label="Server reference video job progress"
                        className="space-y-2"
                      >
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-emerald-600/90 transition-[width] duration-300 ease-linear"
                            style={{ width: `${Math.max(0, Math.min(100, referenceVideoServerJob.percent))}%` }}
                          />
                        </div>
                        {referenceVideoServerJob.error?.trim() ? (
                          <p className="text-xs text-rose-600">{referenceVideoServerJob.error.trim()}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {referenceVideoServerJob.message?.trim() ||
                            `Stage: ${referenceVideoServerJob.stage || "…"}`}
                        </p>
                        {/*
                          Backend reference pipeline: .mov/.avi/.mkv → ffmpeg → mono MP3 → Whisper;
                          .mp4/.webm/.m4v → Whisper on original bytes. Long clips: first N seconds server-side.
                        */}
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          .mov, .avi, .mkv: the server may extract audio (ffmpeg) before Whisper. .mp4, .webm, .m4v can go
                          to Whisper directly. Very long videos may use only the first portion of audio (server cap).
                          Transcription can take a few minutes. If it fails (e.g. ffmpeg not installed on the host),
                          check the error above or the video row’s transcription error after upload.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {fullOverrideAttached ? (
                <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Full override video attached.
                </p>
              ) : null}
              <div className="space-y-3">
                {referenceVideosLoading ? (
                  <p className="text-sm text-muted-foreground">Loading internal library…</p>
                ) : referenceVideos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No uploaded videos yet.</p>
                ) : (
                  referenceVideos.map((video) => {
                    const previewUrl =
                      referenceVideoPlaybackUrlById[video.id] ??
                      (video.preview_url && video.preview_url.trim() ? video.preview_url.trim() : null);
                    const transcriptionStatus = (video.transcription_status ?? "processing").toString().toLowerCase();
                    const transcriptExpanded = referenceVideoExpandedTranscriptIds.includes(video.id);
                    return (
                      <div key={video.id} className="rounded-lg border border-border/80 bg-muted/10 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">
                            {(video.title && video.title.trim()) ||
                              (video.original_filename && video.original_filename.trim()) ||
                              video.id}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              transcriptionStatus === "done"
                                ? "bg-emerald-100 text-emerald-700"
                                : transcriptionStatus === "failed"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {transcriptionStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatReferenceCreatedAt(video.created_at)} · {formatReferenceTags(video.reference_tags)}
                          {video.is_universal_video ? " · universal" : ""}
                        </p>
                        {video.transcription_error ? (
                          <p className="mt-1 text-xs text-rose-600">{video.transcription_error}</p>
                        ) : null}
                        {transcriptionStatus === "done" && video.transcript_text ? (
                          <div className="mt-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => toggleTranscriptExpanded(video.id)}
                            >
                              {transcriptExpanded ? "Hide transcript" : "Show transcript"}
                            </Button>
                            {transcriptExpanded ? (
                              <p className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background px-2 py-1 text-xs">
                                {video.transcript_text}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-2 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() => void loadReferenceVideoPlaybackUrl(video.id)}
                              disabled={referenceVideoPreviewLoadingId === video.id}
                            >
                              {referenceVideoPreviewLoadingId === video.id ? "Loading preview..." : "Load internal preview"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() => void attachReferenceVideoToDraft(video.id)}
                              disabled={!selectedStudent || !selectedDraft || attachReferenceVideoLoadingId === video.id}
                            >
                              {attachReferenceVideoLoadingId === video.id
                                ? "Attaching..."
                                : "Use this video as full override"}
                            </Button>
                          </div>
                          {previewUrl ? (
                            <video controls src={previewUrl} className="w-full max-w-md rounded-lg border border-border" />
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() =>
                    setReferenceVideosOffset((previous) =>
                      Math.max(0, previous - REFERENCE_VIDEOS_PAGE_SIZE)
                    )
                  }
                  disabled={!canLoadPreviousReferenceVideos || referenceVideosLoading}
                >
                  Previous
                </Button>
                <p className="text-xs text-muted-foreground">
                  {referenceVideosTotal === 0
                    ? "0 videos"
                    : `${referenceVideosOffset + 1}-${Math.min(referenceVideosOffset + referenceVideos.length, referenceVideosTotal)} of ${referenceVideosTotal}`}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={() =>
                    setReferenceVideosOffset((previous) => previous + REFERENCE_VIDEOS_PAGE_SIZE)
                  }
                  disabled={!canLoadNextReferenceVideos || referenceVideosLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>

          {(pipelineStage || pipelineStatusError || latestFeedbackVideoUrl) ? (
            <Card className="border-border/80 bg-card/95 p-0">
              <div className="border-b px-5 py-3">
                <p className="text-xs font-medium text-muted-foreground">Approve &amp; Send pipeline</p>
              </div>
              <div className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STAGES.map((stage) => {
                    const active = pipelineStage === stage;
                    const reached = pipelineStage ? PIPELINE_STAGES.indexOf(stage) <= PIPELINE_STAGES.indexOf(pipelineStage) : false;
                    return (
                      <span
                        key={stage}
                        className={`rounded-full px-2 py-1 text-xs ${
                          active
                            ? "bg-amber-100 text-amber-700"
                            : reached
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {formatPipelineStageLabel(stage)}
                      </span>
                    );
                  })}
                </div>
                {pipelineStatusPolling ? (
                  <p className="text-xs text-muted-foreground">Polling pipeline status…</p>
                ) : null}
                {pipelineStatusError ? (
                  <p className="text-sm text-rose-600">{pipelineStatusError}</p>
                ) : null}
                {latestFeedbackVideoUrl ? (
                  <video
                    controls
                    src={latestFeedbackVideoUrl}
                    className="w-full max-w-md rounded-lg border border-border"
                  />
                ) : null}
              </div>
            </Card>
          ) : null}

          <div className="flex justify-end">
            <Button
              className="h-11 px-5 text-sm"
              onClick={() => void sendHomework()}
              disabled={sendingHomework || !selectedStudent || loading}
            >
              <Send className="mr-2 h-4 w-4" />
              {sendingHomework ? "Sending…" : "Approve & Send"}
            </Button>
          </div>
        </div>
      </div>
      <ReportDetailModal
        open={!!detailsReportModalSession && !!selectedStudent}
        onOpenChange={(open) => {
          if (!open) setDetailsReportModalSession(null);
        }}
        userId={selectedStudent?.student_id ?? ""}
        studentEmail={selectedStudent?.profile?.email ?? null}
        session={detailsReportModalSession}
        onGradeSaved={() => {
          if (detailsOpen && selectedStudent) {
            void adminApi
              .getStudentProfile(selectedStudent.student_id)
              .then(setDetailsProfile)
              .catch(() => {});
          }
        }}
      />
      {taskModalOpen && isMounted
        ? createPortal(
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4">
          <Card className="w-full max-w-2xl border-border/90 bg-card p-0 shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-sm font-semibold">Swap task</p>
              <Button variant="ghost" className="h-9 px-3 text-sm" onClick={() => setTaskModalOpen(false)}>
                Close
              </Button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
              {loadingTaskOptions ? (
                <p className="text-sm text-muted-foreground">Loading task options...</p>
              ) : taskOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tasks loaded from DB yet. Check task pool labels and active state.
                </p>
              ) : (
                <div className="space-y-2">
                  {taskOptions.map((task) => (
                    <div
                      key={`${task.source}-${task.id}`}
                      className="w-full rounded-lg border px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {editingTaskOptionId === `${task.source}:${task.id}` ? (
                            <textarea
                              rows={6}
                              value={taskOptionEditValue}
                              onChange={(event) => setTaskOptionEditValue(event.target.value)}
                              spellCheck={false}
                              className="w-full min-h-[140px] resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words"
                            />
                          ) : (
                            <div
                              className={`${adminRichTextContentClassName} [&_p]:mb-1 [&_p:last-child]:mb-0`}
                              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(task.text) }}
                            />
                          )}
                          {task.subLabel ? (
                            <p className="mt-1 text-xs text-muted-foreground">{task.subLabel}</p>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs uppercase text-muted-foreground">
                          {task.source}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 px-3 text-xs"
                          onClick={() => chooseTask(task.text)}
                        >
                          Apply as override
                        </Button>
                        {editingTaskOptionId === `${task.source}:${task.id}` ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={() => void saveTaskOptionEdit(task.id, task.source)}
                              disabled={savingTaskOptionId === `${task.source}:${task.id}`}
                            >
                              {savingTaskOptionId === `${task.source}:${task.id}` ? "Saving..." : "Save edit"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3 text-xs"
                              onClick={cancelEditingTaskOption}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={() => startEditingTaskOption(task.id, task.source, task.text)}
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-xs text-destructive hover:text-destructive"
                          onClick={() => void deleteTaskOption(task.id, task.source)}
                          disabled={deletingTaskOptionId === `${task.source}:${task.id}`}
                        >
                          {deletingTaskOptionId === `${task.source}:${task.id}` ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>,
        document.body
      )
        : null}
      </>
      )}
    </div>
  );
}
