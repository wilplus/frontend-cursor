"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthReady } from "@/hooks/useAuthReady";
import { homeworkApi, type HomeworkApiError, type SelfRatingResponse } from "@/lib/api/homework-client";
import type {
  HomeworkQuestion,
  HomeworkSessionStatus,
  HomeworkReportResponse,
  TaskBlockV2,
  HomeworkResponse,
  AssignedExercise,
} from "@/lib/api/types-homework";
import {
  mapStatusToStep,
  getStatusToHomeworkResponse,
  toPublicStatus,
  type Step as StepType,
  type PublicHomeworkStatus,
} from "@/lib/api/types-homework";
import ProgressOverSessionsChart from "@/components/homework/ProgressOverSessionsChart";
import HomeworkReportsModal from "@/components/homework/HomeworkReportsModal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import AudioRecorder from "@/components/recording/AudioRecorder";
import { SniperReviewSummary } from "@/components/recording/SniperReviewSummary";
import type { SniperSessionSnapshot, UserSniperProfile } from "@/lib/sniper/types";
import { computeAdaptiveResult } from "@/lib/sniper/adaptive";
import { Play, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useRecordingContext } from "@/components/dashboard/DashboardShell";
import Lottie from "lottie-react";

/** Temporarily only 2 steps: record (1) and report (5). Steps 2–4 removed. */
const TOTAL_STEPS = 2;

/** Default warm-up question when the backend assigns none. */
const DEFAULT_WARMUP_QUESTION = "How was your day so far?";

/** Default exercise shown on step 0 when the student has no assigned exercises (e.g. new user / nothing set in admin). */
const DEFAULT_INTRO_EXERCISE: AssignedExercise = {
  id: "0-intro",
  title: "Intro",
  description: null,
  video_url: "https://vimeo.com/1167696503?fl=ip&fe=ec",
};

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resolveWarmUpText(text: string | null | undefined): string {
  return (text ?? "").trim() || DEFAULT_WARMUP_QUESTION;
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

function isNoWarmupError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "NO_WARMUP_CONFIGURED";
}

function isInvalidSessionStateError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "INVALID_SESSION_STATE";
}

function isReportNotReadyError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "REPORT_NOT_READY";
}

function StepFlowWrapper({
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
  const authReady = useAuthReady();
  const { setRecordingActive, setShowNavbar } = useRecordingContext();
  const [step, setStep] = useState<Step>(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [warmUpText, setWarmUpText] = useState("");
  const [taskText, setTaskText] = useState("");
  const [finalTaskText, setFinalTaskText] = useState("");
  const [taskBlock, setTaskBlock] = useState<TaskBlockV2 | null>(null);
  const [questions, setQuestions] = useState<HomeworkQuestion[]>([]);
  const [postAnswers, setPostAnswers] = useState<Record<string, string>>({});
  const [reportText, setReportText] = useState("");
  const [performanceScoreEnd, setPerformanceScoreEnd] = useState<number | null>(null);
  /** Fetched report for step 5 (player + graph + text). Fresh on load so audio_url is valid. */
  const [reportData, setReportData] = useState<HomeworkReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  /** Claude-generated coaching insight for step 5 (replaces backend AI feedback). */
  const [claudeInsight, setClaudeInsight] = useState<string | null>(null);
  const [claudeLoading, setClaudeLoading] = useState(false);
  /** Live-transcribed text from Web Speech API (set immediately when recording stops). */
  const [localTranscript, setLocalTranscript] = useState("");
  /** Claude-analysed filler word counts (returned when analyzeFillers: true in coaching-report). */
  const [claudeFillerWords, setClaudeFillerWords] = useState<{ total: number; breakdown: Record<string, number> } | null>(null);
  /** Backend returned 404 with REPORT_NOT_READY (report still generating). Show "generating" UI and auto-refresh. */
  const [reportNotReady, setReportNotReady] = useState(false);
  const [reportRetryCount, setReportRetryCount] = useState(0);
  /** True when the <audio> element fires onError (valid URL but file unplayable/missing). */
  const [audioPlaybackError, setAudioPlaybackError] = useState(false);
  /** Loading Lottie animation data (fetched once for step 5). */
  const [loadingLottieData, setLoadingLottieData] = useState<object | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** When true, metric step Continue is disabled because recording-1 analysis failed (submitting again won't help). */
  const [metricStepBlockedByRecordingFailure, setMetricStepBlockedByRecordingFailure] = useState(false);
  /** On step 2 when taskBlock was null, we fetch it; this becomes true when that fetch settles (success or fail). Used to show error if questions still missing after fetch. */
  const [taskBlockFetchSettled, setTaskBlockFetchSettled] = useState(false);
  /** On step 4 when questions were [], we fetch GET questions; this becomes true when that fetch settles so we only show the form once questions are loaded (or show error). */
  const [questionsStep4Settled, setQuestionsStep4Settled] = useState(false);
  const [uploadingRecording, setUploadingRecording] = useState<1 | 2 | null>(null);
  const [noWarmupConfigured, setNoWarmupConfigured] = useState(false);
  const [statusUnknown, setStatusUnknown] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncingBehind, setSyncingBehind] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const metricSubmitInProgress = useRef(false);
  const postAnswersSubmitInProgress = useRef(false);
  const uploadRecording1InProgressRef = useRef(false);
  const uploadRecording2InProgressRef = useRef(false);
  const postAnswersAutoSubmitDoneRef = useRef(false);
  /** When set, user just finished a lesson (step 5 → 0); show tutor countdown notice on step 0. Cleared when they click Start homework. */
  const [tutorFeedbackDeadlineMs, setTutorFeedbackDeadlineMs] = useState<number | null>(null);
  /** When no active session: message from backend (e.g. tutor warning). Show as info banner on step 0. */
  const [tutorFeedbackMessage, setTutorFeedbackMessage] = useState<string | null>(null);
  /** Message from coach to the student for this homework (e.g. after assignment). Shown when step >= 1; no video. From tutor_video_description. */
  const [coachMessageAfterHomework, setCoachMessageAfterHomework] = useState<string | null>(null);
  /** When step 0 and has_active_session false: exercises assigned to this student (from GET status assigned_exercises). */
  const [assignedExercises, setAssignedExercises] = useState<AssignedExercise[]>([]);
  /** When set, show modal with iframe for this video URL (non-Vimeo links). */
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  /** Sniper (voice alignment) session summary when recording completed with sniperMode. Shown on report step. */
  const [sniperSnapshot, setSniperSnapshot] = useState<SniperSessionSnapshot | null>(null);
  /** User sniper profile (adaptive baseline). Fetched on load; updated after session end POST. */
  const [sniperProfile, setSniperProfile] = useState<UserSniperProfile | null>(null);
  /** True once student has submitted "How did that feel?" rating (or skipped). Hides rating UI and avoids double submit. */
  const [studentSpeechRatingSubmitted, setStudentSpeechRatingSubmitted] = useState(false);
  /** Loading state when submitting student speech rating. */
  const [savingStudentRating, setSavingStudentRating] = useState(false);
  /** When GET session/status returns ready_for_self_rating: true, show the 1–10 self-rating UI on step 2. */
  const [readyForSelfRating, setReadyForSelfRating] = useState<boolean | null>(null);
  /** True only when the API has returned ready_for_self_rating: true. Submit/Skip must stay disabled until this is true so we never send self-rating before the recording-1 job has finished. */
  const [backendReadyForSelfRating, setBackendReadyForSelfRating] = useState(false);
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
  const [step0Sessions, setStep0Sessions] = useState<Array<{ id: string; created_at?: string; status?: string; coach_grade?: number | null; recording_id?: string; recording_1_id?: string; report_preview?: { report_text_preview?: string } }>>([]);
  const [step0SessionsLoading, setStep0SessionsLoading] = useState(false);
  /** Step 0: when true, show the Reports History list (fetched on first "View reports" click). */
  const [showReportsList, setShowReportsList] = useState(false);
  /** True when we already started fetching task-block (e.g. in mount or step-2 effect) so we do not double-fetch. */
  const taskBlockFetchStartedRef = useRef(false);
  /** When step 2 fails to load questions, we auto-skip to step 5 (report) once; this ref prevents doing it more than once. */
  const skipStep2ToReportDoneRef = useRef(false);
  /** Mirror of step for use inside applyStatusToState (so we never downgrade step when applying backend response). */
  const stepRef = useRef(step);
  stepRef.current = step;

  /** Refetch status on step 0 (mount/load) so the UI gets tutor_feedback_deadline and the timer can show. Without this, the countdown never appears. Runs whenever we land on step 0 (e.g. after "Send the homework to the coach!"). Wait for auth to avoid 500 on first load. */
  useEffect(() => {
    if (!authReady || step !== 0) return;
    homeworkApi.getStatus().then((statusRes) => {
      const deadlineIso = statusRes?.tutor_feedback_deadline;
      if (deadlineIso && typeof deadlineIso === "string") {
        const ms = new Date(deadlineIso).getTime();
        setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
      } else {
        setTutorFeedbackDeadlineMs(null);
      }
      const msg = statusRes?.tutor_feedback_message;
      setTutorFeedbackMessage(typeof msg === "string" && msg.trim() ? msg.trim() : null);
      // Only update when backend sends a non-empty list so old exercises stay visible on step 0 until new ones are assigned
      if (Array.isArray(statusRes?.assigned_exercises) && statusRes.assigned_exercises.length > 0) {
        setAssignedExercises(statusRes.assigned_exercises);
      }
    }).catch((err) => {
      setTutorFeedbackDeadlineMs(null);
      setTutorFeedbackMessage(null);
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[HomeworkFlow] Step 0 status refetch failed (timer may not show):", err);
      }
    });
  }, [authReady, step]);

  /** Fetch reports list (same source as admin). Called when user first clicks "View reports". */
  const fetchStep0Reports = useCallback(() => {
    if (step0SessionsLoading || step0Sessions.length > 0) return;
    setStep0SessionsLoading(true);
    homeworkApi
      .getSessions()
      .then((data) => {
        const list = (data.sessions ?? []).filter(
          (s) =>
            (s.report_preview?.report_text_preview && s.report_preview.report_text_preview.trim() !== "") ||
            s.status === "completed" ||
            !!s.recording_id ||
            !!(s as { recording_1_id?: string }).recording_1_id
        );
        list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        setStep0Sessions(list.slice(0, 20));
      })
      .catch(() => setStep0Sessions([]))
      .finally(() => setStep0SessionsLoading(false));
  }, [step0SessionsLoading, step0Sessions.length]);

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
        const deadlineIso = statusRes?.tutor_feedback_deadline;
        if (deadlineIso && typeof deadlineIso === "string") {
          const ms = new Date(deadlineIso).getTime();
          if (Number.isFinite(ms) && ms > Date.now()) setTutorFeedbackDeadlineMs(ms);
          else setTutorFeedbackDeadlineMs(null);
        } else {
          setTutorFeedbackDeadlineMs(null);
        }
        const msg = statusRes?.tutor_feedback_message;
        setTutorFeedbackMessage(typeof msg === "string" && msg.trim() ? msg.trim() : null);
        if (Array.isArray(statusRes?.assigned_exercises) && statusRes.assigned_exercises.length > 0) {
          setAssignedExercises(statusRes.assigned_exercises);
        }
      }).catch(() => {});
    }, TUTOR_DEADLINE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authReady, step, tutorFeedbackDeadlineMs]);

  /** Show navbar on step 0 (start), step 2 (self-rate), and step 5 (report); hide from step 1. */
  useEffect(() => {
    setShowNavbar(step === 0 || step === 2 || step === 5);
  }, [step, setShowNavbar]);

  /** Step 4 removed: if we ever land on 4 (e.g. stale state), go to report. */
  useEffect(() => {
    if (step === 4) setStep(5);
  }, [step]);

  /** Clear recording context when not on step 1 (record). Step 3 removed. */
  useEffect(() => {
    if (step !== 1) setRecordingActive(false);
  }, [step, setRecordingActive]);

  /** When on step 4 (post-recording questions) and questions not yet loaded, fetch GET questions. */
  useEffect(() => {
    if (step !== 4 || !sessionId || sessionId === "mock-session" || questions.length > 0 || questionsStep4Settled) return;
    let cancelled = false;
    setError(null);
    homeworkApi
      .getQuestions(sessionId)
      .then((r) => {
        if (cancelled) return;
        const list = Array.isArray(r.questions) ? r.questions : [];
        const normalized = list.map((q) => ({
          ...q,
          id: toId(q.id) || crypto.randomUUID(),
          text: toText(q.text),
        }));
        setQuestions(normalized.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
        setQuestionsStep4Settled(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load questions");
        setQuestionsStep4Settled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [step, sessionId, questions.length, questionsStep4Settled]);

  /** Single state projection from backend response. Step is only set to 0 when status is "none". Steps 1, 2, 5 are only reached by user flow: Start → 1, recording done → 2, self-rating done → 5. */
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
      setWarmUpText("");
      setTaskText("");
      setTaskBlock(null);
      setFinalTaskText("");
      setQuestions([]);
      setQuestionsStep4Settled(false);
      setReportText("");
      setPerformanceScoreEnd(null);
      setReportData(null);
      // Do not clear tutorFeedbackDeadlineMs / tutorFeedbackMessage here; step 0 effect and handleStartOver's getStatus() set them from API (so timer can persist when coming from step 5 report)
      setCoachMessageAfterHomework(null);
      // Do not clear assignedExercises here; step 0 effect will refetch and set from GET status
      skipStep2ToReportDoneRef.current = false;
      setReportFromRecording1Only(false);
      setPendingRetrySelfRating(null);
      hasSetPendingRetryFrom409Ref.current = false;
      setReadyForSelfRating(null);
      setBackendReadyForSelfRating(false);
      setLocalTranscript("");
      setClaudeFillerWords(null);
      setClaudeInsight(null);
      claudeSessionRef.current = null;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkReport");
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      return;
    }

    if ("warm_up_task" in res && res.warm_up_task != null) {
      setWarmUpText(resolveWarmUpText(res.warm_up_task.text ?? ""));
    } else if ("warm_up_task_text" in res && res.warm_up_task_text != null) {
      setWarmUpText(resolveWarmUpText(res.warm_up_task_text));
    }
    if ("task_text" in res && res.task_text !== undefined) setTaskText(res.task_text ?? "");
    if ("task_block" in res && res.task_block != null) setTaskBlock(res.task_block);
    if ("final_task" in res && res.final_task != null) setFinalTaskText(res.final_task.trim());
    else if ("final_task_text" in res && res.final_task_text != null) setFinalTaskText(res.final_task_text.trim());
    if ("performance_score_2" in res && res.performance_score_2 !== undefined) setPerformanceScoreEnd(res.performance_score_2);
    if ("report_text" in res && res.report_text !== undefined) setReportText(res.report_text ?? "");
    if ("performance_score_end" in res && res.performance_score_end !== undefined) setPerformanceScoreEnd(res.performance_score_end);
    if ("questions" in res && Array.isArray(res.questions)) {
      const qList = res.questions.map((q) => ({
        ...q,
        id: toId(q.id) || crypto.randomUUID(),
        text: toText(q.text),
      }));
      setQuestions(qList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)));
    }
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
    if (Array.isArray(res.assigned_exercises) && res.assigned_exercises.length > 0) {
      setAssignedExercises(res.assigned_exercises);
    }
    if (status === "task_block" || status === "final_task_ready" || status === "post_questions") {
      setReportFromRecording1Only(true);
    }
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setStatusUnknown(false);
    try {
      const startRes = await homeworkApi.start();
      const warmUpTextFromStart =
        (startRes.warm_up_task && "text" in startRes.warm_up_task ? startRes.warm_up_task.text : null) ??
        (startRes as { warm_up_task?: { text?: string } }).warm_up_task?.text ??
        (startRes as { warm_up_task_text?: string }).warm_up_task_text ??
        "";
      applyStatusToState({
        status: "recording_1_required",
        session_id: startRes.session_id,
        warm_up_task: (startRes as { warm_up_task?: { id: string; text: string } }).warm_up_task ?? null,
        warm_up_task_text: warmUpTextFromStart || null,
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
        setWarmUpText("");
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
    setStudentSpeechRatingSubmitted(false);
    setSavingStudentRating(false);
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("homeworkReport");
        sessionStorage.removeItem("homeworkJustFinishedRecording2");
      }
      if (sessionId && sessionId !== "mock-session") {
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
      postAnswersAutoSubmitDoneRef.current = false;
      metricSubmitInProgress.current = false;
      postAnswersSubmitInProgress.current = false;
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
      setTaskBlockFetchSettled(false);
      setQuestionsStep4Settled(false);
      setPostAnswers({});
      // Refetch status after navigating to step 0 so the countdown (tutor_feedback_deadline) and tutor_feedback_message are set; without this the timer can't show
      homeworkApi.getStatus().then((statusRes) => {
        const deadlineIso = statusRes?.tutor_feedback_deadline;
        if (deadlineIso && typeof deadlineIso === "string") {
          const ms = new Date(deadlineIso).getTime();
          setTutorFeedbackDeadlineMs(Number.isFinite(ms) && ms > Date.now() ? ms : null);
        } else {
          setTutorFeedbackDeadlineMs(null);
        }
        const msg = statusRes?.tutor_feedback_message;
        setTutorFeedbackMessage(typeof msg === "string" && msg.trim() ? msg.trim() : null);
        if (Array.isArray(statusRes?.assigned_exercises) && statusRes.assigned_exercises.length > 0) {
          setAssignedExercises(statusRes.assigned_exercises);
        }
      }).catch((err) => {
        setTutorFeedbackDeadlineMs(null);
        setTutorFeedbackMessage(null);
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
    uploadRecording2InProgressRef.current = false;
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
    postAnswersAutoSubmitDoneRef.current = false;
    metricSubmitInProgress.current = false;
    postAnswersSubmitInProgress.current = false;
    uploadRecording1InProgressRef.current = false;
    uploadRecording2InProgressRef.current = false;
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
    postAnswersAutoSubmitDoneRef.current = false;
    metricSubmitInProgress.current = false;
    postAnswersSubmitInProgress.current = false;
    uploadRecording1InProgressRef.current = false;
    uploadRecording2InProgressRef.current = false;
    skipStep2ToReportDoneRef.current = false;
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

  // Cold load: GET status only (mount). Never downgrade step; missing payload handled by Option B (e.g. fetch task-block for step 2).
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
          applyStatusToState({ status: "none" });
          if (statusRes?.tutor_feedback_deadline && typeof statusRes.tutor_feedback_deadline === "string") {
            const ms = new Date(statusRes.tutor_feedback_deadline).getTime();
            if (Number.isFinite(ms) && ms > Date.now()) setTutorFeedbackDeadlineMs(ms);
          }
          if (typeof statusRes?.tutor_feedback_message === "string" && statusRes.tutor_feedback_message.trim()) {
            setTutorFeedbackMessage(statusRes.tutor_feedback_message.trim());
          }
          return;
        }
        // Do not auto-advance to step 1: always show step 0 first; user must click "Start Your Practice" to go to recording.
        if (statusRes?.tutor_feedback_deadline && typeof statusRes.tutor_feedback_deadline === "string") {
          const ms = new Date(statusRes.tutor_feedback_deadline).getTime();
          if (Number.isFinite(ms) && ms > Date.now()) setTutorFeedbackDeadlineMs(ms);
        }
        if (typeof statusRes?.tutor_feedback_message === "string" && statusRes.tutor_feedback_message.trim()) {
          setTutorFeedbackMessage(statusRes.tutor_feedback_message.trim());
        }
        if (Array.isArray(statusRes?.assigned_exercises) && statusRes.assigned_exercises.length > 0) {
          setAssignedExercises(statusRes.assigned_exercises);
        }
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
  }, [authReady, step]);

  // Tab refocus: GET status and apply only when not on step 0 (so we don't jump to sniper without user clicking Start).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (stepRef.current === 0) return;
      homeworkApi.getStatus().then((res) => {
        if (res) applyStatusToState(getStatusToHomeworkResponse(res));
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const [reportFromRecording1Only, setReportFromRecording1Only] = useState(false);
  // Steps 2–4 effects removed (task block fetch, skip-to-report, step 4 questions).

  // Coach is notified by the backend when self-rating (or skip) is saved; no separate notify-lesson-complete call.

  // Fetch report when on step 5 with a real session (single source of truth for player + scores + text)
  useEffect(() => {
    if (step !== 5 || !sessionId || sessionId === "mock-session") return;
    setReportLoading(true);
    setReportError(null);
    setReportNotReady(false);
    setAudioPlaybackError(false);
    homeworkApi
      .getReport(sessionId)
      .then((data) => {
        setReportData(data);
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
  }, [step, sessionId, reportRetryCount]);

  // Load Lottie animation for report loading / generating states
  useEffect(() => {
    if (step !== 5 || loadingLottieData != null) return;
    fetch("/animations/loading.json")
      .then((r) => r.json())
      .then(setLoadingLottieData)
      .catch(() => {});
  }, [step, loadingLottieData]);

  // When report is still being generated, poll automatically (no user click)
  useEffect(() => {
    if (!reportNotReady || !sessionId) return;
    const intervalMs = 5000;
    const id = setInterval(() => setReportRetryCount((c) => c + 1), intervalMs);
    return () => clearInterval(id);
  }, [reportNotReady, sessionId]);

  // When on step 2, poll GET session/status until ready_for_self_rating or recording_1_processing_status === "completed". Fallback: after 30s show form and enable buttons so user is never stuck (retry flow re-POSTs if session_completed: false).
  useEffect(() => {
    if (step !== 2 || !sessionId || sessionId === "mock-session") return;
    let cancelled = false;
    const fallbackMs = 30000;
    const fallbackId = setTimeout(() => {
      if (!cancelled) {
        setReadyForSelfRating(true);
        setBackendReadyForSelfRating(true);
      }
    }, fallbackMs);
    const poll = async () => {
      try {
        const statusRes = await homeworkApi.getStatus();
        if (cancelled) return;
        const raw = statusRes as HomeworkSessionStatus & {
          session?: { ready_for_self_rating?: boolean; recording_1_processing_status?: string };
          recording_1_processing_status?: string;
        };
        const explicitReady =
          raw?.ready_for_self_rating === true ||
          (typeof raw?.session === "object" && raw.session?.ready_for_self_rating === true);
        const processingDone =
          raw?.recording_1_processing_status === "completed" ||
          (typeof raw?.session === "object" && raw.session?.recording_1_processing_status === "completed");
        const ready = explicitReady || processingDone;
        if (ready) {
          setReadyForSelfRating(true);
          setBackendReadyForSelfRating(true);
        }
      } catch {
        if (!cancelled) setReadyForSelfRating(false);
      }
    };
    poll();
    const intervalMs = 4000;
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(fallbackId);
    };
  }, [step, sessionId]);

  // When leaving step 2, reset so next time we re-poll for ready_for_self_rating
  useEffect(() => {
    if (step !== 2) {
      setReadyForSelfRating(null);
      setBackendReadyForSelfRating(false);
    }
  }, [step]);

  // When session_completed was false: poll GET session/status until job is done, then call POST self-rating again to trigger completion
  useEffect(() => {
    if (step !== 5 || !pendingRetrySelfRating) return;
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
      fetch("/api/user/sniper-profile", { signal: ac.signal })
        .then((r) => (r.status === 404 ? null : r.json()))
        .then((data) => {
          if (data && typeof data.user_id === "string") setSniperProfile(data);
        })
        .catch(() => {})
        .finally(() => clearTimeout(timeoutId));
    }, delayMs);
    return () => clearTimeout(tid);
  }, [step]);

  // Call Claude for AI coaching insight as soon as we have transcript or sniper metrics.
  // Fires once per session (claudeSessionRef tracks the last analysed sessionId).
  // Does NOT require step === 5 — starts the request the moment recording stops so
  // the result is ready (or already loading) when the user reaches the report step.
  const claudeSessionRef = useRef<string | null>(null);
  useEffect(() => {
    // Need at least a local transcript or sniper snapshot to analyse
    const hasTranscript = localTranscript.trim().length > 10;
    const hasMetrics = !!sniperSnapshot;
    if (!hasTranscript && !hasMetrics) return;
    if (!sessionId || claudeSessionRef.current === sessionId) return;
    claudeSessionRef.current = sessionId;

    // Prefer live Web Speech transcript; fall back to backend transcript (if report loaded early)
    const transcript = localTranscript.trim() || (
      reportData?.recording?.transcription_text ??
      reportData?.transcription_text ??
      reportData?.transcript ??
      ""
    ).trim();

    const body: {
      transcript?: string;
      taskLabel?: string;
      sniperOverallScore?: number;
      sniperTier?: string;
      sniperMetrics?: object;
      analyzeFillers?: boolean;
    } = {
      transcript: transcript || undefined,
      taskLabel: finalTaskText || taskText || undefined,
      sniperOverallScore: sniperSnapshot?.overallScore,
      sniperTier: sniperSnapshot?.tier,
      sniperMetrics: sniperSnapshot
        ? {
            paceWpm: sniperSnapshot.sessionMeans.paceWpm,
            avgPauseMs: sniperSnapshot.sessionMeans.avgPauseMs,
            dynamicRangeDb: sniperSnapshot.sessionMeans.dynamicRangeDb,
            emphasisPerMin: sniperSnapshot.sessionMeans.emphasisPerMin,
            pitchRangeSt: sniperSnapshot.sessionMeans.pitchRangeSt ?? null,
          }
        : undefined,
      // Ask Claude to count filler words whenever we have a real transcript
      analyzeFillers: transcript.length > 10,
    };

    if (!body.transcript && !body.sniperOverallScore) return;

    setClaudeLoading(true);
    setClaudeInsight(null);
    setClaudeFillerWords(null);
    fetch("/api/ai/coaching-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data: { insight?: string; fillerWords?: { total: number; breakdown: Record<string, number> }; error?: string }) => {
        if (data.insight) setClaudeInsight(data.insight);
        if (data.fillerWords && typeof data.fillerWords.total === "number") {
          setClaudeFillerWords(data.fillerWords);
        }
      })
      .catch(() => {})
      .finally(() => setClaudeLoading(false));
  }, [localTranscript, sniperSnapshot, sessionId, finalTaskText, taskText, reportData]);

  const RECORDING_1_DURATION_MIN = 30;
  const RECORDING_2_DURATION_MIN = 62;
  const RECORDING_2_DURATION_MAX = 300;

  const handleRecording1Complete = async (blob: Blob, durationSeconds: number) => {
    if (durationSeconds < RECORDING_1_DURATION_MIN) {
      const msg = `First recording must be at least ${RECORDING_1_DURATION_MIN} seconds. You recorded ${durationSeconds}s.`;
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!sessionId) return;
    if (uploadRecording1InProgressRef.current) return;
    uploadRecording1InProgressRef.current = true;
    if (typeof window !== "undefined") {
      console.warn("[HomeworkFlow] handleRecording1Complete", { step, sessionId: sessionId?.slice(0, 8) + "…", durationSeconds });
    }
    if (sessionId === "mock-session") {
      uploadRecording1InProgressRef.current = false;
      setError(
        "Recording captured (preview only). Implement POST /v2/homework/start and POST /v2/homework/session/:id/recording-1 on your backend to save and continue."
      );
      return;
    }
    if (uploadingRecording === 1) {
      uploadRecording1InProgressRef.current = false;
      return;
    }
    setUploadingRecording(1);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const res = await homeworkApi.uploadRecording1(sessionId, blob, durationSeconds, abortRef.current.signal);
      const backendStatus = (res as { status?: string }).status;
      const status: PublicHomeworkStatus = backendStatus && toPublicStatus(backendStatus) !== "none" ? toPublicStatus(backendStatus) : "task_block";
      applyStatusToState({
        status,
        session_id: sessionId,
        task_block: (res as { task_block?: TaskBlockV2 }).task_block ?? null,
        task_text: (res as { task_text?: string }).task_text ?? undefined,
        ...(Array.isArray((res as { questions?: HomeworkQuestion[] }).questions) && { questions: (res as { questions?: HomeworkQuestion[] }).questions }),
      });
      // Next: self-rate step only (no metric-answers, recording-2, or post-answers). Then report.
      setStep(2);
    } catch (e) {
      console.error("[HomeworkFlow] handleRecording1Complete error", e);
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      const msg = isInvalidSessionStateError(e)
        ? "Session state conflict. Please refresh the page or switch tab and back."
        : (e instanceof Error ? e.message : "Upload failed. Please try again.");
      setError(msg);
      toast.error(msg, { duration: 8000 });
    } finally {
      setUploadingRecording(null);
      abortRef.current = null;
      uploadRecording1InProgressRef.current = false;
    }
  };

  const METRIC_ANSWERS_VALIDATION_MSG = "Please answer all three questions before continuing.";

  const handleMetricAnswersSubmit = async (answer_1: string, answer_2: string, answer_3: string) => {
    if (!sessionId) return;
    if (metricSubmitInProgress.current) return;
    const a1 = answer_1.trim();
    const a2 = answer_2.trim();
    const a3 = answer_3.trim();
    if (!a1 || !a2 || !a3) {
      setError(METRIC_ANSWERS_VALIDATION_MSG);
      toast.error(METRIC_ANSWERS_VALIDATION_MSG);
      return;
    }
    metricSubmitInProgress.current = true;
    setLoading(true);
    setError(null);
    if (typeof window !== "undefined") {
      console.warn("[HomeworkFlow] metric answers submit started", { sessionId: sessionId?.slice(0, 8) + "…" });
    }
    try {
      const metricResponse = await homeworkApi.submitMetricAnswers(sessionId, {
        metric_answer_1: a1,
        metric_answer_2: a2,
        metric_answer_3: a3,
      });
      const responseErr = metricResponse && typeof (metricResponse as { error?: string }).error === "string" ? (metricResponse as { error: string }).error : null;
      if (typeof window !== "undefined") {
        console.warn("[HomeworkFlow] metric-answers response", {
          hasFinalTask: !!metricResponse?.final_task,
          hasError: !!responseErr,
          errorMsg: responseErr ?? undefined,
        });
      }
      if (metricResponse?.recording_1_fallback && metricResponse?.message?.trim()) {
        toast.info(metricResponse.message.trim());
      }
      applyStatusToState({
        status: "final_task_ready",
        session_id: sessionId,
        final_task: typeof metricResponse?.final_task === "string" ? metricResponse.final_task : undefined,
      });
      toast.success("Answers saved. Continue to the final recording.");
    } catch (e) {
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      if (typeof window !== "undefined") {
        console.warn("[HomeworkFlow] metric submit catch", e instanceof Error ? e.message : String(e));
      }
      const errCode = (e as HomeworkApiError).code;
      const errMessage = e instanceof Error ? e.message : "Failed to submit";

      if (errCode === "RECORDING_1_FAILED") {
        setMetricStepBlockedByRecordingFailure(true);
        setError(errMessage || "We couldn't analyze your recording. Please try again or contact support.");
        toast.error(errMessage || "We couldn't analyze your recording. Please try again or contact support.");
        return;
      }

      // Approved exception: when POST metric-answers returns 409 RECORDING_1_PROCESSING, poll GET status only to decide when to retry the same mutation. Do not pass this GET response to applyStatusToState; step advances only when POST metric-answers succeeds, then applyStatusToState(retryResponse).
      if (errCode === "RECORDING_1_PROCESSING") {
        setError(errMessage || "Still analyzing your recording. Please wait a moment.");
        toast.info(errMessage || "Still analyzing your recording. Please wait a moment.");
        const maxWaitMs = 60000;
        const pollIntervalMs = 2500;
        const start = Date.now();
        while (Date.now() - start < maxWaitMs && sessionId) {
          await new Promise((r) => setTimeout(r, pollIntervalMs));
          try {
            // Poll GET only to decide when to retry the same mutation; step advances only when POST metric-answers succeeds below.
            // GET status only to decide when to retry; do not call applyStatusToState(statusRes).
            const statusRes = await homeworkApi.getStatus();
            const session = (statusRes as { session?: { performance_score_1?: number; context_short?: string; recording_1_processing_status?: string } })?.session;
            const ready = session?.performance_score_1 != null && (session?.context_short || session?.recording_1_processing_status === "completed");
            if (ready) {
              const retryResponse = await homeworkApi.submitMetricAnswers(sessionId, {
                metric_answer_1: a1,
                metric_answer_2: a2,
                metric_answer_3: a3,
              });
              applyStatusToState({
                status: "final_task_ready",
                session_id: sessionId,
                final_task: typeof retryResponse?.final_task === "string" ? retryResponse.final_task : undefined,
              });
              setError(null);
              if (retryResponse?.recording_1_fallback && retryResponse?.message?.trim()) {
                toast.info(retryResponse.message.trim());
              }
              toast.success("Answers saved. Continue to the final recording.");
              return;
            }
          } catch (retryErr) {
            if ((retryErr as HomeworkApiError).code === "RECORDING_1_PROCESSING") continue;
            if ((retryErr as HomeworkApiError).code === "RECORDING_1_FAILED") {
              setMetricStepBlockedByRecordingFailure(true);
              setError((retryErr as Error).message || "We couldn't analyze your recording. Please try again or contact support.");
              toast.error((retryErr as Error).message || "We couldn't analyze your recording. Please try again or contact support.");
              return;
            }
            throw retryErr;
          }
        }
        setError("Analysis is taking longer than usual. Please try again in a moment.");
        toast.error("Analysis is taking longer than usual. Please try again in a moment.");
        return;
      }

      if (isInvalidSessionStateError(e)) {
        // Do not call GET status here (contract: no GET inside mutation handler). User can refresh or refocus.
        // Advancing to step 3 on 409 would let the UI progress before metric-answers has actually succeeded.
        const msg =
          errMessage?.trim() ||
          "Session state conflict. The system may still be processing. Please wait a moment and click Continue again.";
        setError(msg);
        toast.info(msg);
      } else {
        const displayMsg =
          typeof errMessage === "string" && errMessage.trim()
            ? errMessage
            : errCode === "VALIDATION_ERROR"
              ? METRIC_ANSWERS_VALIDATION_MSG
              : "Failed to save answers. Please try again or refresh.";
        setError(displayMsg);
        toast.error(displayMsg);
      }
    } finally {
      setLoading(false);
      metricSubmitInProgress.current = false;
    }
  };

  const handleRecording2Complete = async (blob: Blob, durationSeconds: number) => {
    if (!sessionId) return;
    if (uploadRecording2InProgressRef.current) return;
    uploadRecording2InProgressRef.current = true;
    if (durationSeconds < RECORDING_2_DURATION_MIN || durationSeconds > RECORDING_2_DURATION_MAX) {
      uploadRecording2InProgressRef.current = false;
      const msg = `Final recording must be at least 1 minute 2 seconds (62s) and at most 5 minutes. You recorded ${durationSeconds}s.`;
      setError(msg);
      toast.error(msg);
      return;
    }
    if (uploadingRecording === 2) {
      uploadRecording2InProgressRef.current = false;
      return;
    }
    setUploadingRecording(2);
    setError(null);
    abortRef.current = new AbortController();
    try {
      const res = await homeworkApi.uploadRecording2(sessionId, blob, durationSeconds, abortRef.current.signal);
      applyStatusToState({
        status: "post_questions",
        session_id: sessionId,
        ...(res.performance_score_2 !== undefined && { performance_score_2: res.performance_score_2 }),
      });
    } catch (e) {
      console.error("[HomeworkFlow] handleRecording2Complete error", e);
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      const msg = isInvalidSessionStateError(e)
        ? "Session state conflict. Please refresh the page or switch tab and back."
        : (e instanceof Error ? e.message : "Upload failed. Please try again.");
      setError(msg);
      toast.error(msg, { duration: 8000 });
    } finally {
      setUploadingRecording(null);
      abortRef.current = null;
      uploadRecording2InProgressRef.current = false;
    }
  };

  const handlePostAnswersSubmit = async (answersFromChild: Record<string, string>) => {
    if (!sessionId) return;
    if (postAnswersSubmitInProgress.current) return;
    const missing = questions.filter((q) => !(answersFromChild[toId(q.id)] ?? "").trim());
    if (missing.length > 0) {
      setError("Please answer all questions before continuing.");
      return;
    }
    postAnswersSubmitInProgress.current = true;
    setLoading(true);
    setError(null);
    try {
      const answers = questions.map((q) => ({
        question_id: toId(q.id),
        answer_text: (answersFromChild[toId(q.id)] ?? "").trim(),
      }));
      const res = await homeworkApi.submitPostAnswers(sessionId, answers);
      applyStatusToState({
        status: "completed",
        session_id: sessionId,
        report_text: res.report_text ?? "",
        performance_score_end: res.performance_score_end ?? null,
      });
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(
          "homeworkReport",
          JSON.stringify({ sessionId, reportText: res.report_text ?? "", performanceScoreEnd: res.performance_score_end ?? null })
        );
      }
    } catch (e) {
      if (isSessionGoneError(e)) {
        toast.info("Your session is gone. You can start a new lesson.");
        startOverFromScratch();
        return;
      }
      const err = e as { code?: string };
      if (err.code === "INVALID_SESSION_STATE") {
        setError("Session state conflict. Please refresh the page or switch tab and back.");
        toast.error("Session state conflict. Please refresh the page or switch tab and back.");
      } else {
        const msg = e instanceof Error ? e.message : "Failed to submit";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      postAnswersSubmitInProgress.current = false;
    }
  };

  const allPostQuestionsAnswered =
    questions.length === 0 ||
    questions.every((q) => (postAnswers[toId(q.id)] ?? "").trim() !== "");

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

    const step0ReportsListId = "step0-reports-history";

    return (
      <div className="flex flex-col items-center w-full pt-0 -mt-8 sm:-mt-10">
        <StepFlowWrapper step={0} syncingBehind={syncingBehind}>
          <Card className="w-full max-w-md mx-auto p-6 sm:p-8 border-0 bg-transparent shadow-none">
            <div className="flex flex-col items-center w-full max-w-[280px] mx-auto space-y-4">
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

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (showReportsList) {
                    setShowReportsList(false);
                  } else {
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
                    {step0Sessions.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => {
                          setReportModalSessionId(s.id);
                          setReportsModalOpen(true);
                        }}
                        className="w-full rounded-xl border border-border bg-muted/30 p-4 shadow-sm text-left hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                          </p>
                          {s.status === "completed" ? (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {s.coach_grade != null ? `Grade: ${s.coach_grade}/10` : "Not graded"}
                            </span>
                          ) : (!!s.recording_id || !!(s as { recording_1_id?: string }).recording_1_id) ? (
                            <span className="text-xs font-medium text-primary shrink-0">🎙 Recording</span>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-foreground line-clamp-3">
                          {s.report_preview?.report_text_preview?.trim() || "Recording available — tap to listen."}
                        </p>
                        <p className="text-xs text-primary mt-2">
                          {s.report_preview?.report_text_preview?.trim() ? "View full report and recording →" : "View recording →"}
                        </p>
                      </button>
                    ))}
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

  // Step 1: Warm-up text + recorder — show as soon as session exists (from POST start response)
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
    const warmUpEmpty = sessionId && !warmUpText.trim();
    const showStatusUnknownBlock = statusUnknown;
    const showWarmUpUnavailableBlock = warmUpEmpty && !statusUnknown;

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
        {showWarmUpUnavailableBlock && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex flex-col gap-2">
            <p>Warm-up prompt unavailable. Start over to begin a new session.</p>
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
        {!showStatusUnknownBlock && !showWarmUpUnavailableBlock && (
          <AudioRecorder
            prompt={warmUpText.trim() || DEFAULT_WARMUP_QUESTION}
            onRecordingComplete={handleRecording1Complete}
            onTranscriptAvailable={(t) => { if (t) setLocalTranscript(t); }}
            onSniperSnapshot={(snapshot) => {
              setSniperSnapshot(snapshot);
              const body: {
                session_means: typeof snapshot.sessionMeans;
                stage_score: number;
                voiced_duration_sec: number;
                session_id?: string;
              } = {
                session_means: snapshot.sessionMeans,
                stage_score: snapshot.overallScore,
                voiced_duration_sec: snapshot.sessionMeans.voicedDurationSec,
              };
              if (sessionId && sessionId !== "mock-session") body.session_id = sessionId;
              fetch("/api/user/sniper-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              })
                .then((r) => r.json())
                .then((data) => {
                  if (data && typeof data.session_count === "number") setSniperProfile(data);
                })
                .catch(() => {});
            }}
            stopAndSend
            uploading={isUploadingRec1}
            minDurationSeconds={RECORDING_1_DURATION_MIN}
            sniperMode
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

  // Step 2: Show 1–10 self-rating only when GET session/status returns ready_for_self_rating: true; then POST self-rating, then poll GET report until 200.
  if (step === 2) {
    const showRatingForm = readyForSelfRating === true;
    return (
      <StepFlowWrapper step={2} syncingBehind={syncingBehind}>
        {coachMessageBlock}
        <Card className="w-full max-w-md mx-auto border-0 bg-transparent p-6 shadow-none">
          {!showRatingForm ? (
            <div className="text-center space-y-4 py-4">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">
                Your recording is being processed. We&apos;ll show the next step shortly.
              </p>
            </div>
          ) : (
            <>
          <p className="text-sm font-medium text-muted-foreground mb-2">
            How did that recording feel for you?
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            1 = Really off · 5 = Okay · 10 = This is how I want to sound. This helps us learn what your best looks like.
          </p>
          {!backendReadyForSelfRating && (
            <p className="text-xs text-muted-foreground mb-2">
              Waiting for your recording to be processed… You can submit once this is complete.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                size="sm"
                disabled={savingStudentRating || !backendReadyForSelfRating}
                onClick={async () => {
                  if (!sessionId || sessionId === "mock-session") return;
                  if (!backendReadyForSelfRating) return;
                  setSavingStudentRating(true);
                  try {
                    lastSelfRatingPayloadRef.current = { sessionId, rating: n };
                    const res = await homeworkApi.submitSelfRating(sessionId, n);
                    setStudentSpeechRatingSubmitted(true);
                    setStep(5);
                    if (res.session_completed === false) {
                      setPendingRetrySelfRating({ sessionId, rating: n });
                    }
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Could not save rating. Try again.");
                  } finally {
                    setSavingStudentRating(false);
                  }
                }}
                className="min-w-[2.25rem]"
              >
                {n}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={savingStudentRating || !backendReadyForSelfRating}
            onClick={async () => {
              if (!sessionId || sessionId === "mock-session") {
                setStudentSpeechRatingSubmitted(true);
                setStep(5);
                return;
              }
              if (!backendReadyForSelfRating) return;
              setSavingStudentRating(true);
              try {
                lastSelfRatingPayloadRef.current = { sessionId, skipped: true };
                const res = await homeworkApi.submitSelfRatingSkipped(sessionId);
                setStudentSpeechRatingSubmitted(true);
                setStep(5);
                if (res.session_completed === false) {
                  setPendingRetrySelfRating({ sessionId, skipped: true });
                }
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save. Try again.");
              } finally {
                setSavingStudentRating(false);
              }
            }}
            className="text-muted-foreground"
          >
            Skip
          </Button>
            </>
          )}
        </Card>
      </StepFlowWrapper>
    );
  }

  // Step 4 unused: no reflective questions; flow is record → self-rate (step 2) → report (step 5).

  // Step 5: Report — only show report content when data (or error) is loaded; otherwise show loading
  if (step === 5) {
    const step5DataReady =
      reportData != null ||
      (reportError != null && !reportLoading) ||
      reportNotReady;
    if (!step5DataReady) {
      return (
        <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
          <Card className="border-0 bg-transparent p-6 shadow-none">
            <div className="text-center space-y-4 flex flex-col items-center">
              {loadingLottieData ? (
                <div className="w-24 h-24">
                  <Lottie animationData={loadingLottieData} loop />
                </div>
              ) : (
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
              <p className="text-sm text-muted-foreground">Your report is being generated.</p>
              <p className="text-xs text-muted-foreground">Taking too long? You can start a new practice below.</p>
              <Button onClick={handleStartOver} disabled={resetting} className="mt-2 w-full max-w-xs rounded-xl h-12 font-semibold">
                {resetting ? "Resetting…" : "Start New Practice"}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    // Backend returned REPORT_NOT_READY (404): report is still being generated — show Lottie and auto-refresh
    if (reportNotReady) {
      return (
        <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
          {coachMessageBlock}
          <Card className="border-0 bg-transparent p-6 space-y-4 shadow-none">
            <h3 className="text-center text-lg font-semibold">Your report</h3>
            <div className="flex flex-col items-center rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              {loadingLottieData ? (
                <div className="w-24 h-24">
                  <Lottie animationData={loadingLottieData} loop />
                </div>
              ) : (
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              )}
              <p className="text-sm text-foreground text-center">
                Your report is being generated. This usually takes a minute after your recording is processed. We’ll refresh automatically.
              </p>
              <p className="text-xs text-muted-foreground text-center">You can also start a new practice below if you don't want to wait.</p>
              <Button onClick={handleStartOver} disabled={resetting} className="mt-2 w-full max-w-xs rounded-xl h-12 font-semibold">
                {resetting ? "Resetting…" : "Start New Practice"}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    // Report API failed (e.g. network or 5xx): show clear end state with Try again + Start over
    if (reportError != null && reportData == null) {
      return (
        <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
          {coachMessageBlock}
          <Card className="border-0 bg-transparent p-6 space-y-4 shadow-none">
            <h3 className="text-center text-lg font-semibold">Your report</h3>
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm text-foreground">
                We couldn’t load your report right now. This can happen if the report is still being generated—try again in a moment, or start a new practice below.
              </p>
              <p className="text-sm text-destructive">{reportError}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => {
                  setReportError(null);
                  setReportRetryCount((c) => c + 1);
                }}
                disabled={reportLoading}
                className="flex-1 rounded-xl h-12 font-semibold"
              >
                {reportLoading ? "Loading…" : "Try again"}
              </Button>
              <Button onClick={handleStartOver} disabled={resetting} variant="outline" className="flex-1 rounded-xl h-12 font-semibold">
                {resetting ? "Resetting…" : "Start New Practice"}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    const displayScores = reportData?.scores ?? (performanceScoreEnd != null ? { warmup: undefined, final: undefined, overall: Math.round(performanceScoreEnd * 100) } : undefined);
    const displayReportText = reportData?.report_text ?? reportText;
    const reportCtaLabel = (reportData?.report_cta ?? "").trim() || "Send Your Practice to the Coach!";

    // Progress chart needs performance_history from GET report (oldest first). Cap at last 5.
    const performanceHistory = reportData?.performance_history;
    const lastFive = performanceHistory?.length ? performanceHistory.slice(-5) : [];
    const progressChartDataRaw =
      lastFive.length > 0
        ? lastFive.map((p, i) => ({
            sessionLabel: `S${i + 1}`,
            date: p.date,
            score: p.score,
          }))
        : displayScores?.overall != null
          ? [{ sessionLabel: "S1", date: new Date().toISOString(), score: displayScores.overall }]
          : [];
    // Patch applied below after sniperDisplayScore is computed.

    const coachMessageFallback = "Your coach has 24 hours to analyse your practice and send a feedback on your email!";

    // Sniper display score — same calculation as SniperReviewSummary so the chart always matches.
    // Patches the most-recent history entry when the backend stored 0 due to the race condition.
    const sniperDisplayScore = sniperSnapshot
      ? Math.round(
          computeAdaptiveResult(
            sniperProfile,
            sniperSnapshot.overallScore,
            sniperSnapshot.sessionMeans,
            sniperSnapshot.sessionMeans.energyRatio != null,
          ).displayScore,
        )
      : null;

    // Apply patch to full-report chart data (simplified path patched separately below).
    const progressChartData =
      sniperDisplayScore !== null && progressChartDataRaw.length > 0
        ? [
            ...progressChartDataRaw.slice(0, -1),
            { ...progressChartDataRaw[progressChartDataRaw.length - 1], score: sniperDisplayScore },
          ]
        : progressChartDataRaw;

    // Playback: final_recording.audio_url or recording.audio_url (same when one recording) or recording_1 (legacy).
    const playbackUrl =
      reportData?.final_recording?.audio_url ??
      reportData?.recording?.audio_url ??
      reportData?.recording_1?.audio_url;
    // Full transcription: prefer live Web Speech transcript; fall back to backend field.
    const transcriptionText = (
      localTranscript ||
      reportData?.recording?.transcription_text ??
      reportData?.transcription_text ??
      reportData?.transcript ??
      ""
    ).trim();
    // Filler: prefer Claude-analysed counts (from live transcript); fall back to backend.
    const fillerTotal =
      claudeFillerWords?.total ?? reportData?.recording?.filler_words_count?.total ?? reportData?.filler_word_count ?? null;
    const fillerBreakdown = claudeFillerWords?.breakdown ?? reportData?.recording?.filler_words_count?.breakdown;
    const coachInsight = (reportData?.coach_insight ?? "").trim();

    // Simplified report when we skipped from step 2 (recording-1 only): recording + transcript + filler + strength/pace + chart + coach block.
    if (reportFromRecording1Only) {
      const strength = (reportData?.strength_metric ?? "").trim();
      const pace = (reportData?.pace_metric ?? "").trim();
      const score1 = reportData?.performance_score_1 != null
        ? Math.round(reportData.performance_score_1 * 100)
        : reportData?.scores?.overall;
      const history1 = reportData?.performance_history;
      const lastFive1 = history1?.length ? history1.slice(-5) : [];
      const progressChartData1Raw =
        lastFive1.length > 0
          ? lastFive1.map((p, i) => ({ sessionLabel: `S${i + 1}`, date: p.date, score: p.score }))
          : score1 != null
            ? [{ sessionLabel: "S1", date: new Date().toISOString(), score: score1 }]
            : [];
      // Patch the most-recent entry with the local sniper score so the chart always matches
      // SniperReviewSummary (backend may have stored 0 due to the race condition).
      const progressChartData1 =
        sniperDisplayScore !== null && progressChartData1Raw.length > 0
          ? [
              ...progressChartData1Raw.slice(0, -1),
              { ...progressChartData1Raw[progressChartData1Raw.length - 1], score: sniperDisplayScore },
            ]
          : progressChartData1Raw;

      return (
        <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
          <h3 className="text-center text-xl font-semibold">Your report</h3>
          {coachMessageBlock}
          {sniperSnapshot ? (
            <SniperReviewSummary snapshot={sniperSnapshot} profile={sniperProfile} />
          ) : null}
          {/* Self-rate (1–10) fallback if user landed on report without doing step 2; uses same homework self-rating API. */}
          {sniperSnapshot && sessionId && sessionId !== "mock-session" && !studentSpeechRatingSubmitted ? (
            <Card className="border-0 bg-transparent p-6 shadow-none">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                How did that recording feel for you?
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                1 = Really off · 5 = Okay · 10 = This is how I want to sound. This helps us learn what your best looks like.
              </p>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingStudentRating}
                    onClick={() => {
                      setSavingStudentRating(true);
                      homeworkApi
                        .submitSelfRating(sessionId, n)
                        .finally(() => {
                          setSavingStudentRating(false);
                          setStudentSpeechRatingSubmitted(true);
                        });
                    }}
                    className="min-w-[2.25rem]"
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={savingStudentRating}
                onClick={() => setStudentSpeechRatingSubmitted(true)}
                className="text-muted-foreground"
              >
                Skip
              </Button>
            </Card>
          ) : null}
          <Card className="border-0 bg-transparent p-6 space-y-4 shadow-none">
            {reportError && (
              <p className="text-sm text-destructive">{reportError}</p>
            )}
            <div className="space-y-4">
              {/* 1. Recording playback */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Your recording</p>
                {playbackUrl && !audioPlaybackError ? (
                  <audio
                    controls
                    src={playbackUrl}
                    className="w-full max-w-md"
                    onError={() => setAudioPlaybackError(true)}
                  />
                ) : audioPlaybackError ? (
                  <p className="text-sm text-muted-foreground">Recording playback failed. The audio may be unavailable.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Recording playback not available.</p>
                )}
              </div>
              {/* 2. Transcript */}
              {transcriptionText ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Transcript</p>
                  <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-48 overflow-y-auto">
                    <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{transcriptionText}</p>
                  </div>
                </div>
              ) : reportData ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Transcript</p>
                  <p className="text-sm text-muted-foreground italic">Transcript not available for this session.</p>
                </div>
              ) : null}
              {/* 3. Filler words */}
              {fillerTotal != null && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Filler words</p>
                  <p className="text-sm text-foreground">
                    {fillerTotal} filler word{fillerTotal !== 1 ? "s" : ""} detected
                    {formatFillerBreakdown(fillerBreakdown) ? ` (${formatFillerBreakdown(fillerBreakdown)})` : ""}.
                  </p>
                </div>
              )}
              {/* 4. Claude AI coaching (replaces backend report_text) */}
              {(claudeInsight || claudeLoading) ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">AI Coaching</p>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    {claudeLoading ? (
                      <p className="text-sm text-muted-foreground animate-pulse">Analysing your session…</p>
                    ) : (
                      <p className="text-sm text-foreground leading-relaxed">{claudeInsight}</p>
                    )}
                  </div>
                </div>
              ) : null}
              {/* 5. Strength and pace */}
              {(strength || pace) ? (
                <div className="flex flex-wrap gap-6">
                  {strength ? (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Strength</p>
                      <p className="text-sm text-foreground">{strength}</p>
                    </div>
                  ) : null}
                  {pace ? (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Pace</p>
                      <p className="text-sm text-foreground">{pace}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {/* 6. Progress chart */}
              {progressChartData1.length > 0 && (
                <ProgressOverSessionsChart data={progressChartData1} />
              )}
              {/* 7. Human coach block or fallback */}
              {(coachInsight || coachMessageFallback) && (
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-sm text-foreground leading-relaxed">
                    {coachInsight || coachMessageFallback}
                  </p>
                </div>
              )}
            </div>
            <Button onClick={handleStartOver} disabled={resetting} className="mt-2 w-full rounded-xl h-12 font-semibold">
              {resetting ? "Resetting…" : reportCtaLabel}
            </Button>
          </Card>
        </div>
      );
    }

    // Full report: playback, chart, transcript when present, report text, coach insight when present. Self-rate is step 2 only.
    return (
      <div className="mx-auto max-w-2xl space-y-4 animate-fade-in">
        <h3 className="text-center text-xl font-semibold">Your report</h3>
        {coachMessageBlock}
        {sniperSnapshot ? (
          <SniperReviewSummary snapshot={sniperSnapshot} profile={sniperProfile} />
        ) : null}
        <Card className="border-0 bg-transparent p-6 space-y-4 shadow-none">
          {reportError && (
            <p className="text-sm text-destructive">{reportError}</p>
          )}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Your final recording</p>
              {playbackUrl && !audioPlaybackError ? (
                <audio
                  controls
                  src={playbackUrl}
                  className="w-full max-w-md"
                  onError={() => setAudioPlaybackError(true)}
                />
              ) : audioPlaybackError ? (
                <p className="text-sm text-muted-foreground">Recording playback failed. The audio may be unavailable.</p>
              ) : (
                <p className="text-sm text-muted-foreground">Recording playback not available.</p>
              )}
            </div>
            {progressChartData.length > 0 && (
              <ProgressOverSessionsChart data={progressChartData} />
            )}
            {transcriptionText ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Transcript</p>
                <div className="rounded-xl border border-border bg-muted/30 p-4 max-h-48 overflow-y-auto">
                  <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{transcriptionText}</p>
                </div>
              </div>
            ) : reportData ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Transcript</p>
                <p className="text-sm text-muted-foreground italic">Transcript not available for this session.</p>
              </div>
            ) : null}
            {(fillerTotal != null || formatFillerBreakdown(fillerBreakdown)) ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Filler words</p>
                <p className="text-sm text-foreground">
                  {fillerTotal != null
                    ? `${fillerTotal} filler word${fillerTotal !== 1 ? "s" : ""} detected${formatFillerBreakdown(fillerBreakdown) ? ` (${formatFillerBreakdown(fillerBreakdown)})` : ""}.`
                    : formatFillerBreakdown(fillerBreakdown)}
                </p>
              </div>
            ) : null}
            {/* Claude AI coaching — replaces backend report_text */}
            {(claudeInsight || claudeLoading) ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">AI Coaching</p>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  {claudeLoading ? (
                    <p className="text-sm text-muted-foreground animate-pulse">Analysing your session…</p>
                  ) : (
                    <p className="text-sm text-foreground leading-relaxed">{claudeInsight}</p>
                  )}
                </div>
              </div>
            ) : displayReportText.trim() ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">AI Coaching</p>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">{displayReportText.trim()}</p>
                </div>
              </div>
            ) : null}
            {coachInsight ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-muted-foreground mb-1">Coach insight</p>
                <p className="text-sm text-foreground leading-relaxed">{coachInsight}</p>
              </div>
            ) : null}
          </div>
          <Button onClick={handleStartOver} disabled={resetting} className="mt-2 w-full rounded-xl h-12 font-semibold">
            {resetting ? "Resetting…" : reportCtaLabel}
          </Button>
        </Card>
      </div>
    );
  }

  return null;
}
