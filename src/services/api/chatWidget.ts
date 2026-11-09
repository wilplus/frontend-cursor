import type { ChatMessage } from "@/services/api/chats";

/* -------------------------------------------------------------------------- */
/*  Your chat on any website (backend N566): the widget's calls, made from     */
/*  `/w/<token>` inside the iframe w.js opens. The visitor has no account:     */
/*  no sign-in is sent; their secret, kept in this browser for this site,     */
/*  travels in one header. Every call answers null when it does not go.       */
/* -------------------------------------------------------------------------- */

export const WIDGET_GUEST_HEADER = "X-Willab-Widget-Guest";

export interface WidgetChat {
  name: string;
  asks: string[];
  messages: ChatMessage[];
  kept: boolean;
}

const base = (token: string) => `/api/v2/chats/widget/${encodeURIComponent(token)}`;

async function call(url: string, guest: string | null, init: { method?: string; json?: unknown } = {}): Promise<unknown> {
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      cache: "no-store",
      headers: {
        ...(guest ? { [WIDGET_GUEST_HEADER]: guest } : {}),
        ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(init.json !== undefined ? { body: JSON.stringify(init.json) } : {}),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function chatOf(body: unknown): WidgetChat | null {
  const b = body as Partial<WidgetChat> | null;
  if (!b || typeof b.name !== "string" || !Array.isArray(b.messages)) return null;
  return { name: b.name, asks: Array.isArray(b.asks) ? b.asks : [], messages: b.messages, kept: b.kept === true };
}

/** "Agree and start": the visitor's chat and their secret. */
export async function startWidgetChat(token: string, site: string | null): Promise<{ guest: string; chat: WidgetChat } | null> {
  const body = (await call(`${base(token)}/start`, null, { method: "POST", json: { site } })) as { guest?: unknown } | null;
  const chat = chatOf(body);
  return chat && typeof body?.guest === "string" ? { guest: body.guest, chat } : null;
}

export async function readWidgetChat(token: string, guest: string): Promise<WidgetChat | null> {
  return chatOf(await call(`${base(token)}/messages`, guest));
}

/** A tap on one of the owner's join questions: what follows it. */
export async function answerWidgetSetup(token: string, guest: string, messageId: string, picked: string[], date?: string) {
  const body = (await call(`${base(token)}/setup/${encodeURIComponent(messageId)}`, guest, {
    method: "POST",
    json: { picked, ...(date ? { date } : {}) },
  })) as { messages?: ChatMessage[] } | null;
  return Array.isArray(body?.messages) ? body.messages : null;
}

export async function askWidget(token: string, guest: string, i: number): Promise<ChatMessage | null> {
  const body = (await call(`${base(token)}/ask`, guest, { method: "POST", json: { i } })) as { message?: ChatMessage } | null;
  return body?.message ?? null;
}

export async function sendWidgetEmoji(token: string, guest: string, emoji: string): Promise<ChatMessage | null> {
  const body = (await call(`${base(token)}/messages`, guest, { method: "POST", json: { body: emoji } })) as { message?: ChatMessage } | null;
  return body?.message ?? null;
}

/** An answer's voice, as a URL the player can play: the bytes are read with
 *  the visitor's header (an audio element sends none) and kept in memory. */
export async function widgetVoiceUrl(token: string, guest: string, messageId: string): Promise<string | null> {
  try {
    const res = await fetch(`${base(token)}/messages/${encodeURIComponent(messageId)}/audio`, {
      headers: { [WIDGET_GUEST_HEADER]: guest },
    });
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

/** "Keep this chat", signed in on the join page: {chatId}, the waitlist, or null. */
export async function keepWidgetChat(token: string, guest: string, auth: string | null): Promise<{ chatId: string } | "waitlist" | "signin" | null> {
  try {
    const res = await fetch(`${base(token)}/keep`, {
      method: "POST",
      cache: "no-store",
      headers: {
        [WIDGET_GUEST_HEADER]: guest,
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: "{}",
    });
    if (res.status === 401) return "signin";
    if (!res.ok) return null;
    const body = (await res.json()) as { chat?: { id?: unknown }; waitlist?: unknown };
    if (body.waitlist === true) return "waitlist";
    return typeof body.chat?.id === "string" ? { chatId: body.chat.id } : null;
  } catch {
    return null;
  }
}
