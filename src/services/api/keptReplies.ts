import { bffFetch } from "@/lib/api/bffFetch";
import { readOwnChat } from "@/lib/willab/chatBuilder/ownChat";
import { classifyStatus } from "@/lib/willab/experiments/voiceCatalog";

/* Kept answers Test stores. The count is GET /v2/chats/<id>/reply-examples.
   A missing route is "not on yet". A 403 is the host's own list. */

export const KEPT_SEND = 20;
export const KEPT_MODEL = 200;

export type KeptItem = {
  id: string;
  created_at: string;
  question: string;
  prompt: string;
  answer: string;
  kind: string;
};

export type KeptRead =
  | { state: "ready"; count: number; items: KeptItem[] }
  | { state: "not-on-yet" }
  | { state: "host-only" }
  | { state: "absent" };

export async function readKeptReplies(chatId = readOwnChat().id || "your-chat"): Promise<KeptRead> {
  let result;
  try {
    result = await bffFetch(`/api/v2/chats/${encodeURIComponent(chatId)}/reply-examples?limit=20&offset=0`, { method: "GET", auth: "optional" });
  } catch {
    return { state: "not-on-yet" };
  }
  if (!result || result.kind !== "response") return { state: "not-on-yet" };
  const gate = classifyStatus(result.status, result.body);
  if (gate === "host-only") return { state: "host-only" };
  if (gate === "absent") return { state: "absent" };
  if (!result.ok || !result.body || typeof result.body !== "object") return { state: "not-on-yet" };
  const body = result.body as { count?: unknown; items?: unknown };
  if (typeof body.count !== "number" || !Array.isArray(body.items)) return { state: "not-on-yet" };
  const items = body.items.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.question !== "string" || typeof item.answer !== "string") return [];
    return [{
      id: item.id,
      created_at: typeof item.created_at === "string" ? item.created_at : "",
      question: item.question,
      prompt: typeof item.prompt === "string" ? item.prompt : item.question,
      answer: item.answer,
      kind: typeof item.kind === "string" ? item.kind : "text",
    }];
  });
  return { state: "ready", count: body.count, items };
}
