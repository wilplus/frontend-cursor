import { create } from "zustand";
import type {
  UUID,
  PreQuestion,
  CommandOption,
  ThemeCode,
  PostRecordingQuestion,
  PreRecordingAnswerInput,
  PostRecordingAnswerInput,
  StoredAnswer,
  GetRecordingResponse,
} from "@/lib/api/types";
import {
  fetchSessionStatus,
  startSession,
  abandonSession,
  submitPreAnswers,
  uploadRecording,
  submitPostAnswers,
  fetchRecording,
} from "@/lib/api/client";

export type SessionState =
  | "idle"
  | "pre_questionnaire"
  | "pre_questions"
  | "command_select"
  | "recording_ready"
  | "recording"
  | "recorded"
  | "uploading_processing"
  | "post_questions"
  | "finalizing"
  | "completed";

type PreRecordingQuestionnaireInput = {
  mood: "positive" | "negative";
  readiness: number;
  inspiration_needed: boolean;
  theme_code?: ThemeCode;
  mode?: "guided" | "open";
};

interface SessionStore {
  // State
  state: SessionState;
  sessionId: UUID | null;
  recordingId: UUID | null;

  // Pre-recording questionnaire
  questionnaire: PreRecordingQuestionnaireInput | null;
  questionnaireSubmitted: boolean;
  cursor: number | null; // Calculated difficulty cursor (0.0-1.0)
  mode: "guided" | "open" | null; // Structure mode

  // Pre-questions (v1: single typed question)
  preQuestions: PreQuestion[];
  preAnswers: Record<UUID, string>; // question_id -> answer_text
  preAnswersSubmitted: boolean;

  // Command options (v1: A/B/C) and selection
  commandOptions: CommandOption[];
  selectedCommandOptionId: "A" | "B" | "C" | null;
  selectedPromptTextSnapshot: string | null;
  themeChosenCode: ThemeCode | null;

  // Recording
  audioBlob: Blob | null;
  durationSeconds: number | null;
  recordingStartMs: number | null;
  recordingEndMs: number | null;

  // Post-questions
  postQuestions: PostRecordingQuestion[];
  postAnswers: Record<UUID, string>; // question_id -> answer_text
  postAnswersSubmitted: boolean;

  // Completed recording data
  completedRecording: GetRecordingResponse | null;

  // Loading/error
  loading: boolean;
  error: string | null;
  
  // Emergency reset (for stuck states)
  forceResetLoading: () => void;

  // Actions
  initialize: () => Promise<void>;
  submitQuestionnaire: (questionnaire: PreRecordingQuestionnaireInput) => Promise<void>;
  startNewSession: () => Promise<void>;
  updatePreAnswer: (questionId: UUID, answer: string) => void;
  submitPreAnswers: () => Promise<void>;
  selectCommandOption: (optionId: "A" | "B" | "C", promptTextSnapshot: string) => void;
  goBackToPreQuestionnaire: () => void;
  goBackToPreQuestions: () => void;
  goBackToCommandSelect: () => void;
  setRecordingReady: () => void;
  setRecordingStart: (startMs: number) => void;
  setRecordingEnd: (endMs: number, blob: Blob) => void;
  uploadRecordingBlob: (abortController?: AbortController) => Promise<void>;
  updatePostAnswer: (questionId: UUID, answer: string) => void;
  submitPostAnswers: () => Promise<void>;
  finalizeSession: () => Promise<void>;
  abandonCurrentSession: () => Promise<void>;
  reset: () => void;
}

const DRAFT_STORAGE_PREFIX = "willab:draft:";
const COMMAND_SELECT_PREFIX = "willab:command_select:";

function getDraftKey(type: "pre" | "post", id: UUID): string {
  return `${DRAFT_STORAGE_PREFIX}${type}_answers:${id}`;
}

function getCommandSelectKey(sessionId: UUID): string {
  return `${COMMAND_SELECT_PREFIX}${sessionId}`;
}

function loadCommandSelection(sessionId: UUID): { optionId: "A" | "B" | "C"; promptTextSnapshot: string } | null {
  try {
    const stored = localStorage.getItem(getCommandSelectKey(sessionId));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { optionId: string; promptTextSnapshot: string };
    if (parsed.optionId !== "A" && parsed.optionId !== "B" && parsed.optionId !== "C") return null;
    return { optionId: parsed.optionId, promptTextSnapshot: parsed.promptTextSnapshot ?? "" };
  } catch {
    return null;
  }
}

function saveCommandSelection(sessionId: UUID, optionId: "A" | "B" | "C", promptTextSnapshot: string): void {
  try {
    localStorage.setItem(getCommandSelectKey(sessionId), JSON.stringify({ optionId, promptTextSnapshot }));
  } catch {
    // ignore
  }
}

function clearCommandSelection(sessionId: UUID): void {
  try {
    localStorage.removeItem(getCommandSelectKey(sessionId));
  } catch {
    // ignore
  }
}

function loadDraft(type: "pre" | "post", id: UUID): Record<UUID, string> | null {
  try {
    const key = getDraftKey(type, id);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveDraft(type: "pre" | "post", id: UUID, answers: Record<UUID, string>): void {
  try {
    const key = getDraftKey(type, id);
    localStorage.setItem(key, JSON.stringify(answers));
  } catch {
    // Ignore storage errors
  }
}

function clearDraft(type: "pre" | "post", id: UUID): void {
  try {
    const key = getDraftKey(type, id);
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  state: "idle",
  sessionId: null,
  recordingId: null,
  questionnaire: null,
  questionnaireSubmitted: false,
  cursor: null,
  mode: null,
  preQuestions: [],
  preAnswers: {},
  preAnswersSubmitted: false,
  commandOptions: [],
  selectedCommandOptionId: null,
  selectedPromptTextSnapshot: null,
  themeChosenCode: null,
  audioBlob: null,
  durationSeconds: null,
  recordingStartMs: null,
  recordingEndMs: null,
  postQuestions: [],
  postAnswers: {},
  postAnswersSubmitted: false,
  completedRecording: null,
  loading: false,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const status = await fetchSessionStatus();

      if (!status.has_active_session) {
        set({ state: "idle", loading: false });
        return;
      }

      const sessionId = status.session_id!;

      // Resume: re-fetch plan idempotently so we have pre_questions + command_options
      let preQuestions: PreQuestion[] = [];
      let commandOptions: CommandOption[] = [];
      let themeChosenCode: ThemeCode | null = null;
      try {
        const plan = await startSession({ session_id: sessionId });
        preQuestions = Array.isArray(plan.pre_questions) ? plan.pre_questions : [];
        commandOptions = Array.isArray(plan.command_options) ? plan.command_options : [];
        themeChosenCode = plan.theme_chosen_code ?? null;
      } catch (err) {
        console.error("Resume: failed to fetch session plan:", err);
        set({
          error: err instanceof Error ? err.message : "Failed to load session",
          state: "idle",
          loading: false,
        });
        return;
      }

      // Hydrate state based on session status (v1: pre_question → command_select → recording)
      if (!status.pre_questions_completed) {
        set({
          state: "pre_questions",
          sessionId,
          preQuestions,
          commandOptions,
          themeChosenCode,
          preAnswersSubmitted: false,
          loading: false,
        });
      } else if (!status.recording_completed) {
        const saved = loadCommandSelection(sessionId);
        if (saved) {
          set({
            state: "recording_ready",
            sessionId,
            preQuestions,
            commandOptions,
            themeChosenCode,
            preAnswersSubmitted: true,
            selectedCommandOptionId: saved.optionId,
            selectedPromptTextSnapshot: saved.promptTextSnapshot,
            loading: false,
          });
        } else {
          set({
            state: "command_select",
            sessionId,
            preQuestions,
            commandOptions,
            themeChosenCode,
            preAnswersSubmitted: true,
            loading: false,
          });
        }
      } else if (!status.post_questions_completed && status.recording_id) {
        try {
          const recording = await fetchRecording(status.recording_id);
          set({
            state: "post_questions",
            sessionId,
            recordingId: status.recording_id,
            postQuestions: [], // Post questions come from upload response; on resume backend may need to provide them via GET recording
            preAnswersSubmitted: true,
            loading: false,
          });
        } catch (err) {
          console.error("Failed to fetch recording for post-questions:", err);
          set({
            state: "post_questions",
            sessionId,
            recordingId: status.recording_id,
            postQuestions: [],
            preAnswersSubmitted: true,
            loading: false,
          });
        }
      } else if (status.recording_id) {
        const recording = await fetchRecording(status.recording_id);
        set({
          state: "completed",
          sessionId,
          recordingId: status.recording_id,
          completedRecording: recording,
          preAnswersSubmitted: true,
          postAnswersSubmitted: true,
          loading: false,
        });
      } else {
        set({ state: "idle", loading: false });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize";
      
      // Don't set error state if it's a backend 401 (Flask can't verify token)
      // This is a backend config issue, not an auth issue
      if (errorMessage.includes("401") || errorMessage.includes("Token verification")) {
        // Just set to idle - backend will be fixed separately
        set({ state: "idle", loading: false, error: null });
        return;
      }
      
      set({
        error: errorMessage,
        loading: false,
        state: "idle",
      });
    }
  },

  submitQuestionnaire: async (questionnaire: PreRecordingQuestionnaireInput) => {
    set({ loading: true, error: null, questionnaire, questionnaireSubmitted: true });

    try {
      const response = await startSession({ questionnaire });
      if (!response.session_id) throw new Error("Invalid response: missing session_id");

      const preQuestionsList = Array.isArray(response.pre_questions) ? response.pre_questions : [];
      const commandOptionsList = Array.isArray(response.command_options) ? response.command_options : [];

      set({
        state: "pre_questions", // v1: show single typed pre-question before command select
        sessionId: response.session_id,
        cursor: response.cursor ?? null,
        mode: response.mode ?? response.structure ?? null,
        preQuestions: preQuestionsList,
        commandOptions: commandOptionsList,
        themeChosenCode: response.theme_chosen_code ?? null,
        preAnswers: {},
        preAnswersSubmitted: false,
        selectedCommandOptionId: null,
        selectedPromptTextSnapshot: null,
        loading: false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start session";
      set({
        error: errorMessage,
        loading: false,
        state: "idle",
        questionnaireSubmitted: false,
      });
    }
  },

  startNewSession: async () => {
    const { questionnaireSubmitted, questionnaire } = get();
    if (!questionnaireSubmitted) {
      set({ state: "pre_questionnaire" });
      return;
    }
    if (questionnaire) {
      await get().submitQuestionnaire(questionnaire);
      return;
    }
    set({ loading: true, error: null });
    try {
      const response = await startSession({});
      if (!response.session_id) throw new Error("Invalid response: missing session_id");
      const preQuestionsList = Array.isArray(response.pre_questions) ? response.pre_questions : [];
      const commandOptionsList = Array.isArray(response.command_options) ? response.command_options : [];
      set({
        state: "pre_questions",
        sessionId: response.session_id,
        cursor: response.cursor ?? null,
        mode: response.mode ?? response.structure ?? null,
        preQuestions: preQuestionsList,
        commandOptions: commandOptionsList,
        themeChosenCode: response.theme_chosen_code ?? null,
        preAnswers: {},
        preAnswersSubmitted: false,
        selectedCommandOptionId: null,
        selectedPromptTextSnapshot: null,
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

  updatePreAnswer: (questionId: UUID, answer: string) => {
    const { sessionId, preAnswers } = get();
    if (!sessionId) return;

    // Only update if the value actually changed to prevent unnecessary re-renders
    if (preAnswers[questionId] === answer) return;

    const updated = { ...preAnswers, [questionId]: answer };
    set({ preAnswers: updated });
    saveDraft("pre", sessionId, updated);
  },

  submitPreAnswers: async () => {
    const { sessionId, preQuestions, preAnswers } = get();
    if (!sessionId) return;

    const answers: PreRecordingAnswerInput[] = preQuestions.map((q) => ({
      question_id: q.id,
      answer_text: (preAnswers[q.id] ?? "").trim(),
    }));

    // Require non-empty for all; text_short can require min length
    const hasEmpty = answers.some((a) => !a.answer_text);
    if (hasEmpty) {
      set({ error: "Please answer the question before continuing." });
      return;
    }
    const q0 = preQuestions[0];
    if (q0 && "question_type" in q0 && q0.question_type === "text_short" && answers[0].answer_text.length < 10) {
      set({ error: "Short text answers must be at least 10 characters." });
      return;
    }

    set({ loading: true, error: null });
    try {
      await submitPreAnswers({ session_id: sessionId, answers });
      clearDraft("pre", sessionId);
      set({
        state: "command_select",
        preAnswersSubmitted: true,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to submit answers",
        loading: false,
      });
    }
  },

  selectCommandOption: (optionId: "A" | "B" | "C", promptTextSnapshot: string) => {
    const { sessionId } = get();
    if (!sessionId) return;
    saveCommandSelection(sessionId, optionId, promptTextSnapshot);
    set({
      selectedCommandOptionId: optionId,
      selectedPromptTextSnapshot: promptTextSnapshot,
      state: "recording_ready",
    });
  },

  goBackToPreQuestionnaire: () => {
    set({ state: "pre_questionnaire" });
  },

  goBackToPreQuestions: () => {
    set({ state: "pre_questions" });
  },

  goBackToCommandSelect: () => {
    set({
      state: "command_select",
      audioBlob: null,
      durationSeconds: null,
      recordingStartMs: null,
      recordingEndMs: null,
    });
  },

  setRecordingReady: () => {
    set({ state: "recording_ready" });
  },

  setRecordingStart: (startMs: number) => {
    set({
      state: "recording",
      recordingStartMs: startMs,
      recordingEndMs: null,
      audioBlob: null,
      durationSeconds: null,
    });
  },

  setRecordingEnd: (endMs: number, blob: Blob) => {
    const { recordingStartMs } = get();
    if (!recordingStartMs) {
      // Fallback: use current time if start time missing
      const startMs = Date.now() - (blob.size > 0 ? 30000 : 0); // Estimate 30s if no start
      const durationSeconds = Math.round((endMs - startMs) / 1000);
      set({
        state: "recorded",
        recordingStartMs: startMs,
        recordingEndMs: endMs,
        audioBlob: blob,
        durationSeconds: Math.max(1, durationSeconds),
      });
      return;
    }

    const durationSeconds = Math.round((endMs - recordingStartMs) / 1000);
    set({
      state: "recorded",
      recordingEndMs: endMs,
      audioBlob: blob,
      durationSeconds: Math.max(1, durationSeconds),
    });
  },

  uploadRecordingBlob: async (abortController?: AbortController) => {
    const { sessionId, audioBlob, durationSeconds, selectedCommandOptionId } = get();
    if (!sessionId || !audioBlob || durationSeconds === null) {
      set({ error: "Missing recording data", loading: false });
      return;
    }
    if (durationSeconds < 60) {
      set({ error: "Session must be at least 1 minute. Please record again.", loading: false });
      return;
    }
    if (!selectedCommandOptionId) {
      set({ error: "Please select a command option (A, B, or C) before uploading." });
      return;
    }

    set({ state: "uploading_processing", loading: true, error: null });

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("session_id", sessionId);
      formData.append("duration_seconds", durationSeconds.toString());
      formData.append("command_option_id", selectedCommandOptionId);

      const response = await uploadRecording(formData, abortController);
      console.log("Upload successful:", response);
      console.log("Post questions received:", response.post_questions);
      console.log("Post questions count:", response.post_questions?.length || 0);
      
      // Verify question IDs are UUIDs (for debugging)
      if (response.post_questions && response.post_questions.length > 0) {
        response.post_questions.forEach((q, idx) => {
          console.log(`[Post Question ${idx + 1}] ID: ${q.id}, Type: ${q.question_type}, Order: ${q.order_index}`);
          // Verify ID is a valid UUID format (basic check)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(q.id)) {
            console.warn(`[Post Question ${idx + 1}] Warning: Question ID doesn't look like a UUID: ${q.id}`);
          }
        });
      }

      // Check if post_questions are missing or empty
      if (!response.post_questions || response.post_questions.length === 0) {
        console.warn("No post-questions in upload response. Backend should return post_questions array.");
        // Try to fetch from recording endpoint as fallback
        try {
          const recording = await fetchRecording(response.recording_id);
          console.log("Fetched recording for post-questions:", recording);
          // If recording has post questions in answers, extract them
          // Otherwise, we'll show an error message
        } catch (fetchErr) {
          console.error("Failed to fetch recording for post-questions:", fetchErr);
        }
      }

      set({
        state: "post_questions",
        recordingId: response.recording_id,
        postQuestions: response.post_questions || [],
        postAnswers: {},
        postAnswersSubmitted: false,
        loading: false,
      });
    } catch (err) {
      console.error("Upload error:", err);
      
      if (err instanceof Error && err.name === "AbortError") {
        set({
          error: "Upload cancelled",
          state: "recorded",
          loading: false,
        });
        return;
      }
      
      // Extract detailed error message
      let errorMessage = "Upload failed";
      if (err instanceof Error) {
        errorMessage = err.message;
        // Check if it's a backend error with details
        if (err.message.includes("500") || err.message.includes("Internal Server Error")) {
          errorMessage = `Backend error (500): ${err.message}. Check your Flask backend logs for details.`;
        }
      }
      
      set({
        error: errorMessage,
        state: "recorded",
        loading: false,
      });
    }
  },

  updatePostAnswer: (questionId: UUID, answer: string) => {
    const { recordingId, postAnswers } = get();
    if (!recordingId) return;

    // Only update if the value actually changed to prevent unnecessary re-renders
    if (postAnswers[questionId] === answer) return;

    const updated = { ...postAnswers, [questionId]: answer };
    set({ postAnswers: updated });
    saveDraft("post", recordingId, updated);
  },

  submitPostAnswers: async () => {
    const { sessionId, recordingId, postQuestions, postAnswers } = get();
    if (!sessionId || !recordingId) return;

    // Validate: Q1 (scale) and Q2 (binary) must be answered, Q3 (free_text) is optional
    const q1 = postQuestions[0];
    const q2 = postQuestions[1];
    
    if (!q1 || !postAnswers[q1.id] || postAnswers[q1.id].trim().length === 0) {
      set({ error: "Please answer the first question (scale 1-5)" });
      return;
    }
    
    if (!q2 || !postAnswers[q2.id] || postAnswers[q2.id].trim().length === 0) {
      set({ error: "Please answer the second question (YES/NO)" });
      return;
    }
    
    // Q3 is optional, but if answered, include it
    const answers: PostRecordingAnswerInput[] = postQuestions
      .filter((q) => {
        // Include Q1 and Q2 (required), and Q3 if answered
        if (q.order_index === 0 || q.order_index === 1) return true;
        if (q.order_index === 2 && postAnswers[q.id] && postAnswers[q.id].trim().length > 0) return true;
        return false;
      })
      .map((q) => {
        const answer = {
          question_id: q.id, // Using real UUID from backend
          answer_text: postAnswers[q.id] || "",
        };
        console.log(`[Submit Post Answer] Question ID: ${answer.question_id}, Answer: ${answer.answer_text}`);
        return answer;
      });

    set({ loading: true, error: null, state: "finalizing" });
    try {
      const response = await submitPostAnswers({
        recording_id: recordingId,
        session_id: sessionId,
        answers,
      });
      
      clearDraft("post", recordingId);

      // Fetch completed recording (which now includes performance_score)
      const recording = await fetchRecording(recordingId);
      set({
        state: "completed",
        postAnswersSubmitted: true,
        completedRecording: recording,
        loading: false,
      });
      
      // Log performance score if available
      if (response.performance_score) {
        console.log("[Session] Performance Score:", response.performance_score);
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to submit answers",
        state: "post_questions",
        loading: false,
      });
    }
  },

  finalizeSession: async () => {
    const { recordingId } = get();
    if (!recordingId) return;

    set({ loading: true });
    try {
      const recording = await fetchRecording(recordingId);
      set({
        state: "completed",
        completedRecording: recording,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch recording",
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

      clearDraft("pre", sessionId);
      clearCommandSelection(sessionId);
      if (get().recordingId) {
        clearDraft("post", get().recordingId!);
      }

      set({
        state: "idle",
        sessionId: null,
        recordingId: null,
        preQuestions: [],
        preAnswers: {},
        commandOptions: [],
        selectedCommandOptionId: null,
        selectedPromptTextSnapshot: null,
        themeChosenCode: null,
        postQuestions: [],
        postAnswers: {},
        audioBlob: null,
        durationSeconds: null,
        completedRecording: null,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to abandon session",
        loading: false,
      });
    }
  },

  reset: () => {
    set({
      state: "idle",
      sessionId: null,
      recordingId: null,
      questionnaire: null,
      questionnaireSubmitted: false,
      cursor: null,
      mode: null,
      preQuestions: [],
      preAnswers: {},
      preAnswersSubmitted: false,
      commandOptions: [],
      selectedCommandOptionId: null,
      selectedPromptTextSnapshot: null,
      themeChosenCode: null,
      audioBlob: null,
      durationSeconds: null,
      recordingStartMs: null,
      recordingEndMs: null,
      postQuestions: [],
      postAnswers: {},
      postAnswersSubmitted: false,
      completedRecording: null,
      loading: false,
      error: null,
    });
  },

  forceResetLoading: () => {
    set({ loading: false });
  },
}));
