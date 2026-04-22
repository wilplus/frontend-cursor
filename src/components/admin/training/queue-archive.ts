import type { CopilotStudentQueueItem } from "@/lib/api/admin-client";

export type QueueArchiveResponse = {
  user_id: string;
  session_id: string;
  archived: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickSessionId(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) return null;
  return asTrimmedString(record.session_id) ?? asTrimmedString(record.sessionId);
}

/**
 * Resolve session id for queue archive/unarchive operations.
 * Backend persists archive by (user_id, session_id), so we must send a real session id.
 */
export function resolveQueueArchiveSessionId(args: {
  student: CopilotStudentQueueItem;
  preferredSessionId?: string | null;
  resolvedDraftSessionByStudentId?: ReadonlyMap<string, string>;
}): string | null {
  const { student, preferredSessionId = null, resolvedDraftSessionByStudentId } = args;
  if (preferredSessionId && preferredSessionId.trim()) return preferredSessionId.trim();

  const fromRow = asTrimmedString(student.session_id);
  if (fromRow) return fromRow;

  const rowRecord = asRecord(student as unknown);
  const fromDraftGeneration = rowRecord
    ? asTrimmedString(rowRecord.draft_generation_session_id) ??
      asTrimmedString(rowRecord.draftGenerationSessionId) ??
      asTrimmedString(rowRecord.homework_session_id) ??
      asTrimmedString(rowRecord.homeworkSessionId)
    : null;
  if (fromDraftGeneration) return fromDraftGeneration;

  const learningProfile =
    (rowRecord ? asRecord(rowRecord.learning_profile) : null) ??
    asRecord(student.profile?.learning_profile);
  const learningMetadata = learningProfile
    ? asRecord(learningProfile.metadata) ?? asRecord(learningProfile.meta)
    : null;
  const fromLearningMetadata =
    pickSessionId(learningMetadata) ??
    pickSessionId(learningProfile) ??
    (rowRecord ? pickSessionId(rowRecord.metadata) : null);
  if (fromLearningMetadata) return fromLearningMetadata;

  const fromResolvedMap = resolvedDraftSessionByStudentId?.get(student.student_id) ?? null;
  if (fromResolvedMap && fromResolvedMap.trim()) return fromResolvedMap.trim();

  return null;
}

export function removeArchivedQueueRowByBackendResult(
  rows: CopilotStudentQueueItem[],
  archiveResult: QueueArchiveResponse
): CopilotStudentQueueItem[] {
  const targetUserId = archiveResult.user_id.trim();
  const targetSessionId = archiveResult.session_id.trim();
  if (!targetUserId || !targetSessionId) return rows;
  return rows.filter((row) => {
    if (row.student_id !== targetUserId) return true;
    const rowSessionId = resolveQueueArchiveSessionId({ student: row }) ?? "";
    return rowSessionId !== targetSessionId;
  });
}
