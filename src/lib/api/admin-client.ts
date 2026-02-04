/**
 * Admin API client — calls Next.js BFF /api/admin/* (proxied to backend /v2/admin/*).
 * Use only in admin pages; BFF must send admin token.
 */

const getBase = () => (typeof window === "undefined" ? "" : "");

type AdminFetchOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
};

async function adminFetch<T>(
  path: string,
  options: AdminFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;
  const url = `${getBase()}/api/admin${path}`;
  const bodySerialized: BodyInit | null =
    body == null ? null : body instanceof FormData ? body : JSON.stringify(body);
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: {
      ...(typeof headers === "object" && headers !== null ? headers : {}),
      ...(bodySerialized != null && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(bodySerialized != null && { body: bodySerialized }),
  };
  const res = await fetch(url, init);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    const msg = err.error || err.code || `HTTP ${res.status} for ${path}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export interface StudentListItem {
  user_id: string;
  /** When present, shown as primary label on the students list */
  email?: string | null;
  user_email?: string | null;
  sessions_count?: number;
  last_session_at?: string | null;
  avg_performance?: number | null;
}

export interface StudentProfile {
  user_id: string;
  email: string | null;
  overrides: {
    show_exercise_step?: boolean;
    intended_emotion_prompt?: string;
    keywords_prompt?: string;
    emotion_check_question_text?: string;
    assigned_post_question_ids?: string[];
    assigned_next_exercise_id?: string;
    assigned_next_task_ids?: string[];
  } | null;
  speaker_profile: {
    main_goal?: string;
    motivation?: string;
    strong_points?: string;
    weak_points?: string;
    charismatic_traits?: string;
    hobbies_interests?: string;
    personality_type?: string;
    coach_notes?: string;
  } | null;
  sessions: Array<{
    id: string;
    created_at: string;
    status: string;
    recording_id?: string;
    report_id?: string;
    task_score?: number;
    recording_preview?: { performance_score_v2?: number; transcription_preview?: string };
    report_preview?: { report_text_preview?: string };
  }>;
}

export interface Exercise {
  id: string;
  title: string;
  video_url?: string | null;
  description?: string | null;
  min_task_score?: number;
  max_task_score?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  prompt_text?: string | null;
  min_task_score?: number;
  max_task_score?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface PostQuestion {
  id: string;
  code?: string | null;
  text: string;
  answer_type: string;
  is_active?: boolean;
  order_index?: number;
}

export interface MetricLabel {
  code: string;
  left_label: string;
  right_label: string;
}

/** Warm-up task (per student); for future homework flow. Admin CRUD. */
export interface WarmUpTask {
  id: string;
  user_id: string;
  text: string;
  order_index?: number;
  created_at?: string;
}

/** Metric question (position 1 or 2); used in task text for future homework flow. */
export interface MetricQuestion {
  id: string;
  position: 1 | 2;
  text: string;
  created_at?: string;
}

export const adminApi = {
  getStudents: (params?: { limit?: number; offset?: number }) =>
    adminFetch<{ students: StudentListItem[]; limit?: number; offset?: number }>(
      `/students?${new URLSearchParams((params ?? {}) as Record<string, string>).toString()}`
    ),

  getStudentProfile: (userId: string) =>
    adminFetch<StudentProfile>(`/students/${userId}`),

  putOverrides: (userId: string, data: Record<string, unknown>) =>
    adminFetch<{ status: string }>(`/students/${userId}/overrides`, { method: "PUT", body: data }),

  putSpeakerProfile: (userId: string, data: Record<string, unknown>) =>
    adminFetch<{ status: string }>(`/students/${userId}/speaker-profile`, { method: "PUT", body: data }),

  sendAssignment: (userId: string) =>
    adminFetch<{ status: string }>(`/students/${userId}/send-assignment`, { method: "POST" }),

  getWarmUpTasks: (userId: string) =>
    adminFetch<{ warm_up_tasks: WarmUpTask[] }>(`/students/${userId}/warm-up-tasks`).then((r) => r.warm_up_tasks ?? []),

  createWarmUpTask: (userId: string, data: { text: string; order_index?: number }) =>
    adminFetch<{ warm_up_task: WarmUpTask }>(`/students/${userId}/warm-up-tasks`, { method: "POST", body: data }),

  updateWarmUpTask: (userId: string, taskId: string, data: { text?: string; order_index?: number }) =>
    adminFetch<{ warm_up_task: WarmUpTask }>(`/students/${userId}/warm-up-tasks/${taskId}`, { method: "PUT", body: data }),

  deleteWarmUpTask: (userId: string, taskId: string) =>
    adminFetch<Record<string, unknown>>(`/students/${userId}/warm-up-tasks/${taskId}`, { method: "DELETE" }),

  getExercises: () =>
    adminFetch<{ exercises: Exercise[] }>("/exercises").then((r) => r.exercises ?? []),

  createExercise: (data: Partial<Exercise>) =>
    adminFetch<{ exercise: Exercise }>("/exercises", { method: "POST", body: data }),

  updateExercise: (id: string, data: Partial<Exercise>) =>
    adminFetch<{ exercise: Exercise }>(`/exercises/${id}`, { method: "PUT", body: data }),

  deleteExercise: (id: string) =>
    adminFetch<{ status: string }>(`/exercises/${id}`, { method: "DELETE" }),

  getTasks: () =>
    adminFetch<{ tasks: Task[] }>("/tasks").then((r) => r.tasks ?? []),

  createTask: (data: Partial<Task>) =>
    adminFetch<{ task: Task }>("/tasks", { method: "POST", body: data }),

  updateTask: (id: string, data: Partial<Task>) =>
    adminFetch<{ task: Task }>(`/tasks/${id}`, { method: "PUT", body: data }),

  deleteTask: (id: string) =>
    adminFetch<{ status: string }>(`/tasks/${id}`, { method: "DELETE" }),

  getPostQuestions: () =>
    adminFetch<{ questions: PostQuestion[] }>("/post-recording-questions").then((r) => r.questions ?? []),

  createPostQuestion: (data: Partial<PostQuestion>) =>
    adminFetch<{ question: PostQuestion }>("/post-recording-questions", { method: "POST", body: data }),

  updatePostQuestion: (id: string, data: Partial<PostQuestion>) =>
    adminFetch<{ question: PostQuestion }>(`/post-recording-questions/${id}`, { method: "PUT", body: data }),

  deletePostQuestion: (id: string) =>
    adminFetch<{ status: string }>(`/post-recording-questions/${id}`, { method: "DELETE" }),

  getMetricLabels: () =>
    adminFetch<{ metrics?: MetricLabel[]; metric_labels?: MetricLabel[] }>("/metrics").then(
      (r) => r.metrics ?? r.metric_labels ?? []
    ),

  putMetricLabels: (metrics: MetricLabel[]) =>
    adminFetch<{ status: string }>("/metrics", { method: "PUT", body: { metrics } }),

  getMetricQuestions: () =>
    adminFetch<{ questions: MetricQuestion[] }>("/metric-questions").then((r) => r.questions ?? []),

  createMetricQuestion: (data: { position: 1 | 2; text: string }) =>
    adminFetch<{ question: MetricQuestion }>("/metric-questions", { method: "POST", body: data }),

  updateMetricQuestion: (id: string, data: { position?: 1 | 2; text?: string }) =>
    adminFetch<{ question: MetricQuestion }>(`/metric-questions/${id}`, { method: "PUT", body: data }),

  deleteMetricQuestion: (id: string) =>
    adminFetch<Record<string, unknown>>(`/metric-questions/${id}`, { method: "DELETE" }),
};
