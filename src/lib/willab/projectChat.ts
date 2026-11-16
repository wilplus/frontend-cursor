import type { LoungeMessage } from "@/services/api/loungeMessages";

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
