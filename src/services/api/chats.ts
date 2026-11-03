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

/** The message a send answers, or null. */
function messageOf(body: Record<string, unknown> | null): ChatMessage | null {
  const message = body?.message;
  return message && typeof message === "object" ? (message as ChatMessage) : null;
}

function chatsOf(body: Record<string, unknown> | null): Chat[] | null {
  return body && Array.isArray(body.chats) ? (body.chats as Chat[]) : null;
}

export async function getChats(): Promise<Chat[] | null> {
  return chatsOf(await call("/api/v2/chats", { method: "GET" }));
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
  return messageOf(body);
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
  return messageOf(body);
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
  return messageOf(body);
}

/** Where a photo or a file in the chat opens from (N351). */
export function chatFileSrc(chatId: string, messageId: string): string {
  return `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/file`;
}

/** An answer recorded with "Record an answer" (backend N363), sent as soon
 *  as its Take is uploaded: a voice message that plays the speaker's own
 *  Take, up to five minutes. `holdMs`, what is left of its 5 seconds, holds
 *  it on the server, where Undo can still take it back (N441 item 3). Any
 *  refusal answers null. */
export async function sendChatAnswer(chatId: string, take: string, durationMs: number, holdMs = 0): Promise<ChatMessage | null> {
  const body = await call(`/api/v2/chats/${encodeURIComponent(chatId)}/answer`, {
    method: "POST",
    json: { take, duration_ms: Math.round(durationMs), hold_ms: Math.max(0, Math.round(holdMs)) },
  });
  return messageOf(body);
}

/** Undo (backend N345 item 2, N441): the answer held on the server
 *  (`message`) is taken back, and Will says so in the speaker's chat with
 *  him; `project`, the answer's own, names it before its message exists.
 *  "sent" when it had already gone (409); "failed" for anything else. */
export async function undoChatAnswer(
  chatId: string,
  answer: { message: string | null; project: string },
): Promise<"undone" | "sent" | "failed"> {
  try {
    const result = await bffFetch(`/api/v2/chats/${encodeURIComponent(chatId)}/answer/undo`, {
      method: "POST",
      json: answer,
      cache: "no-store",
    });
    if (result.kind !== "response") return "failed";
    if (result.status === 409) return "sent";
    return result.ok ? "undone" : "failed";
  } catch {
    return "failed";
  }
}

/** Where a voice message in the chat plays from. */
export function chatVoiceSrc(chatId: string, messageId: string): string {
  return `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/audio`;
}

/** A person's profile (backend N366): your own, or the other person's in a
 *  chat, with the photos and files shared. `chat_id` names the chat a photo
 *  or a file is in. */
export type SharedItem = { id: string; chat_id: string; name: string; created_at: string };
export type Profile = {
  name: string;
  role: string | null;
  about: string | null;
  about_edited_at: string | null;
  has_photo: boolean;
  photos: SharedItem[];
  files: SharedItem[];
};

function profileOf(body: Record<string, unknown> | null): Profile | null {
  if (!body || typeof body.name !== "string") return null;
  const items = (x: unknown) => (Array.isArray(x) ? (x as SharedItem[]) : []);
  return {
    name: body.name,
    role: typeof body.role === "string" ? body.role : null,
    about: typeof body.about === "string" ? body.about : null,
    about_edited_at: typeof body.about_edited_at === "string" ? body.about_edited_at : null,
    has_photo: body.has_photo === true,
    photos: items(body.photos),
    files: items(body.files),
  };
}

export async function getMyProfile(): Promise<Profile | null> {
  return profileOf(await call("/api/v2/profile", { method: "GET" }));
}

export async function getTheirProfile(chatId: string): Promise<Profile | null> {
  return profileOf(await call(`/api/v2/chats/${encodeURIComponent(chatId)}/profile`, { method: "GET" }));
}

/** Change your name, who you are or your About; null when refused. */
export async function saveMyProfile(change: { name?: string; role?: string; about?: string }): Promise<Profile | null> {
  return profileOf(await call("/api/v2/profile", { method: "PATCH", json: change }));
}

export async function setMyPhoto(photo: Blob, name: string): Promise<boolean> {
  const form = new FormData();
  form.append("file", photo, name);
  const body = await call("/api/v2/profile/photo", { method: "PUT", timeoutMs: 60_000, body: form });
  return body?.has_photo === true;
}

export async function dropMyPhoto(): Promise<boolean> {
  const body = await call("/api/v2/profile/photo", { method: "DELETE" });
  return body?.has_photo === false;
}

/** Where a profile photo is shown from; `v` changes it once it is replaced. */
export function profilePhotoSrc(chatId: string | null, v = 0): string {
  const base = chatId ? `/api/v2/chats/${encodeURIComponent(chatId)}/profile/photo` : "/api/v2/profile/photo";
  return v ? `${base}?v=${v}` : base;
}
