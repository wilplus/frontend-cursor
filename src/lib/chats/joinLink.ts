/* Pure: read on the server by the join page and in its tests. */

/** The join page's read (GET /v2/chats/join/<token>): whose link it is,
 *  and, when its owner has the chat builder (backend N579 item 2), whose
 *  assistant answers in their chat ("{name}'s assistant", N578 item 1) and
 *  Will's line for the joiner's own chat (N586 item 2), both in the
 *  backend's words; null each otherwise. Null for a body with no name. */
export type JoinLinkInfo = { name: string; assistant: string | null; willLine: string | null };

export function joinLinkInfo(raw: unknown): JoinLinkInfo | null {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const line = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
  const name = line(body.name);
  return name ? { name, assistant: line(body.assistant), willLine: line(body.will_line) } : null;
}
