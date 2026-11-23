import { bffFetch } from "@/lib/api/bffFetch";
import { readOwnChat } from "@/lib/willab/chatBuilder/ownChat";

/* Kept answers Test stores through POST /v2/chats/<id>/reply
   (chat_reply_examples). That route has no read. Until one exists, the
   count is a local sample and nothing is sent. */

export const KEPT_SEND = 20;
export const KEPT_MODEL = 200;

export type KeptReply = { ask: string; answer: string };

const SAMPLE: KeptReply[] = [
  { ask: "Can they send a recording?", answer: "Yes" },
  { ask: "Do they pay?", answer: "No" },
  { ask: "What should it notice?", answer: "A long pause" },
  { ask: "The first line", answer: "Hello. Tell me what you need." },
];

export const KEPT_USE_MOCKS = process.env.NEXT_PUBLIC_EXPERIMENTS_MOCK !== "0";

/** The host's kept answers. Mocked: GET /v2/chats/<id>/reply does not exist. */
export async function readKeptReplies(chatId = readOwnChat().id || "your-chat"): Promise<KeptReply[]> {
  if (KEPT_USE_MOCKS) return SAMPLE;
  const result = await bffFetch(`/api/v2/chats/${encodeURIComponent(chatId)}/reply`, { method: "GET", auth: "required" });
  if (result.kind !== "response" || !result.ok || !result.body || typeof result.body !== "object") return [];
  const rows = (result.body as { examples?: unknown }).examples;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const ask = (row as { ask?: unknown }).ask;
    const answer = (row as { answer?: unknown }).answer;
    return typeof ask === "string" && typeof answer === "string" ? [{ ask, answer }] : [];
  });
}
