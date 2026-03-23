"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthReady } from "@/hooks/useAuthReady";
import { homeworkApi, type HomeworkApiError, type SelfRatingResponse } from "@/lib/api/homework-client";
import type {
  HomeworkSessionStatus,
  HomeworkReportResponse,
  HomeworkResponse,
  AssignedExercise,
} from "@/lib/api/types-homework";
import {
  deriveHomeworkStep,
  getStatusToHomeworkResponse,
  toPublicStatus,
  type Step as StepType,
  type PublicHomeworkStatus,
} from "@/lib/api/types-homework";
import ProgressOverSessionsChart from "@/components/homework/ProgressOverSessionsChart";
import HomeworkReportsModal from "@/components/homework/HomeworkReportsModal";
import CompactReportPreviewCard from "@/components/reports/CompactReportPreviewCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AudioRecorder from "@/components/recording/AudioRecorder";
import type { LiveCoachSnapshot, UserSniperProfile } from "@/lib/sniper/types";
import type { CompactReportPreview } from "@/lib/reports/compact-preview";
import { toCompactReportPreview } from "@/lib/reports/compact-preview";
import { Play, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useRecordingContext } from "@/components/dashboard/DashboardShell";
import Lottie from "lottie-react";

/** Default task prompt when the backend assigns none. */
const DEFAULT_TASK_PROMPT = "How was your day so far?";

/** Default exercise shown on step 0 when the student has no assigned exercises (e.g. new user / nothing set in admin). */
const DEFAULT_INTRO_EXERCISE: AssignedExercise = {
  id: "0-intro",
  title: "Intro",
  description: null,
  video_url: "https://vimeo.com/1169874052?fl=ip&fe=ec",
};

function getSniperProfileFromReport(
  report: HomeworkReportResponse,
  existingProfile: UserSniperProfile | null
): UserSniperProfile | null {
  const nestedProfile = report.sniper_profile;
  const realtimeLevel =
    report.realtime_level ?? nestedProfile?.realtime_level ?? existingProfile?.realtime_level ?? null;
  const realtimeStep =
    report.realtime_step ?? nestedProfile?.realtime_step ?? existingProfile?.realtime_step ?? null;
  const realtimePitchBaselineSt =
    nestedProfile?.realtime_pitch_baseline_st ?? existingProfile?.realtime_pitch_baseline_st ?? null;
  const sessionsWithPitchCount =
    nestedProfile?.sessions_with_pitch_count ?? existingProfile?.sessions_with_pitch_count;

  if (
    realtimeLevel == null &&
    realtimeStep == null &&
    realtimePitchBaselineSt == null &&
    sessionsWithPitchCount == null &&
    !nestedProfile?.user_id &&
    !existingProfile
  ) {
    return null;
  }

  return {
    user_id: nestedProfile?.user_id ?? existingProfile?.user_id ?? "unknown",
    session_count: existingProfile?.session_count ?? 0,
    sessions_with_energy_count: existingProfile?.sessions_with_energy_count ?? 0,
    sessions_with_pitch_count: sessionsWithPitchCount,
    baseline_wpm: existingProfile?.baseline_wpm ?? null,
    baseline_pause_ms: existingProfile?.baseline_pause_ms ?? null,
    baseline_dynamic_db: existingProfile?.baseline_dynamic_db ?? null,
    baseline_emphasis_per_min: existingProfile?.baseline_emphasis_per_min ?? null,
    baseline_energy_ratio: existingProfile?.baseline_energy_ratio ?? null,
    realtime_level: realtimeLevel ?? undefined,
    realtime_step: realtimeStep ?? undefined,
    realtime_pitch_baseline_st: realtimePitchBaselineSt,
    baseline_pitch_range_st: existingProfile?.baseline_pitch_range_st ?? null,
    baseline_fatigue_sec: existingProfile?.baseline_fatigue_sec ?? null,
    created_at: existingProfile?.created_at ?? "",
    updated_at: nestedProfile?.updated_at ?? existingProfile?.updated_at ?? "",
  };
}

function getSniperProfileFromStatusPayload(
  status:
    | HomeworkSessionStatus
    | HomeworkResponse
    | null
    | undefined,
  existingProfile: UserSniperProfile | null
): UserSniperProfile | null {
  const nestedProfile = status?.sniper_profile;
  const realtimeLevel =
    status?.realtime_level ?? nestedProfile?.realtime_level ?? existingProfile?.realtime_level ?? null;
  const realtimeStep =
    status?.realtime_step ?? nestedProfile?.realtime_step ?? existingProfile?.realtime_step ?? null;
  const realtimePitchBaselineSt =
    nestedProfile?.realtime_pitch_baseline_st ?? existingProfile?.realtime_pitch_baseline_st ?? null;
  const sessionsWithPitchCount =
    nestedProfile?.sessions_with_pitch_count ?? existingProfile?.sessions_with_pitch_count;

  if (
    realtimeLevel == null &&
    realtimeStep == null &&
    realtimePitchBaselineSt == null &&
    sessionsWithPitchCount == null &&
    !nestedProfile?.user_id &&
    !existingProfile
  ) {
    return null;
  }

  return {
    user_id: nestedProfile?.user_id ?? existingProfile?.user_id ?? "unknown",
    session_count: existingProfile?.session_count ?? 0,
    sessions_with_energy_count: existingProfile?.sessions_with_energy_count ?? 0,
    sessions_with_pitch_count: sessionsWithPitchCount,
    baseline_wpm: existingProfile?.baseline_wpm ?? null,
    baseline_pause_ms: existingProfile?.baseline_pause_ms ?? null,
    baseline_dynamic_db: existingProfile?.baseline_dynamic_db ?? null,
    baseline_emphasis_per_min: existingProfile?.baseline_emphasis_per_min ?? null,
    baseline_energy_ratio: existingProfile?.baseline_energy_ratio ?? null,
    realtime_level: realtimeLevel ?? undefined,
    realtime_step: realtimeStep ?? undefined,
    realtime_pitch_baseline_st: realtimePitchBaselineSt,
    baseline_pitch_range_st: existingProfile?.baseline_pitch_range_st ?? null,
    baseline_fatigue_sec: existingProfile?.baseline_fatigue_sec ?? null,
    created_at: existingProfile?.created_at ?? "",
    updated_at: nestedProfile?.updated_at ?? existingProfile?.updated_at ?? "",
  };
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resolveTaskText(text: string | null | undefined): string {
  return (text ?? "").trim() || DEFAULT_TASK_PROMPT;
}

/** Return at most the first 2 sentences of text (by ., !, ?). */
function firstTwoSentences(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const match = t.match(/^(.+?[.!?])\s*(.+?[.!?])?[\s\S]*/);
  if (match) {
    const second = (match[2] ?? "").trim();
    return second ? `${match[1].trim()} ${second}`.trim() : match[1].trim();
  }
  return t;
}

/** Format filler_words_count.breakdown for display (e.g. "um: 3, like: 2"). */
function formatFillerBreakdown(breakdown: Record<string, number> | undefined): string {
  if (!breakdown || typeof breakdown !== "object") return "";
  return Object.entries(breakdown)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([word, n]) => `${word}: ${n}`)
    .join(", ");
}

/** Extract Vimeo video id from vimeo.com/123, vimeo.com/video/123, or player.vimeo.com/video/123. */
function parseVimeoId(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  try {
    const match = u.match(/(?:vimeo\.com\/video\/|vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Display title for an assigned exercise: avoid showing raw id (e.g. "0-intro"); prefer title or friendly label. */
function exerciseDisplayTitle(ex: AssignedExercise): string {
  const t = (ex.title ?? "").trim();
  if (t && t !== ex.id) return t;
  if (ex.id === "0-intro") return "Intro";
  return t || ex.id || "Exercise";
}

function normalizePercentScore(v: number | null | undefined): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.round(v <= 1 ? v * 100 : v);
}

type Step = StepType;

/** Coerce API value to string; backend may send { id, text } instead of a plain string. */
function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "text" in v) {
    const t = (v as { text: unknown }).text;
    return typeof t === "string" ? t : String(t ?? "");
  }
  return String(v);
}

/** Stable string id for keys and state; backend may send id as object. */
function toId(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "id" in v) {
    const id = (v as { id: unknown }).id;
    return typeof id === "string" ? id : String(id ?? "");
  }
  return String(v);
}

// One auto-start per page load (avoids double request in React Strict Mode). Reset when user finishes and goes to dashboard so next visit starts fresh.
let autoStartAttempted = false;
function resetAutoStartAttempted() {
  autoStartAttempted = false;
}

const STEP0_REPORTS_PAGE_SIZE = 5;
const FINAL_REPORT_STORAGE_KEY = "homeworkReport";
const REVIEW_PENDING_DEFAULT_MESSAGE =
  "Artur is analysing your homework and will send you the grading and comment soon. If you pass, we will see each other in the next step!";

type PersistedFinalReportState = {
  sessionId: string;
  reportData: HomeworkReportResponse | null;
  performanceScoreEnd: number | null;
  reportText: string;
  localTranscript: string;
  coachMessageAfterHomework: string | null;
  tutorFeedbackDeadlineMs: number | null;
};

function readPersistedFinalReportState(): PersistedFinalReportState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(FINAL_REPORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedFinalReportState>;
    if (!parsed || typeof parsed.sessionId !== "string" || !parsed.sessionId.trim()) {
      return null;
    }
    return {
      sessionId: parsed.sessionId.trim(),
      reportData: parsed.reportData ?? null,
      performanceScoreEnd: typeof parsed.performanceScoreEnd === "number" ? parsed.performanceScoreEnd : null,
      reportText: typeof parsed.reportText === "string" ? parsed.reportText : "",
      localTranscript: typeof parsed.localTranscript === "string" ? parsed.localTranscript : "",
      coachMessageAfterHomework:
        typeof parsed.coachMessageAfterHomework === "string" && parsed.coachMessageAfterHomework.trim()
          ? parsed.coachMessageAfterHomework
          : null,
      tutorFeedbackDeadlineMs:
        typeof parsed.tutorFeedbackDeadlineMs === "number" && Number.isFinite(parsed.tutorFeedbackDeadlineMs)
          ? parsed.tutorFeedbackDeadlineMs
          : null,
    };
  } catch {
    return null;
  }
}

function persistFinalReportState(state: PersistedFinalReportState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(FINAL_REPORT_STORAGE_KEY, JSON.stringify(state));
}

function clearPersistedFinalReportState() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(FINAL_REPORT_STORAGE_KEY);
}

function maxStep(a: Step, b: Step): Step {
  return Math.max(a, b) as Step;
}

function isNoWarmupError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "NO_WARMUP_CONFIGURED";
}

function isInvalidSessionStateError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "INVALID_SESSION_STATE";
}

function isReportNotReadyError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "REPORT_NOT_READY";
}

function isSelfRatingNotReadyError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const msg = e.message.toLowerCase();
  return (
    msg.includes("self-rating") &&
    (msg.includes("only available") || msg.includes("not ready") || msg.includes("delivered your recording"))
  );
}

function StepFlowWrapper({
  step,
  syncingBehind,
  children,
}: {
  step: Step;
  syncingBehind?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full space-y-4 animate-fade-in flex flex-col items-center">
      {syncingBehind && (
        <p className="text-center text-sm text-muted-foreground">Syncing…</p>
      )}
      <div className="w-full flex flex-col items-center">{children}</div>
    </div>
  );
}

export default function HomeworkFlowCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authReady = useAuthReady();
  const { setRecordingActive, setShowNavbar } = useRecordingContext();
  const [step, setStep] = useState<Step>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [task, setTask] = useState("");
  /** Final task prompt for recording 2. Set when backend returns final_task_ready status. */
  const [finalTask, setFinalTask] = useState("");
  const [reportText, setReportText] = useState("");
  const [performanceScoreEnd, setPerformanceScoreEnd] = useState<number | null>(null);
  /** Fetched report for final score step (step 3). */
  const [reportData, setReportData] = useState<HomeworkReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  /** Live-transcribed text from Web Speech API (set immediately when recording stops). */
  const [localTranscript, setLocalTranscript] = useState("");
  /** Ref mirror of localTranscript — readable synchronously inside handleRecordingComplete (state is batched). */
  const localTranscriptRef = useRef("");
  /** Backend returned 404 with REPORT_NOT_READY (report still generating). Show "generating" UI and auto-refresh. */
  const [reportNotReady, setReportNotReady] = useState(false);
  const [reportRetryCount, setReportRetryCount] = useState(0);
  /** True when the <audio> element fires onError (valid URL but file unplayable/missing). */
  const [audioPlaybackError, setAudioPlaybackError] = useState(false);
  /** Loading Lottie animation data (fetched once for step 3). */
  const [loadingLottieData, setLoadingLottieData] = useState<object | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** When true, the step-2 Continue action is disabled because recording-1 analysis failed. */
  const [metricStepBlockedByRecordingFailure, setMetricStepBlockedByRecordingFailure] = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState<1 | 2 | null>(null);
  const [noWarmupConfigured, setNoWarmupConfigured] = useState(false);
  const [statusUnknown, setStatusUnknown] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncingBehind, setSyncingBehind] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const metricSubmitInProgress = useRef(false);
  const uploadRecording1InProgressRef = useRef(false);
  const uploadRecording2InProgressRef = useRef(false);
  /** When set, user just finished a lesson (step 3 → 0); show tutor countdown notice on step 0. Cleared when they click Start homework. */
  const [tutorFeedbackDeadlineMs, setTutorFeedbackDeadlineMs] = useState<number | null>(null);
  /** When no active session: message from backend (e.g. tutor warning). Show as info banner on step 0. */
  const [tutorFeedbackMessage, setTutorFeedbackMessage] = useState<string | null>(null);
  /** When true, step 0 should show the coach-review waiting state instead of the assignment/video card. */
  const [reviewPending, setReviewPending] = useState(false);
  const [mainScreenMessage, setMainScreenMessage] = useState<string | null>(null);
  /** Message from coach to the student for this homework (e.g. after assignment). Shown when step >= 1; no video. From tutor_video_description. */
  const [coachMessageAfterHomework, setCoachMessageAfterHomework] = useState<string | null>(null);
  /** When step 0 and has_active_session false: exercises assigned to this student (from GET status assigned_exercises). */
  const [assignedExercises, setAssignedExercises] = useState<AssignedExercise[]>([]);
  /** When set, show modal with iframe for this video URL (non-Vimeo links). */
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  /** Live coach snapshot captured when recording completed with sniperMode. Shown on report step. */
  const [sniperSnapshot, setSniperSnapshot] = useState<LiveCoachSnapshot | null>(null);
  const sniperSnapshotRef = useRef<LiveCoachSnapshot | null>(null);
  /** User sniper profile (adaptive baseline). Fetched on load; updated after session end POST. */
  const [sniperProfile, setSniperProfile] = useState<UserSniperProfile | null>(null);
  /** True once student has submitted "How did that feel?" rating (or skipped). Hides rating UI and avoids double submit. */
  const [studentSpeechRatingSubmitted, setStudentSpeechRatingSubmitted] = useState(false);
  /** Loading state when submitting student speech rating. */
  const [savingStudentRating, setSavingStudentRating] = useState(false);
  /** Terminal state from backend: recording_1 processing failed, so report cannot be generated for this session. */
  const [recordingProcessingFailed, setRecordingProcessingFailed] = useState(false);
  /** When self-rating returned session_completed: false, retry POST self-rating after job is done (poll status then call again). */
  const [pendingRetrySelfRating, setPendingRetrySelfRating] = useState<
    { sessionId: string; rating: number } | { sessionId: string; skipped: true } | null
  >(null);
  /** Last rating/skip we sent on step 2; used to retry self-rating when GET report returns 409 REPORT_NOT_READY (session still completing_from_recording_1). */
  const lastSelfRatingPayloadRef = useRef<
    { sessionId: string; rating: number } | { sessionId: string; skipped: true } | null
  >(null);
  const hasSetPendingRetryFrom409Ref = useRef(false);
  useEffect(() => {
    if (!videoModalUrl) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setVideoModalUrl(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [videoModalUrl]);
  /** Ticker so countdown re-renders every second when tutor deadline is shown. */
  const [countdownTick, setCountdownTick] = useState(0);
  /** When true, show modal with a single report (list is on the page). */
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  /** Session id for the report shown in the modal (from clicking a report card). */
  const [reportModalSessionId, setReportModalSessionId] = useState<string | null>(null);
  /** Step 0: list of past sessions for Reports History (same source as admin). Hidden until "View reports" is clicked. */
  const [step0Sessions, setStep0Sessions] = useState<Array<{ id: string; created_at?: string; completed_at?: string; status?: string; coach_grade?: number | null; recording_id?: string; report_id?: string; report_delivered?: boolean | null; student_completion_email_sent_at?: string | null; report_preview?: { report_text_preview?: string } }>>([]);
  const [step0SessionsLoading, setStep0SessionsLoading] = useState(false);
  /** Step 0: when true, show the Reports History list (fetched on first "View reports" click). */
  const [showReportsList, setShowReportsList] = useState(false);
  const [visibleReportsCount, setVisibleReportsCount] = useState(STEP0_REPORTS_PAGE_SIZE);
  const [step0ReportPreviews, setStep0ReportPreviews] = useState<Record<string, CompactReportPreview | null>>({});
  const [step0ReportPreviewLoading, setStep0ReportPreviewLoading] = useState<Record<string, boolean>>({});
  /** After finishing a session, briefly poll sessions list on step 0 so the new report appears without manual retries. */
  const [pollReportsAfterFinish, setPollReportsAfterFinish] = useState(false);
  /** Deep-link guard: handle query-triggered report auto-open only once per page load. */
  const reportDeepLinkHandledRef = useRef(false);
  /** Legacy ref kept for compatibility with old status payloads. */
  const skipStep2ToReportDoneRef = useRef(false);
  /** Mirror of step for use inside applyStatusToState (so we never downgrade step when applying backend response). */
  const stepRef = useRef(step);
  stepRef.current = step;
  const persistedFinalReportRef = useRef<PersistedFinalReportState | null>(
    typeof window === "undefined" ? null : readPersistedFinalReportState()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const refreshSniperProfile = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch("/api/user/sniper-profile", signal ? { signal } : undefined);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to load sniper profile");
      const data = await response.json().catch(() => null);
      if (data && typeof data.user_id === "string") {
        setSniperProfile(data);
        return data;
      }
      return null;
    },
    []
  );

  const syncDashboardStateFromStatus = useCallback(
    (statusRes: HomeworkSessionStatus | null | undefined) => {
      const deadlineIso = statusRes?.tutor_feedback_deadline;
      if (deadlineIso && typeof deadlineIso === "string") {
        const ms = new Date(deadlineIso).getTime();
        setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
      } else {
        setTutorFeedbackDeadlineMs(null);
      }

      const feedbackMessage = statusRes?.tutor_feedback_message;
      setTutorFeedbackMessage(
        typeof feedbackMessage === "string" && feedbackMessage.trim()
          ? feedbackMessage.trim()
          : null
      );

      setReviewPending(statusRes?.review_pending === true);
      const waitingMessage = statusRes?.main_screen_message;
      setMainScreenMessage(
        typeof waitingMessage === "string" && waitingMessage.trim()
          ? waitingMessage.trim()
          : null
      );

      if (Array.isArray(statusRes?.assigned_exercises)) {
        setAssignedExercises(statusRes.assigned_exercises);
      } else {
        setAssignedExercises([]);
      }

      setSniperProfile((prev) => getSniperProfileFromStatusPayload(statusRes, prev) ?? prev);
    },
    []
  );

  const restorePersistedFinalReport = useCallback((persisted: PersistedFinalReportState | null): boolean => {
    if (!persisted?.sessionId) return false;
    setSessionId(persisted.sessionId);
    setReportData(persisted.reportData);
    setPerformanceScoreEnd(persisted.performanceScoreEnd);
    setReportText(persisted.reportText);
    setLocalTranscript(persisted.localTranscript);
    localTranscriptRef.current = persisted.localTranscript;
    setCoachMessageAfterHomework(persisted.coachMessageAfterHomework);
    setReportError(null);
    setReportNotReady(false);
    setRecordingProcessingFailed(false);
    if (persisted.tutorFeedbackDeadlineMs && persisted.tutorFeedbackDeadlineMs > Date.now()) {
      setTutorFeedbackDeadlineMs(persisted.tutorFeedbackDeadlineMs);
    }
    setStep(4);
    return true;
  }, []);

  const clearSessionCommunication = useCallback(() => {
    setCoachMessageAfterHomework(null);
    setTutorFeedbackDeadlineMs(null);
    setTutorFeedbackMessage(null);
    setReviewPending(false);
    setMainScreenMessage(null);
  }, []);

  /** Refetch status and backend-owned realtime step on step 0 so newly assigned homework can unlock the next step. */
  useEffect(() => {
    if (!authReady || step !== 0) return;
    homeworkApi.getStatus().then((statusRes) => {
      syncDashboardStateFromStatus(statusRes);
    }).catch((err) => {
      setTutorFeedbackDeadlineMs(null);
      setTutorFeedbackMessage(null);
      setReviewPending(false);
      setMainScreenMessage(null);
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[HomeworkFlow] Step 0 status refetch failed (timer may not show):", err);
      }
    });
  }, [authReady, step, syncDashboardStateFromStatus]);

  /** Fetch delivered reports list from backend. Called when user first clicks "View reports". */
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

  // After finishing a session and returning to step 0, poll reports briefly so the newly completed session appears.
  useEffect(() => {
    if (step !== 0 || !pollReportsAfterFinish) return;
    let attempts = 0;
    const maxAttempts = 10; // ~30s
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

  // Keep reports fresh while the step-0 list is visible so newly completed sessions
  // appear without requiring logout/reload.
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

  useEffect(() => {
    if (pollReportsAfterFinish && step0Sessions.length > 0) {
      setPollReportsAfterFinish(false);
    }
  }, [pollReportsAfterFinish, step0Sessions.length]);

  useEffect(() => {
    if (!showReportsList) return;
    setVisibleReportsCount(STEP0_REPORTS_PAGE_SIZE);
  }, [showReportsList]);

  /** Deep-link support from completion email:
   *  /dashboard?showReports=1&openReportSessionId=<sessionId>
   *  - force step 0 reports list visible
   *  - fetch reports
   *  - auto-open the target report modal
   */
  useEffect(() => {
    if (step !== 0 || reportDeepLinkHandledRef.current) return;
    const shouldShowReports = searchParams.get("showReports");
    const targetSessionId = searchParams.get("openReportSessionId");
    if (shouldShowReports !== "1" && !targetSessionId) return;

    reportDeepLinkHandledRef.current = true;
    setShowReportsList(true);
    fetchStep0Reports();

    if (targetSessionId && targetSessionId.trim()) {
      setReportModalSessionId(targetSessionId.trim());
      setReportsModalOpen(true);
    }
  }, [step, searchParams, fetchStep0Reports]);

  /** Countdown ticker: update every second when showing tutor deadline. When time runs out, clear the notice. */
  useEffect(() => {
    if (tutorFeedbackDeadlineMs == null) return;
    const id = setInterval(() => {
      if (Date.now() >= tutorFeedbackDeadlineMs) {
        setTutorFeedbackDeadlineMs(null);
      } else {
        setCountdownTick((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [tutorFeedbackDeadlineMs]);

  /** While on step 0 with timer showing, poll session/status so we hide the timer when backend clears tutor_feedback_deadline (e.g. tutor sent feedback). Also refresh tutor_feedback_message. */
  const TUTOR_DEADLINE_POLL_INTERVAL_MS = 45_000;
  useEffect(() => {
    if (!authReady || step !== 0 || tutorFeedbackDeadlineMs == null) return;
    const id = setInterval(() => {
      homeworkApi.getStatus().then((statusRes) => {
        syncDashboardStateFromStatus(statusRes);
      }).catch(() => {});
    }, TUTOR_DEADLINE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authReady, step, syncDashboardStateFromStatus, tutorFeedbackDeadlineMs]);

  /** Show navbar on step 0 (start), step 2 (self-rate), and step 3 (score); hide on step 1. */
  useEffect(() => {
    setShowNavbar(step === 0 || step === 2 || step === 3 || step === 4);
  }, [step, setShowNavbar]);

  /** Clear recording context when not on step 1 (record). Step 3 removed. */
  useEffect(() => {
    if (step !== 1) setRecordingActive(false);
  }, [step, setRecordingActive]);


  /** Single state projection from backend response. Step is only set to 0 when status is "none". Steps 1, 2, 3 are only reached by user flow: Start → 1, recording done → 2, self-rating done → 3. */
  const applyStatusToState = (res: HomeworkResponse) => {
    const status: PublicHomeworkStatus = res.status ?? "none";
    if (status === "none") {
      setStep(0);
    }
    setStatusUnknown(false);
    setError(null);

    if (res.session_id != null) setSessionId(res.session_id);
    if (status === "none") {
      setSessionId(null);
      setTask("");
      setReportText("");
      setPerformanceScoreEnd(null);
      setReportData(null);
      setReviewPending(res.review_pending === true);
      setMainScreenMessage(
        typeof res.main_screen_message === "string" && res.main_screen_message.trim()
          ? res.main_screen_message.trim()
          : null
      );
      // Do not clear tutorFeedbackDeadlineMs / tutorFeedbackMessage here; step 0 effect and handleStartOver's getStatus() set them from API (so timer can persist when coming from step 3 score)
      setCoachMessageAfterHomework(null);
      setFinalTask("");
      // Do not clear assignedExercises here; step 0 effect will refetch and set from GET status
      skipStep2ToReportDoneRef.current = false;
      setReportFromRecording1Only(false);
      setPendingRetrySelfRating(null);
      hasSetPendingRetryFrom409Ref.current = false;
      setRecordingProcessingFailed(false);
      setLocalTranscript("");
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      return;
    }

    setReviewPending(false);
    setMainScreenMessage(null);
    if ("task" in res && res.task !== undefined) {
      setTask(resolveTaskText(res.task));
    }
    if ("performance_score_2" in res && res.performance_score_2 !== undefined) setPerformanceScoreEnd(res.performance_score_2);
    if ("report_text" in res && res.report_text !== undefined) setReportText(res.report_text ?? "");
    if ("performance_score_end" in res && res.performance_score_end !== undefined) setPerformanceScoreEnd(res.performance_score_end);
    if ("tutor_feedback_deadline" in res) {
      const deadlineIso = res.tutor_feedback_deadline;
      if (deadlineIso && typeof deadlineIso === "string") {
        const ms = new Date(deadlineIso).getTime();
        setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
      } else {
        setTutorFeedbackDeadlineMs(null);
      }
    } else {
      setTutorFeedbackDeadlineMs(null);
    }
    if ("tutor_feedback_message" in res) {
      const msg = res.tutor_feedback_message;
      setTutorFeedbackMessage(typeof msg === "string" && msg.trim() ? msg.trim() : null);
    }
    if ("tutor_video_description" in res) {
      const desc = res.tutor_video_description;
      setCoachMessageAfterHomework(typeof desc === "string" && desc.trim() ? desc.trim() : null);
    }
    if (Array.isArray(res.assigned_exercises)) {
      setAssignedExercises(res.assigned_exercises);
    }
    setSniperProfile((prev) => getSniperProfileFromStatusPayload(res, prev) ?? prev);
    if (status === "task_block" || status === "final_task_ready" || status === "post_questions") {
      setReportFromRecording1Only(true);
    }
    // When final task is ready, capture it as the recording-2 prompt
    if (status === "final_task_ready" && "task" in res && res.task) {
      setFinalTask(resolveTaskText(res.task));
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setStatusUnknown(false);
    try {
      const startRes = await homeworkApi.start();
      const taskFromStart =
        startRes.task ??
        (startRes as { warm_up_task?: { text?: string } }).warm_up_task?.text ??
        (startRes as { warm_up_task_text?: string }).warm_up_task_text ??
        "";
      applyStatusToState({
        status: "recording_1_required",
        session_id: startRes.session_id,
        task: taskFromStart || null,
      });
      setStep(1);
    } catch (e) {
      if (isNoWarmupError(e)) {
        setNoWarmupConfigured(true);
        setError(null);
        applyStatusToState({ status: "none" });
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to start practice";
      const isBackendUnavailable = msg.includes("not available yet") || msg.includes("404");
      if (isBackendUnavailable) {
        applyStatusToState({ status: "recording_1_required", session_id: "mock-session" });
        setTask("");
        setError(null);
        setStatusUnknown(false);
        setStep(1);
      } else {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  /** Reset the homework session: clear backend session, then single state projection to step 0. Do not call setStep outside applyStatusToState; use applyStatusToState({ status: "none" }). */
  const handleStartOver = async () => {
    if (resetting) return;
    setResetting(true);
    setSniperSnapshot(null);
    sniperSnapshotRef.current = null;
    setStudentSpeechRatingSubmitted(false);
    setSavingStudentRating(false);
    try {
      clearPersistedFinalReportState();
      persistedFinalReportRef.current = null;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      // Do not abandon a finished session when user leaves the final report screen (step 4),
      // otherwise some backends may mark it as abandoned and hide it from report lists.
      const shouldAbandonActiveSession = step !== 4;
      const shouldPollReports = step === 4;
      if (shouldAbandonActiveSession && sessionId && sessionId !== "mock-session") {
        try {
          await homeworkApi.abandonSession(sessionId);
        } catch (e) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn("[HomeworkFlow] abandonSession failed on reset", e);
          }
        }
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      metricSubmitInProgress.current = false;
      uploadRecording1InProgressRef.current = false;
      uploadRecording2InProgressRef.current = false;
      applyStatusToState({ status: "none" });
      setReportLoading(false);
      setReportError(null);
      setError(null);
      setNoWarmupConfigured(false);
      setStatusUnknown(false);
      setLoading(false);
      setUploadingRecording(null);
      setMetricStepBlockedByRecordingFailure(false);
      if (shouldPollReports) {
        setPollReportsAfterFinish(true);
        setReviewPending(true);
        setMainScreenMessage((prev) => prev ?? REVIEW_PENDING_DEFAULT_MESSAGE);
      }
      // Refetch status after navigating to step 0 so the waiting/review state and countdown can update immediately.
      homeworkApi.getStatus().then((statusRes) => {
        syncDashboardStateFromStatus(statusRes);
      }).catch((err) => {
        setTutorFeedbackDeadlineMs(null);
        setTutorFeedbackMessage(null);
        setReviewPending(false);
        setMainScreenMessage(null);
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[HomeworkFlow] Status refetch after Send to coach failed:", err);
        }
      });
    } finally {
      setResetting(false);
    }
  };

  /** Abandon current session. Treat 200 and 404 as success; in both cases run applyStatusToState({ status: "none" }). Do not call GET status after abandon. */
  const handleAbandon = async () => {
    if (!sessionId || sessionId === "mock-session") {
      handleStartOver();
      return;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    uploadRecording1InProgressRef.current = false;
    setLoading(true);
    setError(null);
    try {
      const result = await homeworkApi.abandonSession(sessionId);
      if (result.message?.toLowerCase().includes("not found") || result.message?.toLowerCase().includes("already cleared")) {
        toast.success("Session was already cleared. You can start a new session.");
      } else {
        toast.success("Session abandoned. You can start a new session.");
      }
    } catch (e) {
      if (isSessionGoneError(e)) {
        toast.success("Session was already cleared. You can start a new session.");
      } else {
        // Optimistic abandon: clear local state so user can always start a new session even if the server errors
        toast.success("Session cleared. You can start a new session.");
        setError(null);
      }
    }
    metricSubmitInProgress.current = false;
    uploadRecording1InProgressRef.current = false;
    clearSessionCommunication();
    clearPersistedFinalReportState();
    persistedFinalReportRef.current = null;
    applyStatusToState({ status: "none" });
    setLoading(false);
    setMetricStepBlockedByRecordingFailure(false);
  };

  /** Local-only reset when session is already gone (e.g. 404). Uses same projection as abandon. */
  const startOverFromScratch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    metricSubmitInProgress.current = false;
    uploadRecording1InProgressRef.current = false;
    skipStep2ToReportDoneRef.current = false;
    clearSessionCommunication();
    clearPersistedFinalReportState();
    persistedFinalReportRef.current = null;
    applyStatusToState({ status: "none" });
    setMetricStepBlockedByRecordingFailure(false);
  };

  /** True if error indicates session is gone (404 / SESSION_NOT_FOUND or message). */
  const isSessionGoneError = (e: unknown) => {
    const err = e as { code?: string; message?: string; status?: number };
    const msg = (err.message ?? "").toLowerCase();
    return (
      err.code === "SESSION_NOT_FOUND" ||
      err.status === 404 ||
      msg.includes("session not found") ||
      msg.includes("no active session")
    );
  };

  // Cold load: restore the visible step from backend session state.
  useEffect(() => {
    if (!authReady || step !== 0 || autoStartAttempted) return;
    autoStartAttempted = true;
    setLoading(true);
    let cancelled = false;
    homeworkApi
      .getStatus()
      .then((statusRes) => {
        if (cancelled) return;
        if (!statusRes || statusRes.has_active_session === false) {
          if (restorePersistedFinalReport(persistedFinalReportRef.current)) {
            syncDashboardStateFromStatus(statusRes);
            return;
          }
          applyStatusToState(getStatusToHomeworkResponse(statusRes ?? { status: "none" }));
          syncDashboardStateFromStatus(statusRes);
          return;
        }
        applyStatusToState(getStatusToHomeworkResponse(statusRes));
        setStep(deriveHomeworkStep(statusRes));
        syncDashboardStateFromStatus(statusRes);
      })
      .catch((e) => {
        if (cancelled) return;
        if (isNoWarmupError(e)) {
          setNoWarmupConfigured(true);
          setError(null);
          applyStatusToState({ status: "none" });
        } else {
          setError("Could not load session. Click Start Your Practice to begin.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [authReady, step, syncDashboardStateFromStatus]);

  // Tab refocus: refresh the active homework state and pull any coach-controlled step unlocks.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (stepRef.current === 3 || stepRef.current === 4) return;
      if (stepRef.current === 0) {
        homeworkApi.getStatus().then((statusRes) => {
          syncDashboardStateFromStatus(statusRes);
        }).catch(() => {});
        return;
      }
      homeworkApi.getStatus().then((res) => {
        if (!res) return;
        applyStatusToState(getStatusToHomeworkResponse(res));
        setStep((prev) => maxStep(prev, deriveHomeworkStep(res)));
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [syncDashboardStateFromStatus]);

  useEffect(() => {
    if (step !== 4 || !sessionId || sessionId === "mock-session") return;
    const nextState: PersistedFinalReportState = {
      sessionId,
      reportData,
      performanceScoreEnd,
      reportText,
      localTranscript,
      coachMessageAfterHomework,
      tutorFeedbackDeadlineMs,
    };
    persistFinalReportState(nextState);
    persistedFinalReportRef.current = nextState;
  }, [
    coachMessageAfterHomework,
    localTranscript,
    performanceScoreEnd,
    reportData,
    reportText,
    sessionId,
    step,
    tutorFeedbackDeadlineMs,
  ]);

  const [reportFromRecording1Only, setReportFromRecording1Only] = useState(false);
  // Legacy step-4/old-flow effects removed; active flow is step 0 → 1 → 2 → 3.

  // Coach is notified by the backend when self-rating (or skip) is saved; no separate notify-lesson-complete call.

  // Fetch report when on step 4 with a real session (single source of truth for player + scores + text)
  useEffect(() => {
    if (step !== 4 || !sessionId || sessionId === "mock-session") return;
    setReportLoading(true);
    setReportError(null);
    setReportNotReady(false);
    setAudioPlaybackError(false);
    homeworkApi
      .getReport(sessionId)
      .then((data) => {
        setReportData(data);
        setSniperProfile((prev) => getSniperProfileFromReport(data, prev) ?? prev);
        setReportError(null);
        setReportNotReady(false);
        setPendingRetrySelfRating(null);
        hasSetPendingRetryFrom409Ref.current = false;
        // So the tutor countdown can show on step 0 after "Send homework to coach" (incl. first-time completers if backend sends deadline in report)
        const deadlineIso = (data as { tutor_feedback_deadline?: string | null }).tutor_feedback_deadline;
        if (deadlineIso && typeof deadlineIso === "string") {
          const ms = new Date(deadlineIso).getTime();
          if (Number.isFinite(ms) && ms > Date.now()) setTutorFeedbackDeadlineMs(ms);
        }
      })
      .catch((e) => {
        if (isSessionGoneError(e)) {
          toast.info("Your session is gone. You can start a new lesson.");
          startOverFromScratch();
          return;
        }
        const is404 = (e as HomeworkApiError).status === 404;
        if (isReportNotReadyError(e) || is404) {
          setReportNotReady(true);
          setReportError(null);
          setReportData(null);
          const payload = lastSelfRatingPayloadRef.current;
          if (payload && payload.sessionId === sessionId && !hasSetPendingRetryFrom409Ref.current) {
            hasSetPendingRetryFrom409Ref.current = true;
            setPendingRetrySelfRating(payload);
          }
          return;
        }
        const msg = e instanceof Error ? e.message : "Failed to load report";
        setReportError(msg);
        setReportData(null);
      })
      .finally(() => setReportLoading(false));
  }, [reportRetryCount, sessionId, step]);

  // Load Lottie animation for report loading / generating states
  useEffect(() => {
    if (step !== 4 || loadingLottieData != null) return;
    fetch("/animations/loading.json")
      .then((r) => r.json())
      .then(setLoadingLottieData)
      .catch(() => {});
  }, [step, loadingLottieData]);

  useEffect(() => {
    if (step !== 4 || !sessionId || sessionId === "mock-session") return;
    if (!reportData || (reportData.coach_insight ?? "").trim()) return;

    let attempts = 0;
    const maxAttempts = 6;
    const intervalMs = 8000;
    const id = setInterval(() => {
      attempts += 1;
      homeworkApi
        .getReport(sessionId)
        .then((data) => {
          setReportData(data);
          if ((data.coach_insight ?? "").trim()) {
            clearInterval(id);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (attempts >= maxAttempts) clearInterval(id);
        });
    }, intervalMs);

    return () => clearInterval(id);
  }, [reportData, sessionId, step]);

  // When report is still being generated, poll automatically (no user click).
  // Also check session/status for terminal recording_1 failure so we can stop spinning forever.
  useEffect(() => {
    if (!reportNotReady || !sessionId || sessionId === "mock-session") return;
    const intervalMs = 5000;
    const id = setInterval(async () => {
      setReportRetryCount((c) => c + 1);
      try {
        const statusRes = await homeworkApi.getStatus();
        const raw = statusRes as HomeworkSessionStatus & {
          session?: { recording_1_processing_status?: string };
          recording_1_processing_status?: string;
        };
        const processingFailed =
          raw?.recording_1_processing_status === "failed" ||
          (typeof raw?.session === "object" && raw.session?.recording_1_processing_status === "failed");
        if (processingFailed) setRecordingProcessingFailed(true);
      } catch {
        // ignore transient status errors while polling
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [reportNotReady, sessionId]);

  // Step 2 is intentionally actionable right away (rate now, backend can complete asynchronously).
  // We only poll status here to detect terminal failure in recording_1 processing.
  useEffect(() => {
    if (step !== 2 || !sessionId || sessionId === "mock-session") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const statusRes = await homeworkApi.getStatus();
        if (cancelled) return;
        const raw = statusRes as HomeworkSessionStatus & {
          session?: { recording_1_processing_status?: string };
          recording_1_processing_status?: string;
        };
        const processingFailed =
          raw?.recording_1_processing_status === "failed" ||
          (typeof raw?.session === "object" && raw.session?.recording_1_processing_status === "failed");
        if (processingFailed) setRecordingProcessingFailed(true);
      } catch {
        // ignore transient status errors on step 2
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, sessionId]);

  // When self-rating isn't accepted yet (or session_completed was false): poll GET session/status, then auto-submit self-rating.
  useEffect(() => {
    if ((step !== 2 && step !== 3 && step !== 4) || !pendingRetrySelfRating) return;
    const { sessionId: sid } = pendingRetrySelfRating;
    const intervalMs = 5000;
    const maxWaitMs = 120000; // 2 min then retry anyway
    const startedAt = Date.now();
    const poll = async () => {
      try {
        const statusRes = await homeworkApi.getStatus();
        const raw = statusRes as HomeworkSessionStatus & { recording_1_processing_status?: string };
        const processingStatus = raw?.recording_1_processing_status;
        const status = raw?.status ?? (raw as { session?: { status?: string } }).session?.status;
        if (processingStatus === "failed") {
          setRecordingProcessingFailed(true);
          setPendingRetrySelfRating(null);
          return;
        }
        const jobDone =
          (typeof processingStatus === "string" && processingStatus !== "pending") ||
          status === "completed" ||
          Date.now() - startedAt >= maxWaitMs;
        if (!jobDone) return;
        const payload = pendingRetrySelfRating;
        setPendingRetrySelfRating(null);
        if (payload && "rating" in payload) {
          await homeworkApi.submitSelfRating(sid, payload.rating);
        } else {
          await homeworkApi.submitSelfRatingSkipped(sid);
        }
        setStudentSpeechRatingSubmitted(true);
        setStep(4);
        setReportRetryCount((c) => c + 1);
      } catch {
        // keep polling
      }
    };
    const id = setInterval(poll, intervalMs);
    poll();
    return () => clearInterval(id);
  }, [step, pendingRetrySelfRating]);

  // Fetch sniper profile when on recording step (for adaptive baseline / growth).
  // Deferred and with timeout so a slow/hanging API never blocks the Record button.
  useEffect(() => {
    if (step !== 1) return;
    const timeoutMs = 8000;
    const delayMs = 300;
    const tid = setTimeout(() => {
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), timeoutMs);
      refreshSniperProfile(ac.signal)
        .catch(() => {})
        .finally(() => clearTimeout(timeoutId));
    }, delayMs);
    return () => clearTimeout(tid);
  }, [refreshSniperProfile, step]);

  const RECORDING_1_DURATION_MIN = 30;
  const RECORDING_2_DURATION_MIN = 62;
  const RECORDING_2_DURATION_MAX = 300;

  const persistFinalSessionSummary = useCallback(
    async (params: {
      sessionId: string;
      durationSeconds: number;
      recordingId?: string | null;
      studentRating1To10?: number | null;
    }) => {
      const snapshot = sniperSnapshotRef.current;
      if (!snapshot) return;
      const body: {
        session_means: {
          paceWpm: number | null;
          avgPauseMs: number | null;
          dynamicRangeDb: number | null;
          emphasisPerMin: number | null;
          energyRatio: number | null;
          voicedDurationSec: number;
          pitchCenterSt?: number | null;
          pitchFrameCount?: number | null;
        };
        stage_score: number;
        voiced_duration_sec: number;
        duration_seconds: number;
        recording_id?: string | null;
        frontend_level?: number | null;
        frontend_step?: number | null;
        completed: true;
        valid_for_progression: true;
        session_id: string;
        student_rating_1_10?: number | null;
      } = {
        session_means: {
          paceWpm: snapshot.wpm ?? null,
          avgPauseMs: null,
          dynamicRangeDb: null,
          emphasisPerMin: null,
          energyRatio: null,
          voicedDurationSec: snapshot.voicedDurationSec,
          pitchCenterSt: snapshot.pitchCenterSt ?? null,
          pitchFrameCount: snapshot.pitchFrameCount ?? null,
        },
        stage_score: snapshot.performanceScore,
        voiced_duration_sec: snapshot.voicedDurationSec,
        duration_seconds: params.durationSeconds,
        recording_id: params.recordingId ?? null,
        frontend_level: snapshot.realtimeLevel ?? null,
        frontend_step: snapshot.realtimeStep ?? null,
        completed: true,
        valid_for_progression: true,
        session_id: params.sessionId,
      };
      if (
        typeof params.studentRating1To10 === "number" &&
        params.studentRating1To10 >= 1 &&
        params.studentRating1To10 <= 10
      ) {
        body.student_rating_1_10 = params.studentRating1To10;
      }
      try {
        const response = await fetch("/api/user/sniper-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => null);
        if (data && typeof data.user_id === "string") {
          setSniperProfile(data);
        }
      } catch {
        // Non-blocking: summary persistence should never block the homework flow.
      }
    },
    []
  );

  /**
   * Unified recording completion handler for both recording steps.
   * The only differences between step 1 and step 2 are injected via the config:
   * which upload fn to call, which step to advance to, and which step to return to on error.
   */
  const handleRecordingComplete = async (
    blob: Blob,
    durationSeconds: number,
    config: {
      recordingNumber: 1 | 2;
      minDurationSeconds: number;
      stepOnSuccess: Step;
      stepOnError: Step;
      inProgressRef: React.MutableRefObject<boolean>;
      upload: (blob: Blob, dur: number, signal: AbortSignal) => Promise<unknown>;
      onSuccess?: (result: unknown) => Promise<void> | void;
    }
  ) => {
    const { recordingNumber, minDurationSeconds, stepOnSuccess, stepOnError, inProgressRef, upload, onSuccess } = config;

    if (durationSeconds < minDurationSeconds) {
      const label = recordingNumber === 1 ? "First" : "Final";
      const msg = `${label} recording must be at least ${minDurationSeconds} seconds. You recorded ${durationSeconds}s.`;
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!sessionId) return;
    if (inProgressRef.current) return;
    inProgressRef.current = true;
    if (typeof window !== "undefined") {
      console.warn(`[HomeworkFlow] handleRecordingComplete rec${recordingNumber}`, { step, sessionId: sessionId?.slice(0, 8) + "…", durationSeconds });
    }
    if (recordingNumber === 1 && sessionId === "mock-session") {
      inProgressRef.current = false;
      setError("Recording captured (preview only). Implement POST /v2/homework/start and POST /v2/homework/session/:id/recording-1 on your backend to save and continue.");
      return;
    }
    if (uploadingRecording === recordingNumber) {
      inProgressRef.current = false;
      return;
    }
    setUploadingRecording(recordingNumber);
    setError(null);
    abortRef.current = new AbortController();
    setStep(stepOnSuccess);

    try {
      const res = await upload(blob, durationSeconds, abortRef.current.signal);
      await onSuccess?.(res);
    } catch (e) {
      console.error(`[HomeworkFlow] handleRecordingComplete rec${recordingNumber} error`, e);
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      const msg = isInvalidSessionStateError(e)
        ? "Session state conflict. Please refresh the page or switch tab and back."
        : (e instanceof Error ? e.message : "Upload failed. Please try again.");
      setStep(stepOnError);
      setError(msg);
      toast.error(msg, { duration: 8000 });
    } finally {
      setUploadingRecording(null);
      abortRef.current = null;
      inProgressRef.current = false;
    }
  };

  // Per-step config — the only thing that changes between recording 1 and recording 2
  const onRecording1Complete = (blob: Blob, durationSeconds: number) =>
    handleRecordingComplete(blob, durationSeconds, {
      recordingNumber: 1,
      minDurationSeconds: RECORDING_1_DURATION_MIN,
      stepOnSuccess: 2,
      stepOnError: 1,
      inProgressRef: uploadRecording1InProgressRef,
      upload: (b, dur, signal) =>
        homeworkApi.uploadRecording1(
          sessionId!,
          b,
          dur,
          signal,
          localTranscriptRef.current || undefined,
          sniperSnapshotRef.current?.centerHoldRatio,
          sniperSnapshotRef.current?.centerHoldMs,
          sniperSnapshotRef.current?.totalActiveMs
        ),
      onSuccess: async (res) => {
        const backendStatus = (res as { status?: string }).status;
        const status: PublicHomeworkStatus =
          backendStatus && toPublicStatus(backendStatus) !== "none"
            ? toPublicStatus(backendStatus)
            : "recording_1_required";
        applyStatusToState({ status, session_id: sessionId });
        await persistFinalSessionSummary({
          sessionId: sessionId!,
          durationSeconds,
          recordingId: "recording_id" in (res as object) ? ((res as { recording_id?: string | null }).recording_id ?? null) : null,
        });
      },
    });

  const onRecording2Complete = (blob: Blob, durationSeconds: number) =>
    handleRecordingComplete(blob, durationSeconds, {
      recordingNumber: 2,
      minDurationSeconds: RECORDING_2_DURATION_MIN,
      stepOnSuccess: 4,
      stepOnError: 3,
      inProgressRef: uploadRecording2InProgressRef,
      upload: (b, dur, signal) => homeworkApi.uploadRecording2(sessionId!, b, dur, signal),
      onSuccess: async () => {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem("homeworkJustFinishedRecording2", "1");
        }
      },
    });

  /** User-initiated refresh: GET status and apply. No downgrade; missing payload handled per Option B. */
  const refreshStatus = async () => {
    if (sessionId === "mock-session") return;
    setLoading(true);
    setError(null);
    setStatusUnknown(false);
    try {
      const statusRes = await homeworkApi.getStatus();
      if (!statusRes || statusRes.has_active_session === false) {
        applyStatusToState({ status: "none" });
        if (statusRes?.tutor_feedback_deadline && typeof statusRes.tutor_feedback_deadline === "string") {
          const ms = new Date(statusRes.tutor_feedback_deadline).getTime();
          if (Number.isFinite(ms) && ms > Date.now()) setTutorFeedbackDeadlineMs(ms);
        }
        if (typeof statusRes?.tutor_feedback_message === "string" && statusRes.tutor_feedback_message.trim()) {
          setTutorFeedbackMessage(statusRes.tutor_feedback_message.trim());
        }
        toast.success("Session was cleared. You can start a new one.");
      } else {
        applyStatusToState(getStatusToHomeworkResponse(statusRes));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh");
      toast.error(e instanceof Error ? e.message : "Failed to refresh");
    } finally {
      setLoading(false);
    }
  };

  if (!authReady) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground text-sm">Loading…</p>
      </Card>
    );
  }

  if (noWarmupConfigured) {
    return (
      <Card className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          No warm-up tasks are configured for your account. Please contact your coach to get started.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default">
            <Link href="/dashboard">Contact your coach</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back</Link>
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await createClient().auth.signOut();
              router.push("/login");
            }}
          >
            Log out
          </Button>
        </div>
      </Card>
    );
  }

  // Step 0: No session — show Start homework so next run starts from step 1 (first recording). User must click to proceed.
  if (step === 0) {
    const step0Exercises = assignedExercises.length > 0 ? assignedExercises : [DEFAULT_INTRO_EXERCISE];
    const ex = step0Exercises[0];
    const videoUrl = ex?.video_url?.trim();
    const vimeoId = videoUrl ? parseVimeoId(videoUrl) : null;
    const waitingMessage =
      mainScreenMessage ??
      REVIEW_PENDING_DEFAULT_MESSAGE;

    const step0ReportsListId = "step0-reports-history";
    const visibleStep0Sessions = step0Sessions.slice(0, visibleReportsCount);
    const canLoadMoreReports = visibleReportsCount < step0Sessions.length;

    return (
      <div className="flex flex-col items-center w-full pt-0 -mt-8 sm:-mt-10">
        <StepFlowWrapper step={0} syncingBehind={syncingBehind}>
          <Card className="w-full max-w-md mx-auto p-6 sm:p-8 border-0 bg-transparent shadow-none">
            <div className="flex flex-col items-center w-full max-w-[280px] mx-auto space-y-4">
              {reviewPending ? (
                <div className="w-full rounded-3xl border border-border bg-muted/40 px-5 py-6 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 6v6l4 2" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </div>
                  <div className="mt-4 space-y-3">
                    <p className="text-lg font-semibold text-foreground">Your homework is being reviewed</p>
                    <p className="text-sm leading-6 text-muted-foreground">{waitingMessage}</p>
                    {(sniperProfile?.realtime_level != null || sniperProfile?.realtime_step != null) ? (
                      <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground">
                        Current unlocked progress: Level {sniperProfile?.realtime_level ?? "—"}, Step{" "}
                        {sniperProfile?.realtime_step ?? "—"}
                      </div>
                    ) : null}
                    <p className="text-xs leading-5 text-muted-foreground">
                      We&apos;ll email you when your next homework is ready.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-full">
                    {videoUrl ? (
                      vimeoId ? (
                        <div className="aspect-[9/16] w-full overflow-hidden rounded-lg bg-black">
                          <iframe
                            src={`https://player.vimeo.com/video/${vimeoId}`}
                            title="Video"
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setVideoModalUrl(videoUrl)}
                          className="relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-lg bg-muted transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
                            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg">
                              <Play className="h-7 w-7 ml-1" fill="currentColor" />
                            </span>
                          </span>
                        </button>
                      )
                    ) : (
                      <div className="flex aspect-[9/16] w-full items-center justify-center rounded-lg bg-muted/50 border border-border">
                        <p className="text-sm text-muted-foreground">No video</p>
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleStart}
                    disabled={loading}
                    className="w-full max-w-[280px] rounded-xl h-12 bg-primary text-white font-semibold hover:bg-primary/90"
                  >
                    {error ? "Try again" : loading ? "Starting…" : "Start Your Practice"}
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (showReportsList) {
                    setShowReportsList(false);
                  } else {
                    setVisibleReportsCount(STEP0_REPORTS_PAGE_SIZE);
                    setShowReportsList(true);
                    fetchStep0Reports();
                  }
                }}
              >
                {showReportsList ? "Hide reports" : "View reports"}
              </Button>
            </div>

            {/* Reports list: same width as video; toggled by View reports / Hide reports */}
            {showReportsList && (
              <div id={step0ReportsListId} className="w-full max-w-[280px] mx-auto mt-8 space-y-4">
                {step0SessionsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : step0Sessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reports yet.</p>
                ) : (
                  <div className="space-y-3">
                    {visibleStep0Sessions.map((s) => (
                      <CompactReportPreviewCard
                        key={s.id}
                        title={s.created_at ? new Date(s.created_at).toLocaleDateString() : "Report"}
                        preview={step0ReportPreviews[s.id] ?? null}
                        loading={!!step0ReportPreviewLoading[s.id]}
                        onOpen={() => {
                          setReportModalSessionId(s.id);
                          setReportsModalOpen(true);
                        }}
                      />
                    ))}
                    {canLoadMoreReports ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={() =>
                          setVisibleReportsCount((prev) => Math.min(prev + STEP0_REPORTS_PAGE_SIZE, step0Sessions.length))
                        }
                      >
                        Load more
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {videoModalUrl ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                role="dialog"
                aria-modal="true"
                aria-label="Video"
                onClick={() => setVideoModalUrl(null)}
              >
                <div
                  className="relative flex w-full max-w-[280px] flex-col rounded-xl bg-background shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setVideoModalUrl(null)}
                    className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="aspect-[9/16] w-full overflow-hidden rounded-t-xl bg-black">
                    <iframe
                      src={videoModalUrl}
                      title="Video"
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </Card>
          <HomeworkReportsModal
            open={reportsModalOpen}
            onOpenChange={(open) => {
              setReportsModalOpen(open);
              if (!open) setReportModalSessionId(null);
            }}
            sessionId={reportModalSessionId}
          />
        </StepFlowWrapper>
      </div>
    );
  }

  const coachMessageTrimmed = (coachMessageAfterHomework ?? "").trim();
  const coachMessageBlock = coachMessageTrimmed ? (
    <div className="w-full max-w-md mx-auto mb-6 rounded-xl border border-border bg-muted/50 p-4 space-y-2">
      <p className="text-sm font-medium text-muted-foreground">A message for you</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{coachMessageTrimmed}</p>
    </div>
  ) : null;

  // Step 1: Task + recorder — show as soon as session exists (from POST start response)
  if (step === 1) {
    const isUploadingRec1 = uploadingRecording === 1;
    if (isUploadingRec1) {
      return (
        <StepFlowWrapper step={1} syncingBehind={syncingBehind}>
          {coachMessageBlock}
          <Card className="p-6 border-0 bg-transparent shadow-none">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <h3 className="text-lg font-semibold">Sending first recording</h3>
              <p className="text-sm text-muted-foreground">Please wait…</p>
            </div>
          </Card>
        </StepFlowWrapper>
      );
    }
    const taskEmpty = sessionId && !task.trim();
    const showStatusUnknownBlock = statusUnknown;
    const showTaskUnavailableBlock = taskEmpty && !statusUnknown;

    return (
      <StepFlowWrapper step={1} syncingBehind={syncingBehind}>
        {coachMessageBlock}
        {sessionId === "mock-session" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Preview mode — backend not connected. Recording will not be saved until you implement <code className="text-xs">POST /v2/homework/start</code>.
          </div>
        )}
        {showStatusUnknownBlock && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
            <p>Session could not be restored. Start over to begin a new session.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                startOverFromScratch();
                toast.info("Click Start Your Practice to begin a new session.");
              }}
            >
              Start over
            </Button>
          </div>
        )}
        {showTaskUnavailableBlock && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
            <p>Task unavailable. Start over to begin a new session.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                startOverFromScratch();
                toast.info("Click Start Your Practice to begin a new session.");
              }}
            >
              Start over
            </Button>
          </div>
        )}
        {!showStatusUnknownBlock && !showTaskUnavailableBlock && (
          <AudioRecorder
            prompt={task.trim() || DEFAULT_TASK_PROMPT}
            onRecordingComplete={onRecording1Complete}
            onSniperSnapshot={(snapshot) => {
              setSniperSnapshot(snapshot);
              sniperSnapshotRef.current = snapshot;
            }}
            stopAndSend
            uploading={isUploadingRec1}
            minDurationSeconds={RECORDING_1_DURATION_MIN}
            sniperMode
            sniperProfile={sniperProfile}
          />
        )}
        {sessionId && sessionId !== "mock-session" && (
          <div className="mt-[1px] flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleAbandon}
              disabled={loading}
            >
              Abandon session
            </Button>
          </div>
        )}
      </StepFlowWrapper>
    );
  }

  // Step 2: Self-rating — actionable immediately after recording is sent for analysis.
  if (step === 2) {
    if (recordingProcessingFailed) {
      return (
        <StepFlowWrapper step={2} syncingBehind={syncingBehind}>
          {coachMessageBlock}
          <Card className="w-full max-w-md mx-auto border-0 bg-transparent p-6 shadow-none">
            <h3 className="text-lg font-semibold mb-2">We couldn&apos;t process this recording.</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your recording analysis failed, so this session can&apos;t be completed. Start a new practice and try recording again.
            </p>
            <Button onClick={handleStartOver} disabled={resetting} className="w-full rounded-xl h-12 font-semibold">
              {resetting ? "Sending…" : "Start New Practice"}
            </Button>
          </Card>
        </StepFlowWrapper>
      );
    }

    return (
      <StepFlowWrapper step={2} syncingBehind={syncingBehind}>
        {coachMessageBlock}
        <Card className="mx-auto w-full max-w-2xl border-0 bg-transparent px-4 py-6 shadow-none sm:px-6">
          <div className="mb-6 text-center">
            <p className="text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
              How do you feel about your performance
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base md:text-lg">
              Choose a number from 1 to 5, with 1 being your lowest rating and 5 being your strongest.
            </p>
          </div>
          <div className="mb-4">
            <div className="grid grid-cols-5 gap-3 md:gap-4">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                disabled={savingStudentRating}
                onClick={async () => {
                  if (!sessionId || sessionId === "mock-session") return;
                  setSavingStudentRating(true);
                  try {
                    lastSelfRatingPayloadRef.current = { sessionId, rating: n };
                    const res = await homeworkApi.submitSelfRating(sessionId, n);
                    setStudentSpeechRatingSubmitted(true);
                    // If backend returned a final task → recording 2 is next (step 3); otherwise report (step 4)
                    if (res.final_task || res.status === "final_task_ready") {
                      if (res.final_task) setFinalTask(res.final_task);
                      setStep(3);
                    } else {
                      setStep(4);
                    }
                    if (res.session_completed === false) {
                      setPendingRetrySelfRating({ sessionId, rating: n });
                    }
                  } catch (e) {
                    if (isSelfRatingNotReadyError(e)) {
                      setPendingRetrySelfRating({ sessionId, rating: n });
                      setStudentSpeechRatingSubmitted(true);
                      setStep(4);
                    } else {
                      toast.error(e instanceof Error ? e.message : "Could not save rating. Try again.");
                    }
                  } finally {
                    setSavingStudentRating(false);
                  }
                }}
                className="h-20 rounded-2xl border-2 text-2xl font-bold shadow-sm transition-all hover:scale-[1.02] hover:bg-accent/70 sm:h-24 sm:text-3xl"
              >
                {n}
              </Button>
            ))}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={savingStudentRating}
            onClick={async () => {
              if (!sessionId || sessionId === "mock-session") {
                setStudentSpeechRatingSubmitted(true);
                setStep(4);
                return;
              }
              setSavingStudentRating(true);
              try {
                lastSelfRatingPayloadRef.current = { sessionId, skipped: true };
                const res = await homeworkApi.submitSelfRatingSkipped(sessionId);
                setStudentSpeechRatingSubmitted(true);
                if (res.final_task || res.status === "final_task_ready") {
                  if (res.final_task) setFinalTask(res.final_task);
                  setStep(3);
                } else {
                  setStep(4);
                }
                if (res.session_completed === false) {
                  setPendingRetrySelfRating({ sessionId, skipped: true });
                }
              } catch (e) {
                if (isSelfRatingNotReadyError(e)) {
                  setPendingRetrySelfRating({ sessionId, skipped: true });
                  setStudentSpeechRatingSubmitted(true);
                  setStep(4);
                } else {
                  toast.error(e instanceof Error ? e.message : "Could not save. Try again.");
                }
              } finally {
                setSavingStudentRating(false);
              }
            }}
            className="mx-auto mt-2 flex text-base text-muted-foreground"
          >
            Skip
          </Button>
        </Card>
      </StepFlowWrapper>
    );
  }

  // ─── Step 3: Recording 2 (final task) ───────────────────────────────────────
  // Same AudioRecorder + dartboard animation as step 1. Only the prompt and
  // the completion handler differ — recording state and performance score
  // variables are the same throughout both recording steps.
  if (step === 3) {
    const isUploadingRec2 = uploadingRecording === 2;
    const promptText = finalTask.trim() || task.trim() || DEFAULT_TASK_PROMPT;

    if (isUploadingRec2) {
      return (
        <StepFlowWrapper step={3} syncingBehind={syncingBehind}>
          {coachMessageBlock}
          <Card className="p-6 border-0 bg-transparent shadow-none">
            <div className="text-center space-y-4">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <h3 className="text-lg font-semibold">Sending final recording</h3>
              <p className="text-sm text-muted-foreground">Please wait…</p>
            </div>
          </Card>
        </StepFlowWrapper>
      );
    }

    return (
      <StepFlowWrapper step={3} syncingBehind={syncingBehind}>
        {coachMessageBlock}
        <AudioRecorder
          prompt={promptText}
          onRecordingComplete={onRecording2Complete}
          onSniperSnapshot={(snapshot) => {
            setSniperSnapshot(snapshot);
            sniperSnapshotRef.current = snapshot;
          }}
          stopAndSend
          uploading={isUploadingRec2}
          minDurationSeconds={RECORDING_2_DURATION_MIN}
          sniperMode
          sniperProfile={sniperProfile}
        />
        {sessionId && sessionId !== "mock-session" && (
          <div className="mt-[1px] flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleAbandon}
              disabled={loading}
            >
              Abandon session
            </Button>
          </div>
        )}
      </StepFlowWrapper>
    );
  }

  // ─── Step 4: Score/report ────────────────────────────────────────────────────
  if (step === 4) {
    if (recordingProcessingFailed) {
      return (
        <div className="mx-auto -mt-4 max-w-2xl space-y-4 animate-fade-in sm:-mt-6">
          <h3 className="text-center text-xl font-semibold">Your report</h3>
          <Card className="border-0 bg-transparent p-6 space-y-4 shadow-none">
            <p className="text-sm text-foreground">
              We couldn&apos;t process this recording, so a report can&apos;t be generated for this session.
            </p>
            <Button onClick={handleStartOver} disabled={resetting} className="w-full rounded-xl h-12 font-semibold">
              {resetting ? "Sending…" : "Start New Practice"}
            </Button>
          </Card>
        </div>
      );
    }

    const waitingForFullReport = reportNotReady || (reportData == null && reportError == null);
    const displayScores =
      reportData?.scores ??
      (performanceScoreEnd != null
        ? { warmup: undefined, final: undefined, overall: Math.round(performanceScoreEnd * 100) }
        : sniperSnapshot != null
          ? { warmup: undefined, final: undefined, overall: Math.round(sniperSnapshot.performanceScore) }
          : undefined);
    const canonicalFinalScore = normalizePercentScore(reportData?.score_for_display);
    const reportCtaLabel = (reportData?.report_cta ?? "").trim() || "Start New Practice";
    const currentPerformanceScore1 =
      typeof reportData?.performance_score_1 === "number"
        ? Math.round(reportData.performance_score_1 <= 1 ? reportData.performance_score_1 * 100 : reportData.performance_score_1)
        : undefined;
    const performanceHistory = reportData?.performance_history ?? [];
    const lastFiveHistory = performanceHistory.length > 0 ? performanceHistory.slice(-5) : [];
    const chartFromHistory = lastFiveHistory.map((p, i) => ({
      sessionLabel: `S${i + 1}`,
      date: p.date,
      score: p.score,
    }));
    const provisionalChartData =
      chartFromHistory.length > 0
        ? chartFromHistory
        : currentPerformanceScore1 != null
          ? [{ sessionLabel: "S1", date: new Date().toISOString(), score: currentPerformanceScore1 }]
          : displayScores?.overall != null
            ? [{ sessionLabel: "S1", date: new Date().toISOString(), score: displayScores.overall }]
            : [];
    const progressChartData = (() => {
      if (waitingForFullReport || canonicalFinalScore == null) return provisionalChartData;
      // Finalized report: keep history bars from backend, but force current session point/bar to canonical score_for_display.
      if (chartFromHistory.length > 0) {
        const updated = [...chartFromHistory];
        const last = updated[updated.length - 1];
        if (last) updated[updated.length - 1] = { ...last, score: canonicalFinalScore };
        return updated;
      }
      return [{ sessionLabel: "S1", date: new Date().toISOString(), score: canonicalFinalScore }];
    })();
    const initialPerformanceResult = currentPerformanceScore1 ?? displayScores?.overall;
    const finalPerformanceResult = canonicalFinalScore ?? currentPerformanceScore1 ?? displayScores?.overall;
    const performanceResult = waitingForFullReport ? initialPerformanceResult : finalPerformanceResult;

    const playbackUrl =
      reportData?.final_recording?.audio_url ??
      reportData?.recording?.audio_url ??
      reportData?.recording_1?.audio_url;

    const transcriptionText = (
      localTranscript ||
      reportData?.recording?.transcription_text ||
      reportData?.transcription_text ||
      reportData?.transcript ||
      ""
    ).trim();

    const backendBreakdown =
      reportData?.recording?.filler_words_count?.breakdown ??
      (reportData as { filler_words_breakdown?: Record<string, number> | null })?.filler_words_breakdown ??
      null;
    const backendTotalRaw =
      reportData?.recording?.filler_words_count?.total ??
      reportData?.filler_word_count ??
      (reportData as { filler_words_total?: number | null })?.filler_words_total ??
      null;
    const computedTotalFromBreakdown = backendBreakdown
      ? Object.values(backendBreakdown).reduce((sum, v) => sum + (Number.isFinite(v) ? Number(v) : 0), 0)
      : 0;
    const fillerTotal =
      typeof backendTotalRaw === "number"
        ? (backendTotalRaw === 0 && computedTotalFromBreakdown > 0 ? computedTotalFromBreakdown : backendTotalRaw)
        : (computedTotalFromBreakdown > 0 ? computedTotalFromBreakdown : null);
    const fillerBreakdown = backendBreakdown ?? undefined;

    const coachInsight = (reportData?.coach_insight ?? "").trim();
    const coachGrade =
      reportData?.coach_grade ??
      (reportData as { admin_grade?: number | null })?.admin_grade ??
      (reportData as { grade?: number | null })?.grade ??
      null;
    const coachGradeMessage = (
      reportData?.coach_message ??
      (reportData as { coach_grade_message?: string | null })?.coach_grade_message ??
      (reportData as { coach_feedback_message?: string | null })?.coach_feedback_message ??
      (reportData as { grade_message?: string | null })?.grade_message ??
      ""
    ).trim();
    const hasCoachFeedback = coachGrade != null || coachGradeMessage.length > 0;

    return (
      <div className="mx-auto -mt-4 max-w-2xl space-y-4 animate-fade-in sm:-mt-6">
        <h3 className="text-center text-xl font-semibold">Your report</h3>
        {waitingForFullReport && performanceResult != null ? (
          <div className="flex justify-center -mt-1">
            {loadingLottieData ? (
              <div className="w-10 h-10 opacity-70">
                <Lottie animationData={loadingLottieData} loop />
              </div>
            ) : (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/60 border-t-transparent" />
            )}
          </div>
        ) : null}
        {coachMessageBlock}
        <Card className="border-0 bg-transparent p-6 space-y-4 shadow-none">
          {reportError != null && reportData == null ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-3">
              <p className="text-sm text-foreground">We couldn&apos;t load full report details yet.</p>
              <p className="text-sm text-destructive">{reportError}</p>
              <Button
                onClick={() => {
                  setReportError(null);
                  setReportRetryCount((c) => c + 1);
                }}
                disabled={reportLoading}
                className="w-full rounded-xl h-11 font-semibold"
              >
                {reportLoading ? "Loading…" : "Try again"}
              </Button>
            </div>
          ) : null}
          {performanceResult != null ? (
            <p className="text-sm text-muted-foreground text-center">
              {waitingForFullReport ? "Initial performance score" : "Final performance score"}:{" "}
              <span className="font-semibold text-foreground">{performanceResult}%</span>
            </p>
          ) : null}

          {progressChartData.length > 0 && (
            <ProgressOverSessionsChart data={progressChartData} />
          )}

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Playback</p>
            {playbackUrl && !audioPlaybackError ? (
              <audio
                controls
                src={playbackUrl}
                className="w-full max-w-md"
                onError={() => setAudioPlaybackError(true)}
              />
            ) : audioPlaybackError ? (
              <p className="text-sm text-muted-foreground">Playback failed. The audio may be unavailable.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Playback not available for this session yet.</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Transcript</p>
            {transcriptionText ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-48 overflow-y-auto">
                <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{transcriptionText}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Transcript not available for this session yet.</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Filler words</p>
            {fillerTotal != null ? (
              <p className="text-sm text-foreground">
                {fillerTotal} filler word{fillerTotal !== 1 ? "s" : ""} detected
                {formatFillerBreakdown(fillerBreakdown) ? ` (${formatFillerBreakdown(fillerBreakdown)})` : ""}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Filler word analysis is not available yet.</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">AI Coach Insight</p>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              {coachInsight ? (
                <p className="text-sm text-foreground leading-relaxed">{coachInsight}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Coach insight is being prepared.</p>
              )}
            </div>
          </div>

          {hasCoachFeedback ? (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Coach feedback</p>
              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                {coachGrade != null ? (
                  <p className="text-sm text-foreground">
                    Grade: <span className="font-semibold">{coachGrade}/10</span>
                  </p>
                ) : null}
                {coachGradeMessage ? (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{coachGradeMessage}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <Button onClick={handleStartOver} disabled={resetting} className="mt-2 w-full rounded-xl h-12 font-semibold">
            {resetting ? "Sending…" : reportCtaLabel}
          </Button>
        </Card>
      </div>
    );
  }

  return null;
}
