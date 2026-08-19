import { getAuthToken } from "@/lib/api/auth-client";
import type { ConfidentVoicePracticeOffer } from "@/services/api/idealText";

export interface ConfidencePracticeAttempt {
  id: string;
  attemptIndex: number;
  audioRef: string;
  durationMs: number;
  assessment: string;
  isStrongest: boolean;
  kept: boolean;
  userAnswer: "yes" | "no" | null;
}

export interface ConfidencePractice {
  id: string;
  status: "open" | "completed" | "dismissed";
  exercise: {
    exerciseId: string;
    version: number;
    title: string;
    instruction: string;
    explanationVideoRef: string | null;
  };
  passage: string;
  originalAudioRef: string | null;
  originalStartOffsetMs: number;
  originalDurationMs: number;
  attempts: ConfidencePracticeAttempt[];
  attemptsRemaining: number;
  strongestAttempt: ConfidencePracticeAttempt | null;
  finalReady: boolean;
  finalMessage: string | null;
  finalQuestion: string | null;
  finalUserAnswer: "yes" | "no" | null;
  selectedAttemptId: string | null;
}

export type PracticeResult =
  | { ok: true; practice: ConfidencePractice }
  | { ok: false; error: string | null };

function attempt(raw: unknown): ConfidencePracticeAttempt | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.id !== "string" ||
    typeof r.attempt_index !== "number" ||
    typeof r.audio_ref !== "string" ||
    typeof r.duration_ms !== "number" ||
    typeof r.assessment !== "string"
  ) return null;
  return {
    id: r.id,
    attemptIndex: r.attempt_index,
    audioRef: r.audio_ref,
    durationMs: r.duration_ms,
    assessment: r.assessment,
    isStrongest: r.is_strongest === true,
    kept: r.kept === true,
    userAnswer: r.user_answer === "yes" || r.user_answer === "no"
      ? r.user_answer : null,
  };
}

export function mapConfidencePractice(raw: unknown): ConfidencePractice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ex = r.exercise && typeof r.exercise === "object"
    ? r.exercise as Record<string, unknown> : null;
  const status = r.status;
  if (
    typeof r.id !== "string" ||
    (status !== "open" && status !== "completed" && status !== "dismissed") ||
    !ex || typeof ex.exercise_id !== "string" ||
    typeof ex.version !== "number" || typeof ex.title !== "string" ||
    typeof ex.instruction !== "string" || typeof r.passage !== "string"
  ) return null;
  const attempts = Array.isArray(r.attempts)
    ? r.attempts.map(attempt).filter((a): a is ConfidencePracticeAttempt => !!a)
    : [];
  const strongestRaw = r.strongest_attempt;
  return {
    id: r.id,
    status,
    exercise: {
      exerciseId: ex.exercise_id,
      version: ex.version,
      title: ex.title,
      instruction: ex.instruction,
      explanationVideoRef: typeof ex.explanation_video_ref === "string"
        ? ex.explanation_video_ref : null,
    },
    passage: r.passage,
    originalAudioRef: typeof r.original_audio_ref === "string"
      ? r.original_audio_ref : null,
    originalStartOffsetMs: typeof r.original_start_offset_ms === "number"
      ? r.original_start_offset_ms : 0,
    originalDurationMs: typeof r.original_duration_ms === "number"
      ? r.original_duration_ms : 0,
    attempts,
    attemptsRemaining: typeof r.attempts_remaining === "number"
      ? r.attempts_remaining : Math.max(0, 3 - attempts.length),
    strongestAttempt: attempt(strongestRaw),
    finalReady: r.final_ready === true,
    finalMessage: typeof r.final_message === "string" ? r.final_message : null,
    finalQuestion: typeof r.final_question === "string" ? r.final_question : null,
    finalUserAnswer: r.final_user_answer === "yes" || r.final_user_answer === "no"
      ? r.final_user_answer : null,
    selectedAttemptId: typeof r.selected_attempt_id === "string"
      ? r.selected_attempt_id : null,
  };
}

async function result(res: Response): Promise<PracticeResult> {
  const data = await res.json().catch(() => null) as Record<string, unknown> | null;
  const practice = mapConfidencePractice(data?.practice);
  if (res.ok && practice) return { ok: true, practice };
  return {
    ok: false,
    error: typeof data?.error === "string" ? data.error : null,
  };
}

async function tokenHeaders(json = false): Promise<Record<string, string> | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

export async function startConfidencePractice(
  snippetId: string,
  offer: ConfidentVoicePracticeOffer,
  evidence: NonNullable<import("@/services/api/idealText").DocumentSuggestion["evidence"]>,
  originalUserAnswer: "yes" | "no",
): Promise<PracticeResult> {
  const headers = await tokenHeaders(true);
  if (!headers) return { ok: false, error: null };
  try {
    const res = await fetch(
      `/api/v2/user/snippets/${encodeURIComponent(snippetId)}/confidence-practice`,
      {
        method: "POST", headers, cache: "no-store",
        body: JSON.stringify({
          exercise_id: offer.exerciseId,
          original_user_answer: originalUserAnswer,
          evidence: {
            project_id: evidence.projectId,
            take_session_id: evidence.takeSessionId,
            slide_index: evidence.slideIndex,
            paragraph_index: evidence.paragraphIndex,
            span: { start: evidence.start, end: evidence.end },
          },
        }),
      },
    );
    return result(res);
  } catch {
    return { ok: false, error: null };
  }
}

export async function uploadConfidencePracticeAttempt(
  practiceId: string, audio: Blob, durationSec: number,
): Promise<PracticeResult> {
  const headers = await tokenHeaders();
  if (!headers) return { ok: false, error: null };
  const form = new FormData();
  form.append("audio_file", audio, "practice.webm");
  form.append("duration_sec", String(durationSec));
  try {
    const res = await fetch(
      `/api/v2/user/confidence-practice/${encodeURIComponent(practiceId)}/attempts`,
      { method: "POST", headers, body: form, cache: "no-store" },
    );
    return result(res);
  } catch {
    return { ok: false, error: null };
  }
}

export async function finishConfidencePractice(
  practiceId: string,
  body: { action: "dismiss" } | { attempt_id: string; user_answer: "yes" | "no" },
): Promise<PracticeResult> {
  const headers = await tokenHeaders(true);
  if (!headers) return { ok: false, error: null };
  try {
    const res = await fetch(
      `/api/v2/user/confidence-practice/${encodeURIComponent(practiceId)}/complete`,
      { method: "PUT", headers, body: JSON.stringify(body), cache: "no-store" },
    );
    return result(res);
  } catch {
    return { ok: false, error: null };
  }
}

export async function fetchConfidencePractice(
  practiceId: string,
): Promise<PracticeResult> {
  const headers = await tokenHeaders();
  if (!headers) return { ok: false, error: null };
  try {
    const res = await fetch(
      `/api/v2/user/confidence-practice/${encodeURIComponent(practiceId)}`,
      { headers, cache: "no-store" },
    );
    return result(res);
  } catch {
    return { ok: false, error: null };
  }
}
