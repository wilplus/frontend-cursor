import type { TrainingTake } from "@/services/api/trainings";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ChatHistoryEntry, ChatQueryResponse } from "@/services/api/chatQuery";
import { afterTakeOrder } from "@/components/willab/afterTake";

export const TYPED_PROJECT_TURN = "typed_project_turn";

/** Existing signed failure copy. Reliability fixes reuse it rather than
 * inventing another line on the locked chat surface. */
export const CHAT_FAILURE_BODY =
  "I'm having trouble reaching the lab right now. Give it another try in a moment.";

const comparableBody = (body: string) => body.trim().replace(/\s+/g, " ");

export type RecordingOffer = {
  suggested_action?: unknown;
  suggested_actions?: unknown;
};

export function offersNextTake(offer?: RecordingOffer | null): boolean {
  return offer?.suggested_action === "record_again" ||
    (Array.isArray(offer?.suggested_actions) && offer.suggested_actions.includes("record_again"));
}

/** A terminal after-Take line is product state, not a contextual reply. */
export function isReplayedTerminalReply(
  body: string,
  messages: readonly Pick<LoungeMessage, "client_id" | "body" | "metadata">[],
  response: ChatQueryResponse,
): boolean {
  const reply = comparableBody(body);
  const offered = response.persisted === true && response.persisted_client_id &&
    (offersNextTake(response) || offersNextTake(response.row_metadata));
  return reply.length > 0 && messages.some(
    (message) => message.metadata?.next_take === true && comparableBody(message.body) === reply &&
      (!offered || message.client_id === response.persisted_client_id),
  );
}

/** A later history read must not resurrect a stale answer suppressed live. */
export function isPersistedTerminalReplay(
  message: Pick<LoungeMessage, "client_id" | "role" | "body" | "metadata">,
  messages: readonly Pick<LoungeMessage, "client_id" | "role" | "body" | "metadata">[],
): boolean {
  const meta = message.metadata;
  if (message.role !== "bot" || meta?.next_take === true ||
      (offersNextTake(meta) && typeof meta?.reply_to_client_id === "string")) return false;
  return messages.some(
    (candidate) => candidate.client_id !== message.client_id &&
      candidate.role === "bot" &&
      candidate.metadata?.next_take === true &&
      comparableBody(candidate.body) === comparableBody(message.body),
  );
}

export function projectIdOf(message: Pick<LoungeMessage, "metadata">): string | null {
  const metadata = message.metadata ?? {};
  for (const id of [metadata.arc_id, metadata.project_id, metadata.projectId]) {
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

/** Strengths and weekly principles are speaker-wide, including older rows tagged with an arc. */
export function isSpeakingCoachFeature(message: Pick<LoungeMessage, "metadata">): boolean {
  const meta = message.metadata ?? {};
  return meta.offer === "strengths" || meta.offer === "sunday_note" ||
    [meta.strength_id, meta.strength_talk, meta.sunday_note_id, meta.sunday_step, meta.sunday_empty].some(Boolean);
}

export function isProjectMessage(message: Pick<LoungeMessage, "metadata">): boolean {
  return !isSpeakingCoachFeature(message) &&
    (message.metadata?.project_chat === true || projectIdOf(message) !== null);
}

/** Shared Coach history is longitudinal across projects, but project chat
 * turns remain owned by their project and never become Coach dialogue. */
export function speakingCoachMessages(
  messages: readonly LoungeMessage[],
): LoungeMessage[] {
  return messages.filter((message) => !isProjectMessage(message));
}

/** Keep the established after-Take prompts in the Lounge. Questions asked
 *  from a project or its review belong to the project conversation. */
export function projectMessageStaysInLounge(message: Pick<LoungeMessage, "metadata">): boolean {
  const metadata = message.metadata ?? {};
  if (metadata.review_focus) return false;
  if (metadata[TYPED_PROJECT_TURN] === true && metadata.reply_to === "") return false;
  const step = metadata.will_question_step;
  return metadata.offer === "will_question" ||
    metadata[TYPED_PROJECT_TURN] === true ||
    step === "ask" || step === "follow" || step === "answer" || step === "reply" ||
    step === "thanks" || step === "skip";
}

export function typedProjectTurnMetadata({
  arcId,
  takeSessionId,
  questionClientId,
  role,
  place,
}: {
  arcId: string;
  takeSessionId?: string;
  questionClientId: string;
  role: "answer" | "reply";
  place?: string | null;
}): Record<string, unknown> {
  return {
    arc_id: arcId,
    ...(takeSessionId ? { take_session_id: takeSessionId } : {}),
    will_question_step: role,
    reply_to: questionClientId,
    [TYPED_PROJECT_TURN]: true,
    ...(place ? { place } : {}),
  };
}

/** A failed contextual turn belongs beside its question but must not carry a
 * reply/thanks step that would falsely close that question. */
export function typedProjectErrorMetadata({
  arcId,
  takeSessionId,
  questionClientId,
  place,
}: {
  arcId: string;
  takeSessionId: string;
  questionClientId?: string | null;
  place?: string | null;
}): Record<string, unknown> {
  return {
    arc_id: arcId,
    take_session_id: takeSessionId,
    [TYPED_PROJECT_TURN]: true,
    ...(questionClientId ? { reply_to: questionClientId } : {}),
    ...(place ? { place } : {}),
  };
}

export function messagesForProject(messages: readonly LoungeMessage[], arcId: string): LoungeMessage[] {
  return messages.filter((message) => projectIdOf(message) === arcId && !isSpeakingCoachFeature(message));
}

/** The model reads the project conversation in the same order as the person.
 *  Cards and system rows are product state, not words in the exchange. */
export function projectConversationHistory(
  messages: readonly LoungeMessage[],
  arcId: string,
): ChatHistoryEntry[] {
  return orderedProjectMessages(messages, arcId)
    .filter((message) => (message.role === "user" || message.role === "bot") && message.body.trim().length > 0)
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.body,
      metadata: { arc_id: arcId },
    }));
}

/** The project's conversation in the order the speaker can understand it.
 *
 * The backend writes the closing row early and holds it while the contextual
 * question is open. Once released, that row keeps its original timestamp, so
 * a plain timestamp render would put "Good job" before the question it closes.
 * Keep the shared after-Take rules, then place each released closing after the
 * final row from the same Take. */
export function orderedProjectMessages(messages: readonly LoungeMessage[], arcId: string): LoungeMessage[] {
  const ordered = afterTakeOrder(
    messagesForProject(messages, arcId).map((message) => ({ message })),
  ).map(({ message }) => message);
  const closings = ordered.filter((message) => message.metadata?.next_take === true);
  const conversation = ordered.filter((message) => message.metadata?.next_take !== true);

  for (const closing of closings) {
    const take = closing.metadata?.take_session_id;
    if (typeof take !== "string" || take.length === 0) {
      conversation.push(closing);
      continue;
    }
    const lastForTake = conversation.findLastIndex(
      (message) => message.metadata?.take_session_id === take,
    );
    conversation.splice(lastForTake < 0 ? conversation.length : lastForTake + 1, 0, closing);
  }
  return conversation;
}

/** Recordings and their recaps occupy one place in the chat, next to the
 * ordinary turns that happened before and after them. */
export function projectTimeline(
  takes: readonly TrainingTake[],
  ordinary: readonly LoungeMessage[],
  messages: readonly LoungeMessage[],
) {
  const recordedAt = new Map<string, string>();
  for (const row of messages) {
    const take = row.metadata?.take_session_id ?? row.metadata?.session_id;
    if (row.kind === "recording_summary" && typeof take === "string" && !recordedAt.has(take)) {
      recordedAt.set(take, row.client_created_at);
    }
  }
  const starts = takes.map((take) => {
    const at = Date.parse(take.createdAt ?? "");
    return Number.isFinite(at) ? at : Date.parse(recordedAt.get(take.sessionId) ?? "");
  });
  const timeline: ({ kind: "take"; take: TrainingTake } | { kind: "message"; message: LoungeMessage })[] = [];
  let next = 0;
  for (const message of ordinary) {
    const at = Date.parse(message.client_created_at);
    while (next < takes.length && (!Number.isFinite(starts[next]) || starts[next] <= at)) {
      timeline.push({ kind: "take", take: takes[next++] });
    }
    timeline.push({ kind: "message", message });
  }
  for (const take of takes.slice(next)) timeline.push({ kind: "take", take });
  return timeline;
}

export function openProjectQuestion(messages: readonly LoungeMessage[]): LoungeMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    const metadata = message.metadata ?? {};
    const step = metadata.will_question_step;
    if (message.role !== "bot" || metadata.offer !== "will_question" || (step !== "ask" && step !== "follow")) {
      continue;
    }
    const take = metadata.take_session_id;
    const laterForTake = messages.slice(index + 1).filter(
      (later) => later.metadata?.take_session_id === take,
    );
    const skipped = laterForTake.some((later) => {
      const laterMeta = later.metadata ?? {};
      return later.role === "user" && laterMeta.will_question_step === "skip";
    });
    const answered = laterForTake.some(
      (later) => later.role === "user" && later.metadata?.will_question_step === "answer",
    );
    const settled = laterForTake.some((later) => {
      const laterStep = later.metadata?.will_question_step;
      return later.role === "bot" && (laterStep === "reply" || laterStep === "thanks");
    });
    // The idempotent optimistic user row can arrive before /chat/query has
    // durably stored its reply. Keep the question/composer open until the
    // authoritative bot semantics settle it; a failed turn then remains
    // recoverable even after the thread is read again.
    return skipped || (answered && settled) ? null : message;
  }
  return null;
}
