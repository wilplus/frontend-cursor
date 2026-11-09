import type { ChatMessage } from "@/services/api/chats";

/* -------------------------------------------------------------------------- */
/*  The website chat (backend N591, amending N567 and N569): the host's own   */
/*  chat on the public side, made from `/w/<token>` inside the iframe w.js    */
/*  opens. The visitor has no account until they sign up, after asking: no    */
/*  sign-in is sent; their secret, kept in this browser for this site,        */
/*  travels in one header. Every call answers null when it does not go.      */
/* -------------------------------------------------------------------------- */

export const WIDGET_GUEST_HEADER = "X-Willab-Widget-Guest";

/** How a visitor may write, from the host's recipe (N591 item 2): tap (the
 *  three emoji), type, record (only once signed up, and then in the app). */
export interface WidgetWrites {
  tap: boolean;
  type: boolean;
  record: boolean;
}

export interface WidgetChat {
  name: string;
  writes: WidgetWrites;
  messages: ChatMessage[];
  /** The visitor has signed up: the host's answers are in `messages`. */
  signedUp: boolean;
  /** The visitor has asked and not signed up: the sign-up step is due. */
  signUp: boolean;
  /** An answer from the host waits behind the sign-up. */
  answered: boolean;
}

export const NO_WRITES: WidgetWrites = { tap: true, type: false, record: false };

/** The backend's `writes`, read safely: a missing one is taps only. */
export function writesOf(value: unknown): WidgetWrites {
  const w = value as Partial<Record<keyof WidgetWrites, unknown>> | null | undefined;
  if (!w || typeof w !== "object") return NO_WRITES;
  return { tap: w.tap !== false, type: w.type === true, record: w.record === true };
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
  const b = body as { name?: unknown; writes?: unknown; messages?: unknown; signed_up?: unknown; sign_up?: unknown; answered?: unknown } | null;
  if (!b || typeof b.name !== "string" || !Array.isArray(b.messages)) return null;
  return {
    name: b.name,
    writes: writesOf(b.writes),
    messages: b.messages as ChatMessage[],
    signedUp: b.signed_up === true,
    signUp: b.sign_up === true,
    answered: b.answered === true,
  };
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

/** The visitor's own message (N591 item 2): one of the three emoji, or
 *  typed words where the host's setup allows typing. The message, and
 *  whether the sign-up step is now due; null when it did not go. */
export async function sendWidgetMessage(
  token: string,
  guest: string,
  kind: "emoji" | "text",
  body: string,
): Promise<{ message: ChatMessage; signUp: boolean } | null> {
  const sent = (await call(`${base(token)}/messages`, guest, { method: "POST", json: { kind, body } })) as {
    message?: ChatMessage;
    sign_up?: unknown;
  } | null;
  return sent?.message ? { message: sent.message, signUp: sent.sign_up === true } : null;
}

/** An answer's voice, once the visitor has signed up, as a URL the player can play: the bytes are read with
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

/** The sign-up after asking (N591 item 4), signed in on the join page: the
 *  visitor takes their seat and the chat is theirs. {chatId}, the waitlist,
 *  "signin" when no one is signed in yet, or null. */
export async function signUpWidgetChat(token: string, guest: string, auth: string | null): Promise<{ chatId: string } | "waitlist" | "signin" | null> {
  try {
    const res = await fetch(`${base(token)}/sign-up`, {
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
