import { outcomeCall as call } from "@/lib/api/bffCall";

/* -------------------------------------------------------------------------- */
/*  Sending a Take to the people you tick (backend N470, N472; rules:         */
/*  docs/flows/feedback-walk-and-chat.md G). Behind the backend's switch      */
/*  (`TAKE_SEND_ENABLED`): while it is off every read answers               */
/*  `{enabled: false}` and a send 409 `SENDING_OFF`. Every call here answers  */
/*  null on any failure, an old backend's 404 included, so the caller keeps   */
/*  today's sharing screen and the next Take records anyway (R3, R6).         */
/* -------------------------------------------------------------------------- */

/** One person in your list of chats you can send a Take to. */
export type SendPerson = {
  userId: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
  chatId: string | null;
  /** The person you sent your last Take to: on top, with "Last sent". */
  lastSent: boolean;
};

/** Who a Take goes to: everyone in the list, or the people ticked. */
export type SendChoice = { all: boolean; userIds: string[] };

/** A sent Take's message in each chat. */
export type SentTake = { userId: string; chatId: string; messageId: string };

/** What "Open Take" plays and shows to the person it was sent to: its
 *  recording and its words, slide by slide (never its Ideal Text, feedback,
 *  moments or levels, N472 item 8). */
export type ChatTake = {
  audioUrl: string;
  durationMs: number | null;
  slides: Array<{ index: number; title: string | null; words: string }>;
};

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : []);

function personOf(raw: unknown): SendPerson | null {
  const row = rec(raw);
  const userId = str(row.user_id);
  const name = str(row.name);
  if (!userId || !name) return null;
  return {
    userId,
    name,
    title: str(row.title),
    avatarUrl: str(row.avatar_url),
    chatId: str(row.chat_id),
    lastSent: row.last_sent === true,
  };
}

/** The people you can send to, the one sent to last first; null on failure. */
export async function fetchSendPeople(): Promise<{ enabled: boolean; people: SendPerson[] } | null> {
  const res = await call("/api/v2/user/takes/send/people", { method: "GET" }, (data) => ({
    enabled: data.enabled === true,
    people: (Array.isArray(data.people) ? data.people : []).map(personOf).filter((p): p is SendPerson => p !== null),
  }));
  return res.ok ? res.data : null;
}

/** Your last choice, for the screen's default (null: everyone ticked). */
export async function fetchLastSend(): Promise<{ enabled: boolean; choice: SendChoice | null } | null> {
  const res = await call("/api/v2/user/takes/send/last", { method: "GET" }, (data) => {
    const raw = data.choice && typeof data.choice === "object" ? rec(data.choice) : null;
    return { enabled: data.enabled === true, choice: raw ? { all: raw.all === true, userIds: ids(raw.user_ids) } : null };
  });
  return res.ok ? res.data : null;
}

/** Send your Take, once per person (the backend keeps it idempotent; a
 *  second call only adds people, N472 item 3); null on any refusal. */
export async function sendTake(takeSessionId: string, choice: SendChoice): Promise<SentTake[] | null> {
  const res = await call(
    `/api/v2/user/takes/${encodeURIComponent(takeSessionId)}/send`,
    { method: "POST", body: { all: choice.all, user_ids: choice.userIds } },
    (data) =>
      (Array.isArray(data.sent) ? data.sent : [])
        .map((raw) => {
          const row = rec(raw);
          const userId = str(row.user_id);
          const chatId = str(row.chat_id);
          const messageId = str(row.message_id);
          return userId && chatId && messageId ? { userId, chatId, messageId } : null;
        })
        .filter((s): s is SentTake => s !== null),
  );
  return res.ok ? res.data : null;
}

/** A Take sent to you in a chat, to open; null on failure. */
export async function fetchChatTake(chatId: string, messageId: string): Promise<ChatTake | null> {
  const res = await call(
    `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/take`,
    { method: "GET" },
    (data) => ({
      audioUrl: str(data.audio_url) ?? "",
      durationMs: typeof data.duration_ms === "number" ? data.duration_ms : null,
      slides: (Array.isArray(data.slides) ? data.slides : []).map((raw, i) => {
        const row = rec(raw);
        return {
          index: typeof row.index === "number" ? row.index : i,
          title: str(row.title),
          words: typeof row.words === "string" ? row.words : "",
        };
      }),
    }),
  );
  return res.ok && res.data.audioUrl ? res.data : null;
}
