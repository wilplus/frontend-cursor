/**
 * Error-classification helpers for the homework API flow.
 * Extracted from HomeworkFlowCard.tsx.
 */
import type { HomeworkApiError } from "@/lib/api/homework-client";

export function isNoWarmupError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "NO_WARMUP_CONFIGURED";
}

export function isInvalidSessionStateError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "INVALID_SESSION_STATE";
}

export function isReportNotReadyError(e: unknown): e is HomeworkApiError {
  return e instanceof Error && "code" in e && (e as HomeworkApiError).code === "REPORT_NOT_READY";
}

export function isSelfRatingNotReadyError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const msg = e.message.toLowerCase();
  return (
    msg.includes("self-rating") &&
    (msg.includes("only available") || msg.includes("not ready") || msg.includes("delivered your recording"))
  );
}

/** True if error indicates session is gone (404 / SESSION_NOT_FOUND or message). */
export function isSessionGoneError(e: unknown): boolean {
  const err = e as { code?: string; message?: string; status?: number };
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "SESSION_NOT_FOUND" ||
    err.status === 404 ||
    msg.includes("session not found") ||
    msg.includes("no active session")
  );
}
