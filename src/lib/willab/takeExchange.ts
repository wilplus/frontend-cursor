import { projectIdOf, TYPED_PROJECT_TURN } from "@/lib/willab/projectChat";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ChatMessage } from "@/services/api/chats";
import type { TrainingTake } from "@/services/api/trainings";

export const readyForReview = (take: TrainingTake) => take.reviewAvailable ?? take.feedbackAvailable;

export function takeSessionOf(message: Pick<LoungeMessage, "metadata">): string | null {
  const id = message.metadata?.take_session_id ?? message.metadata?.session_id;
  return typeof id === "string" && id ? id : null;
}

/** The recording and the document have their own rows in the exchange. */
export function isTakeExchangeMessage(message: LoungeMessage): boolean {
  const meta = message.metadata;
  const outside = meta?.take_exchange === false ||
    (meta?.take_exchange !== true && meta?.[TYPED_PROJECT_TURN] === true && meta?.reply_to === "" && !meta.review_focus);
  return !outside && message.role !== "system" && !["recording_summary", "transcript_ready", "ideal_text"].includes(message.kind) &&
    !(message.kind === "walk_step" && message.metadata?.step === "end");
}

export function mergeTakeExchange(
  loaded: readonly LoungeMessage[], live: readonly LoungeMessage[], arc: string, take: string,
): LoungeMessage[] {
  // Use the Take-scoped read's freshly resolved media when both copies exist.
  const rows = new Map([...live, ...loaded].filter((row) =>
    takeSessionOf(row) === take && projectIdOf(row) === arc && isTakeExchangeMessage(row),
  ).map((row) => [row.client_id, row]));
  return [...rows.values()].sort((a, b) => a.client_created_at.localeCompare(b.client_created_at));
}

/** A shared Take groups replies only when storage explicitly links them. */
export function linkedTakeReplies(messages: readonly ChatMessage[]) {
  const takes = new Map(messages.filter((message) => message.kind === "take").map((message) => [message.id, message]));
  const members = new Map<string, ChatMessage[]>();
  const replies = new Set<string>();
  for (const message of messages) {
    const parent = message.meta?.answer_to;
    if (typeof parent !== "string") continue;
    const take = takes.get(parent);
    if (!take || take.id === message.id) continue;
    const group = members.get(parent) ?? [take];
    group.push(message);
    members.set(parent, group);
    replies.add(message.id);
  }
  return { members, replies };
}
