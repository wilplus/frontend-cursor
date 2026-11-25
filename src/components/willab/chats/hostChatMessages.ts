import type { ChatMessage } from "@/services/api/chats";

/** A Take made in this chat is already rendered with its coaching exchange. */
export function memberRowsForTakeChat(messages: readonly ChatMessage[] | null | undefined): ChatMessage[] {
  return (messages ?? []).filter((message) => !message.meta?.made_here);
}

const at = (iso: string | null | undefined) => {
  const t = Date.parse(iso ?? "");
  return Number.isFinite(t) ? t : 0;
};

/** The chat's messages laid among the Lounge's rows by time: `before[i]`
 *  goes right before row i, `after` after the last. Pure. */
export function hostRowsAround(
  host: readonly ChatMessage[],
  rowTimes: readonly (string | null | undefined)[],
): { before: ChatMessage[][]; after: ChatMessage[] } {
  const sorted = [...host].sort((a, b) => at(a.created_at) - at(b.created_at));
  const before: ChatMessage[][] = rowTimes.map(() => []);
  let k = 0;
  rowTimes.forEach((time, i) => {
    const t = at(time);
    while (k < sorted.length && at(sorted[k].created_at) <= t) before[i].push(sorted[k++]);
  });
  return { before, after: sorted.slice(k) };
}
