import type { LoungeMessage } from "@/services/api/loungeMessages";
import { afterTakeOrder } from "@/components/willab/afterTake";

export function projectIdOf(message: Pick<LoungeMessage, "metadata">): string | null {
  const id = message.metadata?.arc_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function isProjectMessage(message: Pick<LoungeMessage, "metadata">): boolean {
  return projectIdOf(message) !== null;
}

export function messagesForProject(messages: readonly LoungeMessage[], arcId: string): LoungeMessage[] {
  return messages.filter((message) => projectIdOf(message) === arcId);
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
    const answered = messages.slice(index + 1).some((later) => {
      const laterMeta = later.metadata ?? {};
      return later.role === "user" && laterMeta.take_session_id === take &&
        (laterMeta.will_question_step === "answer" || laterMeta.will_question_step === "skip");
    });
    return answered ? null : message;
  }
  return null;
}
