import { bffFetch } from "@/lib/api/bffFetch";

/* -------------------------------------------------------------------------- */
/*  A person's own chats: one kind of chat, decided by use (backend N700).     */
/*                                                                            */
/*  Every chat of one's own is the same kind of chat, in one flat list. A     */
/*  chat with a project (`arcId`) got it from its first Take or slides; a     */
/*  chat with a `section` carries on one of the old three (speaking,           */
/*  principles, will) and holds what was written there before.               */
/* -------------------------------------------------------------------------- */

export type OwnChatSection = "speaking" | "principles" | "will";

export type OwnChat = {
  id: string;
  title: string;
  arcId: string | null;
  section: OwnChatSection | null;
  lastUsedAt: string | null;
};

const SECTIONS: readonly OwnChatSection[] = ["speaking", "principles", "will"];

function ownChatOf(raw: unknown): OwnChat | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) return null;
  const section = SECTIONS.find((value) => value === row.section) ?? null;
  return {
    id: row.id,
    title: typeof row.title === "string" ? row.title : "",
    arcId: typeof row.arc_id === "string" && row.arc_id ? row.arc_id : null,
    section,
    lastUsedAt: typeof row.last_used_at === "string" ? row.last_used_at : null,
  };
}

const ENDPOINT = "/api/v2/user/own-chats";

/** The person's own chats, the newest used first; null when unreadable. */
export async function listOwnChats(): Promise<OwnChat[] | null> {
  const result = await bffFetch(ENDPOINT, { cache: "no-store" });
  if (result.kind !== "response" || !result.ok) return null;
  const chats = (result.body as { chats?: unknown } | null)?.chats;
  return Array.isArray(chats) ? chats.map(ownChatOf).filter((chat): chat is OwnChat => chat !== null) : null;
}

export async function createOwnChat(title?: string): Promise<OwnChat | null> {
  const result = await bffFetch(ENDPOINT, { method: "POST", json: title ? { title } : {} });
  if (result.kind !== "response" || !result.ok) return null;
  return ownChatOf((result.body as { chat?: unknown } | null)?.chat);
}

export async function renameOwnChat(chatId: string, title: string): Promise<OwnChat | null> {
  const result = await bffFetch(`${ENDPOINT}/${encodeURIComponent(chatId)}`, { method: "PATCH", json: { title } });
  if (result.kind !== "response" || !result.ok) return null;
  return ownChatOf((result.body as { chat?: unknown } | null)?.chat);
}

/** The chat's first Take or slides give it its project; a chat that has one keeps it. */
export async function giveOwnChatProject(chatId: string, arcId: string): Promise<OwnChat | null> {
  const result = await bffFetch(`${ENDPOINT}/${encodeURIComponent(chatId)}/project`, {
    method: "POST", json: { arc_id: arcId },
  });
  if (result.kind !== "response" || !result.ok) return null;
  return ownChatOf((result.body as { chat?: unknown } | null)?.chat);
}
