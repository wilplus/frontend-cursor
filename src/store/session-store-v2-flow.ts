/**
 * V2 session store — v2 flow only: universal_questions → exercise → task → intent → recording → post_questions → completed.
 * Uses v2Api and /api/v2/* only. Plan/report persisted to localStorage for resume.
 */
import { create } from "zustand";
import type { UUID } from "@/lib/api/types-v2";
import type {
  PlanSnapshotV2,
  UniversalQuestion,
  UniversalAnswersInput,
  PostRecordingQuestionV2,
  ReportV2,
  PerformanceMetricV2,
  MetricLabelV2,
} from "@/lib/api/types-v2";
import { v2Api } from "@/lib/api/client-v2";
import { abandonSession } from "@/lib/api/client";

export type SessionStateV2 =
  | "idle"
  | "universal_questions"
  | "exercise"
  | "task"
  | "intent"
  | "recording_ready"
  | "recording"
  | "recorded"
  | "uploading_processing"
  | "post_questions"
  | "finalizing"
  | "completed";

const PLAN_KEY = "willab:v2:plan:";
const REPORT_KEY = "willab:v2:report:";
const POST_QUESTIONS_KEY = "willab:v2:post_questions:";

function loadPlan(sessionId: UUID): PlanSnapshotV2 | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(PLAN_KEY + sessionId);
    return s ? (JSON.parse(s) as PlanSnapshotV2) : null;
  } catch {
    return null;
  }
}

function savePlan(sessionId: UUID, plan: PlanSnapshotV2): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PLAN_KEY + sessionId, JSON.stringify(plan));
  } catch {
    // ignore
  }
}

function loadReport(recordingId: UUID): { report: ReportV2; performanceScore: number; performanceMetrics: PerformanceMetricV2[]; metricLabelsSnapshot: MetricLabelV2[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(REPORT_KEY + recordingId);
    return s ? (JSON.parse(s) as any) : null;
  } catch {
    return null;
  }
}

function saveReport(recordingId: UUID, data: { report: ReportV2; performanceScore: number; performanceMetrics: PerformanceMetricV2[]; metricLabelsSnapshot: MetricLabelV2[] }): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REPORT_KEY + recordingId, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function loadPostQuestions(recordingId: UUID): PostRecordingQuestionV2[] | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(POST_QUESTIONS_KEY + recordingId);
    return s ? (JSON.parse(s) as PostRecordingQuestionV2[]) : null;
  } catch {
    return null;
  }
}

function savePostQuestions(recordingId: UUID, questions: PostRecordingQuestionV2[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(POST_QUESTIONS_KEY + recordingId, JSON.stringify(questions));
  } catch {
    // ignore
  }
}

interface SessionStoreV2 {
  state: SessionStateV2;
  sessionId: UUID | null;
  recordingId: UUID | null;
  plan: PlanSnapshotV2 | null;
  taskId: UUID | null;
  selectedTask: { id: UUID; title: string; prompt_text: string } | null;
  universalQuestions: UniversalQuestion[];
  universalAnswers: Partial<UniversalAnswersInput> | null;
  postQuestions: PostRecordingQuestionV2[];
  postAnswers: Record<UUID, string>;
  postAnswersSubmitted: boolean;
  report: ReportV2 | null;
  performanceScore: number | null;
  performanceMetrics: PerformanceMetricV2[];
  metricLabelsSnapshot: MetricLabelV2[];
  audioBlob: Blob | null;
  durationSeconds: number | null;
  recordingStartMs: number | null;
  recordingEndMs: number | null;
  loading: boolean;
  error: string | null;
  uploadPromise: Promise<void> | null;

  initialize: () => Promise<void>;
  startNewSession: () => Promise<void>;
  setUniversalAnswer: (field: keyof UniversalAnswersInput, value: number) => void;
  submitUniversalAnswers: () => Promise<void>;
  submitExerciseFeedback: (exerciseLiked: boolean) => Promise<void>;
  selectTask: (taskId: UUID) => Promise<void>;
  submitIntent: (intendedEmotion: string, keywords: [string, string, string]) => Promise<void>;
  setRecordingReady: () => void;
  setRecordingStart: (startMs: number) => void;
  setRecordingEnd: (endMs: number, blob: Blob) => void;
  uploadRecordingBlob: (abortController?: AbortController, options?: { background?: boolean }) => Promise<void>;
  transitionToPostQuestionsWithDefaults: () => void;
  updatePostAnswer: (questionId: UUID, answer: string) => void;
  submitPostAnswers: () => Promise<void>;
  abandonCurrentSession: () => Promise<void>;
  reset: () => void;
  forceResetLoading: () => void;
}

const DEFAULT_POST_QUESTIONS: PostRecordingQuestionV2[] = [];

export const useSessionStoreV2Flow = create<SessionStoreV2>((set, get) => ({
  state: "idle",
  sessionId: null,
  recordingId: null,
  plan: null,
  taskId: null,
  selectedTask: null,
  universalQuestions: [],
  universalAnswers: null,
  postQuestions: [],
  postAnswers: {},
  postAnswersSubmitted: false,
  report: null,
  performanceScore: null,
  performanceMetrics: [],
  metricLabelsSnapshot: [],
  audioBlob: null,
  durationSeconds: null,
  recordingStartMs: null,
  recordingEndMs: null,
  loading: false,
  error: null,
  uploadPromise: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const status = await v2Api.getSessionStatus();
      if (!status.has_active_session || !status.session_id) {
        set({ state: "idle", loading: false });
        return;
      }
      const sessionId = status.session_id;
      const plan = loadPlan(sessionId);

      if (!status.universal_answers_submitted) {
        const questions = await v2Api.fetchUniversalQuestions().catch(() => []);
        set({
          state: "universal_questions",
          sessionId,
          universalQuestions: questions,
          plan: null,
          loading: false,
        });
        return;
      }
      if (!plan) {
        set({ error: "Session state lost. Please start a new session.", state: "idle", loading: false });
        return;
      }
      if (plan.exercise && !status.exercise_feedback_submitted) {
        set({ state: "exercise", sessionId, plan, loading: false });
        return;
      }
      if (!status.task_selected && plan.tasks?.length) {
        set({ state: "task", sessionId, plan, taskId: null, selectedTask: null, loading: false });
        return;
      }
      const singleTask = plan.tasks?.length === 1 ? plan.tasks[0] : null;
      if (singleTask) {
        set((s) => ({ ...s, sessionId, plan, taskId: s.taskId ?? singleTask.id, selectedTask: s.selectedTask ?? singleTask }));
      }
      if (!status.intent_submitted) {
        set({ state: "intent", sessionId, plan, loading: false });
        return;
      }
      if (!status.recording_id) {
        set({ state: "recording_ready", sessionId, plan, loading: false });
        return;
      }
      const recordingId = status.recording_id;
      if (!status.post_answers_submitted) {
        const saved = loadPostQuestions(recordingId);
        set({
          state: "post_questions",
          sessionId,
          recordingId,
          plan,
          postQuestions: saved ?? [],
          loading: false,
        });
        return;
      }
      const reportData = loadReport(recordingId);
      set({
        state: "completed",
        sessionId,
        recordingId,
        plan,
        report: reportData?.report ?? null,
        performanceScore: reportData?.performanceScore ?? null,
        performanceMetrics: reportData?.performanceMetrics ?? [],
        metricLabelsSnapshot: reportData?.metricLabelsSnapshot ?? [],
        postAnswersSubmitted: true,
        loading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to initialize";
      if (msg.includes("401") || msg.includes("Token")) {
        set({ state: "idle", loading: false, error: null });
        return;
      }
      set({ error: msg, state: "idle", loading: false });
    }
  },

  startNewSession: async () => {
    set({ loading: true, error: null });
    try {
      const res = await v2Api.startSession();
      if (!res.session_id) throw new Error("Missing session_id");
      const questions = await v2Api.fetchUniversalQuestions().catch(() => []);
      set({
        state: "universal_questions",
        sessionId: res.session_id,
        plan: null,
        taskId: null,
        selectedTask: null,
        universalQuestions: questions,
        universalAnswers: null,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to start session",
        loading: false,
        state: "idle",
      });
    }
  },

  setUniversalAnswer: (field, value) => {
    set((s) => ({ universalAnswers: { ...s.universalAnswers, [field]: value } }));
  },

  submitUniversalAnswers: async () => {
    const { sessionId, universalAnswers } = get();
    if (!sessionId || !universalAnswers) return;
    const mood = universalAnswers.mood === 1 ? 1 : 0;
    const readinessRaw = Number(universalAnswers.readiness ?? 5);
    const readiness = Math.min(10, Math.max(1, Math.round(readinessRaw)));
    const mode_preference = (universalAnswers.mode_preference === 1 ? 1 : 0) as 0 | 1;
    if (universalAnswers.mood !== 0 && universalAnswers.mood !== 1) {
      set({ error: "Please answer: Do you feel more like Good or Not great?" });
      return;
    }
    if (Number.isNaN(readinessRaw) || readinessRaw < 1 || readinessRaw > 10) {
      set({ error: "Please set readiness (1–10)." });
      return;
    }
    set({ loading: true, error: null });
    try {
      const res = await v2Api.submitUniversalAnswers(sessionId, { mood, readiness, mode_preference });
      savePlan(sessionId, res.plan);
      const { plan } = res;
      if (plan.exercise) {
        set({ state: "exercise", plan, loading: false });
        return;
      }
      if (plan.tasks?.length === 1) {
        const t = plan.tasks[0];
        set({ state: "intent", plan, taskId: t.id, selectedTask: t, loading: false });
        return;
      }
      set({ state: "task", plan, taskId: null, selectedTask: null, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to submit",
        loading: false,
      });
    }
  },

  submitExerciseFeedback: async (exerciseLiked: boolean) => {
    const { sessionId, plan } = get();
    if (!sessionId) return;
    set({ loading: true, error: null });
    try {
      await v2Api.submitExerciseFeedback(sessionId, { exercise_liked: exerciseLiked });
      if (plan?.tasks?.length === 1) {
        const t = plan.tasks[0];
        set({ state: "intent", taskId: t.id, selectedTask: t, loading: false });
        return;
      }
      set({ state: "task", taskId: null, selectedTask: null, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to submit feedback",
        loading: false,
      });
    }
  },

  selectTask: async (taskId: UUID) => {
    const { sessionId, plan } = get();
    if (!sessionId) return;
    const task = plan?.tasks?.find((t) => t.id === taskId) ?? null;
    set({ loading: true, error: null });
    try {
      await v2Api.selectTask(sessionId, { task_id: taskId });
      set({ taskId, selectedTask: task, state: "intent", loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to select task",
        loading: false,
      });
    }
  },

  submitIntent: async (intendedEmotion: string, keywords: [string, string, string]) => {
    const { sessionId } = get();
    if (!sessionId) return;
    set({ loading: true, error: null });
    try {
      await v2Api.submitIntent(sessionId, { intended_emotion: intendedEmotion, keywords });
      set({ state: "recording_ready", loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to submit intent",
        loading: false,
      });
    }
  },

  setRecordingReady: () => set({ state: "recording_ready" }),
  setRecordingStart: (startMs: number) =>
    set({
      state: "recording",
      recordingStartMs: startMs,
      recordingEndMs: null,
      audioBlob: null,
      durationSeconds: null,
    }),
  setRecordingEnd: (endMs: number, blob: Blob) => {
    const { recordingStartMs } = get();
    const startMs = recordingStartMs ?? Date.now() - 30000;
    const durationSeconds = Math.max(1, Math.round((endMs - startMs) / 1000));
    set({
      state: "recorded",
      recordingEndMs: endMs,
      audioBlob: blob,
      durationSeconds,
    });
  },

  transitionToPostQuestionsWithDefaults: () =>
    set({
      state: "post_questions",
      postQuestions: DEFAULT_POST_QUESTIONS,
      recordingId: null,
      postAnswers: {},
      postAnswersSubmitted: false,
      loading: false,
      error: null,
    }),

  uploadRecordingBlob: async (abortController?, options?: { background?: boolean }) => {
    const { sessionId, taskId, audioBlob, durationSeconds } = get();
    if (!sessionId || !taskId || !audioBlob || durationSeconds == null) {
      set({ error: "Missing session, task, or recording." });
      return;
    }
    if (durationSeconds < 60) {
      set({ error: "Recording must be at least 1 minute." });
      return;
    }
    const background = options?.background === true;
    const run = async (): Promise<void> => {
      if (background) set({ error: null, loading: true });
      else set({ state: "uploading_processing", loading: true, error: null });
      try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("session_id", sessionId);
        formData.append("task_id", taskId);
        formData.append("duration_seconds", durationSeconds.toString());
        const res = await v2Api.uploadRecording(formData, abortController);
        const questions = res.post_questions?.length ? res.post_questions : [];
        if (sessionId) savePostQuestions(res.recording_id, questions);
        if (background) {
          set({
            recordingId: res.recording_id,
            postQuestions: questions,
            postAnswers: {},
            loading: false,
            error: null,
            uploadPromise: null,
          });
        } else {
          set({
            state: "post_questions",
            recordingId: res.recording_id,
            postQuestions: questions,
            postAnswers: {},
            postAnswersSubmitted: false,
            loading: false,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        set({
          error: msg,
          state: background ? "post_questions" : "recorded",
          loading: false,
          uploadPromise: null,
        });
      }
    };
    const promise = run();
    if (background) set({ uploadPromise: promise });
    await promise;
  },

  updatePostAnswer: (questionId, answer) => {
    set((s) => {
      const next = { ...s.postAnswers, [questionId]: answer };
      return { postAnswers: next };
    });
  },

  submitPostAnswers: async () => {
    let { sessionId, recordingId, postQuestions, postAnswers, uploadPromise } = get();
    if (!sessionId) return;
    if (!recordingId && uploadPromise) {
      await uploadPromise;
      const n = get();
      recordingId = n.recordingId;
      postQuestions = n.postQuestions;
      postAnswers = n.postAnswers;
    }
    if (!recordingId) {
      set({ error: "Upload not finished. Please wait or retry." });
      return;
    }
    const answers = postQuestions.map((q) => ({ question_id: q.id, answer_text: postAnswers[q.id] ?? "" }));
    set({ loading: true, error: null, state: "finalizing" });
    try {
      const res = await v2Api.submitPostAnswers({ session_id: sessionId, recording_id: recordingId, answers });
      if (res.recording_id) saveReport(res.recording_id, {
        report: res.report,
        performanceScore: res.performance_score,
        performanceMetrics: res.performance_metrics ?? [],
        metricLabelsSnapshot: res.metric_labels_snapshot ?? [],
      });
      set({
        state: "completed",
        report: res.report,
        performanceScore: res.performance_score,
        performanceMetrics: res.performance_metrics ?? [],
        metricLabelsSnapshot: res.metric_labels_snapshot ?? [],
        postAnswersSubmitted: true,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to submit answers",
        state: "post_questions",
        loading: false,
      });
    }
  },

  abandonCurrentSession: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    set({ loading: true, error: null });
    try {
      await abandonSession(sessionId);
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem(PLAN_KEY + sessionId);
        } catch {
          // ignore
        }
      }
      set({
        state: "idle",
        sessionId: null,
        recordingId: null,
        plan: null,
        taskId: null,
        selectedTask: null,
        universalQuestions: [],
        universalAnswers: null,
        postQuestions: [],
        postAnswers: {},
        report: null,
        performanceScore: null,
        performanceMetrics: [],
        metricLabelsSnapshot: [],
        audioBlob: null,
        durationSeconds: null,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to abandon",
        loading: false,
      });
    }
  },

  reset: () =>
    set({
      state: "idle",
      sessionId: null,
      recordingId: null,
      plan: null,
      taskId: null,
      selectedTask: null,
      universalQuestions: [],
      universalAnswers: null,
      postQuestions: [],
      postAnswers: {},
      report: null,
      performanceScore: null,
      performanceMetrics: [],
      metricLabelsSnapshot: [],
      audioBlob: null,
      durationSeconds: null,
      loading: false,
      error: null,
    }),

  forceResetLoading: () => set({ loading: false }),
}));
