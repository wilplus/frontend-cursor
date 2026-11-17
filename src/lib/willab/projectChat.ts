import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ChatHistoryEntry } from "@/services/api/chatQuery";
import { afterTakeOrder } from "@/components/willab/afterTake";

export const TYPED_PROJECT_TURN = "typed_project_turn";

export function projectIdOf(message: Pick<LoungeMessage, "metadata">): string | null {
  const id = message.metadata?.arc_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function isProjectMessage(message: Pick<LoungeMessage, "metadata">): boolean {
  return projectIdOf(message) !== null;
}

/** A project question and every turn answering it still belong to the
 *  speaking conversation where the speaker met them. Their arc metadata is
 *  retained as well, so opening the project shows the same exchange. */
export function projectMessageStaysInLounge(message: Pick<LoungeMessage, "metadata">): boolean {
  const metadata = message.metadata ?? {};
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
  takeSessionId: string;
  questionClientId: string;
  role: "answer" | "reply";
  place?: string | null;
}): Record<string, unknown> {
  return {
    arc_id: arcId,
    take_session_id: takeSessionId,
    will_question_step: role,
    reply_to: questionClientId,
    [TYPED_PROJECT_TURN]: true,
    ...(place ? { place } : {}),
  };
}

export function messagesForProject(messages: readonly LoungeMessage[], arcId: string): LoungeMessage[] {
  return messages.filter((message) => projectIdOf(message) === arcId);
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
