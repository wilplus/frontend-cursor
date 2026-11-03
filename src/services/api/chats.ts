import { bffFetch } from "@/lib/api/bffFetch";

/* The chats between users (backend N298, N302, N306, N311, N321, N351; rules:
   docs/flows/customer-requests.md §1 C1). Ring 6, feature `chats`: the
   backend answers 404 for anyone else, read here as nothing. Every read
   and write answers null on any failure; the caller keeps what it has. */

export type ChatKind = "team" | "customer";
/** A photo or a file comes from the "+" (N351): a file's body is its own
 *  name; a photo's is empty. */
export type ChatMessageKind = "emoji" | "text" | "voice" | "photo" | "file";

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
  /** A voice note's words, once ready (backend N324, N331); null or absent
   *  until then, and for a voice note with none. */
  words?: string | null;
  /** An answer's slides (backend N355): when each one starts, in ms, for
   *  the strip that follows its voice. */
  slides?: number[];
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
  return (await getChatThread(chatId))?.messages ?? null;
}

/** A chat's messages, oldest first, and, for the one who joined it through
 *  someone's link, that person's first name (backend N308, N335 item 2). */
export async function getChatThread(
  chatId: string,
): Promise<{ messages: ChatMessage[]; joinedThrough: string | null } | null> {
  const body = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/messages`, { method: "GET" });
  if (!body || !Array.isArray(body.messages)) return null;
  const through = typeof body.joined_through === "string" && body.joined_through ? body.joined_through : null;
  return { messages: body.messages as ChatMessage[], joinedThrough: through };
}

/** The caller's own join link (backend N308): its path, "/c/<token>". */
export async function getMyChatLink(): Promise<string | null> {
  const body = await call("/api/v2/chats/link", { method: "GET" });
  return typeof body?.path === "string" ? body.path : null;
}

/** Joining through someone's link (backend N308, N328): the chat made, or
 *  found, for the two; "signin" when there is no session; "refused" for
 *  anything else (your own link, a link that no longer works, no ring). */
export type JoinResult = { kind: "joined"; chatId: string } | { kind: "signin" } | { kind: "refused" };

export async function joinChatLink(token: string): Promise<JoinResult> {
  try {
    const result = await bffFetch(`/api/v2/chats/join/${encodeURIComponent(token)}`, {
      method: "POST",
      json: {},
      cache: "no-store",
    });
    if (result.kind === "unauthenticated") return { kind: "signin" };
    if (result.kind !== "response") return { kind: "refused" };
    if (result.status === 401) return { kind: "signin" };
    const chat = result.ok && result.body && typeof result.body === "object" ? (result.body as { chat?: { id?: unknown } }).chat : null;
    return chat && typeof chat.id === "string" ? { kind: "joined", chatId: chat.id } : { kind: "refused" };
  } catch {
    return { kind: "refused" };
  }
}

export async function sendChatEmoji(chatId: string, emoji: ChatEmoji): Promise<ChatMessage | null> {
  const body = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    json: { kind: "emoji", body: emoji },
  });
  const message = body?.message;
  return message && typeof message === "object" ? (message as ChatMessage) : null;
}

/** A voice note sent in the chat (N321 item 2): the recording, up to two
 *  minutes, with its length. The backend keeps it under the caller's
 *  processing authorization; any refusal (not a member, too long, no
 *  authorization) answers null. */
export async function sendChatVoice(chatId: string, audio: Blob, durationMs: number): Promise<ChatMessage | null> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `voice.${ext}`);
  form.append("duration_ms", String(Math.round(durationMs)));
  const body = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/voice`, {
    method: "POST",
    timeoutMs: 60_000,
    body: form,
  });
  const message = body?.message;
  return message && typeof message === "object" ? (message as ChatMessage) : null;
}

/** A photo or a file sent from the "+" (N351), as multipart `file` under
 *  its own name. The backend marks it as a question for the other person
 *  (`meta.question`); any refusal (not a member, not a photo, too big)
 *  answers null. */
export async function sendChatUpload(
  chatId: string,
  kind: "photo" | "file",
  file: Blob,
  name: string,
): Promise<ChatMessage | null> {
  const form = new FormData();
  form.append("file", file, name);
  const body = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/${kind}`, {
    method: "POST",
    timeoutMs: 60_000,
    body: form,
  });
  const message = body?.message;
  return message && typeof message === "object" ? (message as ChatMessage) : null;
}

/** Where a photo or a file in the chat opens from (N351). */
export function chatFileSrc(chatId: string, messageId: string): string {
  return `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/file`;
}

/** Where a voice message in the chat plays from. */
export function chatVoiceSrc(chatId: string, messageId: string): string {
  return `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/audio`;
}
