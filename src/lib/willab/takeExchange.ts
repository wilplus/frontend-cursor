import { projectIdOf, TYPED_PROJECT_TURN } from "@/lib/willab/projectChat";
import type { LoungeMessage } from "@/services/api/loungeMessages";
import type { ChatMessage } from "@/services/api/chats";
import type { TrainingTake } from "@/services/api/trainings";

export const readyForReview = (take: TrainingTake) => take.reviewAvailable ?? take.feedbackAvailable;

export function offersIdealText(message: Pick<LoungeMessage, "metadata">): boolean {
  const destination = message.metadata?.review_destination as { step?: unknown } | undefined;
  return destination?.step === "ideal";
}

export function takeSessionOf(message: Pick<LoungeMessage, "metadata">): string | null {
  const id = message.metadata?.take_session_id ?? message.metadata?.session_id;
  return typeof id === "string" && id ? id : null;
}

function plainProjectTurn(message: LoungeMessage): boolean {
  const meta = message.metadata;
  if (typeof meta?.take_exchange === "boolean") return !meta.take_exchange;
  if (meta?.review_focus || message.kind !== "text") return false;
  if (meta?.[TYPED_PROJECT_TURN] === true) return meta.reply_to === "";
  return meta?.project_chat === true && !meta.offer && !meta.will_question_step;
}

/** Older persisted replies only have a link to the user's turn. Use that
 * turn's placement so a reload keeps the reply with the visible question. */
export function withProjectChatPlacement(messages: readonly LoungeMessage[]): LoungeMessage[] {
  const plainTurns = new Set(messages.filter((row) => row.role === "user" && plainProjectTurn(row))
    .map((row) => row.client_id));
  if (!plainTurns.size) return [...messages];
  return messages.map((row) => {
    const meta = row.metadata;
    if (typeof meta?.take_exchange === "boolean" || meta?.review_focus) return row;
    const parent = row.role === "user" ? row.client_id : meta?.reply_to_client_id;
    if (typeof parent !== "string" || !plainTurns.has(parent)) return row;
    return { ...row, metadata: { ...meta, take_exchange: false } };
  });
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
  const scoped = [...live, ...loaded].filter((row) => takeSessionOf(row) === take && projectIdOf(row) === arc);
  const rows = new Map(withProjectChatPlacement(scoped).filter(isTakeExchangeMessage)
    .map((row) => [row.client_id, row]));
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
