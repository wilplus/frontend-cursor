import type { CopilotStudentDraft, DraftGenerationStatus } from "@/lib/api/admin-client";

export const DRAFT_GENERATION_MAX_RETRIES = 3;

const DRAFT_GENERATION_BACKOFF_MS = [2000, 4000, 6000] as const;

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasUsableDraftContent(draft: CopilotStudentDraft | null | undefined): boolean {
  if (!draft) return false;
  return (
    hasText(draft.task_draft) ||
    hasText(draft.email_draft) ||
    hasText(draft.script_draft) ||
    hasText(draft.ai_task_suggestion) ||
    hasText(draft.ai_email_draft) ||
    hasText(draft.ai_script_draft)
  );
}

export function hasAnyUsableDraftContent(drafts: CopilotStudentDraft[] | null | undefined): boolean {
  return Array.isArray(drafts) && drafts.some((draft) => hasUsableDraftContent(draft));
}

export function nextDraftGenerationDelayMs(retryCount: number): number {
  const safeRetry = Number.isFinite(retryCount) ? Math.max(0, Math.floor(retryCount)) : 0;
  return DRAFT_GENERATION_BACKOFF_MS[Math.min(safeRetry, DRAFT_GENERATION_BACKOFF_MS.length - 1)];
}

export function shouldPollDraftGeneration(params: {
  status: DraftGenerationStatus | null | undefined;
  hasUsableDraftContent: boolean;
  retryCount: number;
  isEditing: boolean;
  maxRetries?: number;
}): boolean {
  const maxRetries = params.maxRetries ?? DRAFT_GENERATION_MAX_RETRIES;
  if (params.isEditing) return false;
  if (params.hasUsableDraftContent) return false;
  if (params.status !== "pending") return false;
  return params.retryCount < maxRetries;
}

export function getEffectiveDraftGenerationStatus(params: {
  status: DraftGenerationStatus | null | undefined;
  hasUsableDraftContent: boolean;
}): DraftGenerationStatus {
  if (params.hasUsableDraftContent) return "ready";
  return params.status ?? "not_started";
}

export type DraftGenerationBannerState = "idle" | "pending" | "failed" | "retry_exhausted";

export function getDraftGenerationBannerState(params: {
  status: DraftGenerationStatus | null | undefined;
  hasUsableDraftContent: boolean;
  retriesExhausted: boolean;
}): DraftGenerationBannerState {
  if (params.hasUsableDraftContent) return "idle";
  const effectiveStatus = getEffectiveDraftGenerationStatus({
    status: params.status,
    hasUsableDraftContent: params.hasUsableDraftContent,
  });
  if (effectiveStatus === "failed") return "failed";
  if (effectiveStatus === "pending") {
    return params.retriesExhausted ? "retry_exhausted" : "pending";
  }
  return "idle";
}

export function shouldHydrateDraftEditor(params: {
  isBackgroundRefresh: boolean;
  hasUnsavedEdits: boolean;
}): boolean {
  if (!params.isBackgroundRefresh) return true;
  return !params.hasUnsavedEdits;
}
