import { bffFetch } from "@/lib/api/bffFetch";

/* A matched Take that reached me: an asking chat in my list (backend N477,
   N478, N485, N486, N493; #1712). Before "Open Take" it shows who asks (a
   pseudonym and their role) and what about, never a name; after it, the
   name and the Take. "Not now" removes it and tells nobody. The answer is a
   Take, held five seconds for Undo; then the chat is made. Off for everyone
   until the backend's `take_match` ring turns it on: every read then answers
   nothing, and every call answers null. */

export type InquiryState = "new" | "opened" | "sending" | "answered";

export type Inquiry = {
  id: string;
  state: InquiryState;
  pseudonym: string;
  role: string | null;
  about: string;
  sentAt: string | null;
  /** The asker's name, after Open Take. */
  name: string | null;
  /** The chat made once the answer counted. */
  chatId: string | null;
};

/** After Open Take: the Take's words, slide by slide, and its length. */
export type InquiryTake = Inquiry & {
  words: string;
  /** Each slide's title, in order, when the backend gives them. */
  slideTitles: string[];
  durationMs: number | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

async function call(path: string, init: Parameters<typeof bffFetch>[1]): Promise<Record<string, unknown> | null> {
  try {
    const result = await bffFetch(path, { cache: "no-store", ...init });
    const body = result.kind === "response" && result.ok ? result.body : null;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function inquiryOf(raw: unknown): Inquiry | null {
  const row = rec(raw);
  const id = str(row.id);
  const state = row.state;
  if (!id || (state !== "new" && state !== "opened" && state !== "sending" && state !== "answered")) return null;
  return {
    id,
    state,
    pseudonym: str(row.pseudonym) ?? "",
    role: str(row.role),
    about: str(row.about) ?? "",
    sentAt: str(row.sent_at),
    name: state === "new" ? null : str(row.name),
    chatId: str(rec(row.chat).id),
  };
}

const path = (id: string, tail = "") => `/api/v2/take-matches/${encodeURIComponent(id)}${tail}`;

/** The asking chats, newest first; [] when off or on any failure. */
export async function getInquiries(): Promise<Inquiry[]> {
  const body = await call("/api/v2/take-matches/inquiries", { method: "GET" });
  const list = Array.isArray(body?.inquiries) ? body!.inquiries : [];
  return list.map(inquiryOf).filter((i): i is Inquiry => i !== null && i.state !== "answered");
}

function takeOf(body: Record<string, unknown> | null): Inquiry | InquiryTake | null {
  const raw = rec(body?.match);
  const base = inquiryOf(raw);
  if (!base) return null;
  if (base.state === "new") return base;
  const titles = Array.isArray(raw.slide_titles) ? raw.slide_titles.filter((t): t is string => typeof t === "string") : [];
  return {
    ...base,
    words: typeof raw.words === "string" ? raw.words : "",
    slideTitles: titles,
    durationMs: typeof raw.duration_ms === "number" ? raw.duration_ms : null,
  };
}

/** One asking chat as it opens; null on failure. */
export async function getInquiry(id: string): Promise<Inquiry | InquiryTake | null> {
  return takeOf(await call(path(id), { method: "GET" }));
}

/** "Open Take": the name and the Take; null on failure. */
export async function acceptInquiry(id: string): Promise<Inquiry | InquiryTake | null> {
  return takeOf(await call(path(id, "/accept"), { method: "POST", json: {} }));
}

/** "Not now": whether it went. */
export async function declineInquiry(id: string): Promise<boolean> {
  return rec((await call(path(id, "/decline"), { method: "POST", json: {} }))?.match).status === "declined";
}

/** The answer, held `holdMs` on the backend for Undo: "held" while it
 *  waits, "sent" once the chat is made, null when refused. */
export async function answerInquiry(id: string, take: string, durationMs: number, holdMs: number): Promise<"held" | "sent" | null> {
  const body = await call(path(id, "/answer"), { method: "POST", json: { take, duration_ms: durationMs, hold_ms: holdMs } });
  if (body?.chat) return "sent";
  if (body?.sending) return "held";
  return null;
}

/** Undo: "undone", or "sent" when it was too late. */
export async function undoInquiry(id: string): Promise<"undone" | "sent"> {
  const body = await call(path(id, "/undo"), { method: "POST", json: {} });
  return body?.match ? "undone" : "sent";
}

/** The matched Take's voice, after Open Take. */
export function inquiryAudioSrc(id: string): string {
  return path(id, "/recording");
}
