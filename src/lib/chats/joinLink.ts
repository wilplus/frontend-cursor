/* Pure: read on the server by the join page and in its tests. */

/** The join page's read (GET /v2/chats/join/<token>): whose link it is,
 *  and `about`, what you'll learn in the host's chat, in the host's own
 *  words (N601 item 1, drafted by Will from N586 item 1's lines and
 *  confirmed by the host), none when not sent. Null for a body with no
 *  name. The assistant's name and Will's line went from the page (N601
 *  item 2). */
export type JoinLinkInfo = { name: string; about: string[] };

export function joinLinkInfo(raw: unknown): JoinLinkInfo | null {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const line = (value: unknown) => (typeof value === "string" && value.trim() ? value : null);
  const name = line(body.name);
  const about = Array.isArray(body.about) ? body.about.map(line).filter((v): v is string => v !== null) : [];
  return name ? { name, about } : null;
}
