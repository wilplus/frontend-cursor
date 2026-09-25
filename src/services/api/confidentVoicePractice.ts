import { getAuthToken } from "@/lib/api/auth-client";
import type { ConfidentVoicePracticeOffer } from "@/services/api/idealText";

/** The five answers, the same as the first judgement (founder 2026-09-25). */
export type PracticeAnswer =
  | "yes"
  | "in_between"
  | "no"
  | "not_sure"
  | "audio_unclear";

const PRACTICE_ANSWERS: readonly PracticeAnswer[] = [
  "yes", "in_between", "no", "not_sure", "audio_unclear",
];

function practiceAnswer(value: unknown): PracticeAnswer | null {
  return PRACTICE_ANSWERS.includes(value as PracticeAnswer)
    ? (value as PracticeAnswer)
    : null;
}

export interface ConfidencePracticeAttempt {
  id: string;
  attemptIndex: number;
  audioRef: string;
  durationMs: number;
  assessment: string;
  isStrongest: boolean;
  kept: boolean;
  userAnswer: PracticeAnswer | null;
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
  finalUserAnswer: PracticeAnswer | null;
  selectedAttemptId: string | null;
  /** The latest attempt while it is still unjudged (Q17 A): the judgement
   *  screen asks about exactly this one. */
  judgeableAttemptId: string | null;
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
    userAnswer: practiceAnswer(r.user_answer),
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
    finalUserAnswer: practiceAnswer(r.final_user_answer),
    selectedAttemptId: typeof r.selected_attempt_id === "string"
      ? r.selected_attempt_id : null,
    judgeableAttemptId: typeof r.judgeable_attempt_id === "string"
      ? r.judgeable_attempt_id : null,
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

/** What judging one attempt did (contract 29a, founder 2026-09-25).
 *
 *  `again`  — No or Audio unclear with attempts left: record another.
 *  `adopt`  — Yes, In-between or Not sure: the practice is done and its words
 *             replaced the practised passage when the server could find it
 *             (`adopted`); `paragraph` is then the paragraph's new words.
 *             `attemptWords` are what was said, for the helper-words step.
 *  `closed` — a No or Audio unclear on the last attempt. */
export type JudgeResult =
  | {
      ok: true;
      practice: ConfidencePractice;
      outcome: "again" | "adopt" | "closed";
      adopted: boolean;
      paragraph: string | null;
      attemptWords: string | null;
    }
  | { ok: false; error: string | null };

export async function judgeConfidencePracticeAttempt(
  practiceId: string,
  attemptId: string,
  answer: PracticeAnswer,
): Promise<JudgeResult> {
  const headers = await tokenHeaders(true);
  if (!headers) return { ok: false, error: null };
  try {
    const res = await fetch(
      `/api/v2/user/confidence-practice/${encodeURIComponent(practiceId)}` +
        `/attempts/${encodeURIComponent(attemptId)}/answer`,
      {
        method: "PUT", headers, cache: "no-store",
        body: JSON.stringify({ user_answer: answer }),
      },
    );
    const data = await res.json().catch(() => null) as Record<string, unknown> | null;
    const practice = mapConfidencePractice(data?.practice);
    const outcome = data?.outcome;
    if (!res.ok || !practice ||
        (outcome !== "again" && outcome !== "adopt" && outcome !== "closed")) {
      return {
        ok: false,
        error: typeof data?.error === "string" ? data.error : null,
      };
    }
    return {
      ok: true,
      practice,
      outcome,
      adopted: data?.adopted === true,
      paragraph: typeof data?.paragraph === "string" ? data.paragraph : null,
      attemptWords: typeof data?.attempt_transcript === "string"
        ? data.attempt_transcript : null,
    };
  } catch {
    return { ok: false, error: null };
  }
}

/** Helper words tapped from the practice's words, for when they could not
 *  be adopted into the paragraph (Q10 B). Stored on the Slide; the Lock step
 *  locks them like any other pick. */
export async function savePracticeHelperWords(
  practiceId: string,
  partId: string,
  phrase: string,
): Promise<boolean> {
  const headers = await tokenHeaders(true);
  if (!headers) return false;
  try {
    const res = await fetch(
      `/api/v2/user/confidence-practice/${encodeURIComponent(practiceId)}/helper-words`,
      {
        method: "PUT", headers, cache: "no-store",
        body: JSON.stringify({ part_id: partId, phrase }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
