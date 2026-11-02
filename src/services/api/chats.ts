import { bffFetch } from "@/lib/api/bffFetch";

/* The chats between users (backend N298, N302, N306, N311; rules:
   docs/flows/customer-requests.md §1 C1). Ring 6, feature `chats`: the
   backend answers 404 for anyone else, read here as nothing. Every read
   and write answers null on any failure; the caller keeps what it has. */

export type ChatKind = "team" | "customer";
export type ChatMessageKind = "emoji" | "text" | "voice";

export type ChatLast = { kind: ChatMessageKind; body: string; created_at: string };
export type Chat = { id: string; kind: ChatKind; title: string; subtitle: string; last: ChatLast | null };
export type ChatMessage = {
  id: string;
  mine: boolean;
  author: string;
  kind: ChatMessageKind;
  body: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

/** The three emoji, each with one meaning everywhere (N311 item 1). */
export const CHAT_EMOJI = ["👍", "👀", "🙏"] as const;
export type ChatEmoji = (typeof CHAT_EMOJI)[number];

async function call(path: string, init: Parameters<typeof bffFetch>[1]): Promise<Record<string, unknown> | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    const body = result.kind === "response" && result.ok ? result.body : null;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function chatsOf(body: Record<string, unknown> | null): Chat[] | null {
  return body && Array.isArray(body.chats) ? (body.chats as Chat[]) : null;
}

export async function getChats(): Promise<Chat[] | null> {
  return chatsOf(await call("/api/v2/chats", { method: "GET" }));
}

/** Seeds the two demo chats for the caller; answers the list. */
export async function seedDemoChats(): Promise<Chat[] | null> {
  return chatsOf(await call("/api/v2/chats/demo", { method: "POST", json: {} }));
}

export async function getChatMessages(chatId: string): Promise<ChatMessage[] | null> {
  const body = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/messages`, { method: "GET" });
  return body && Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : null;
}

export async function sendChatEmoji(chatId: string, emoji: ChatEmoji): Promise<ChatMessage | null> {
  const body = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    json: { kind: "emoji", body: emoji },
  });
  const message = body?.message;
  return message && typeof message === "object" ? (message as ChatMessage) : null;
}
