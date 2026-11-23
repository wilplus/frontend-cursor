import type { ChatQueryArgs } from "@/services/api/chatQuery";
import type { LoungeMessage } from "@/services/api/loungeMessages";

export type ChatTurnRequest = Omit<ChatQueryArgs, "audioBlob" | "clientId" | "clientCreatedAt">;
export interface PendingChatTurn {
  user: LoungeMessage;
  draft: string;
  question: LoungeMessage | null;
  request: ChatTurnRequest;
  /** A locally owned reply waiting for storage. Retrying writes it verbatim. */
  reply?: LoungeMessage;
  /** Server acknowledged the turn, but history may still return an older page. */
  confirmedReply?: LoungeMessage;
}

const prefix = "willab.chat.pending.v1:";
export function chatTurnKey(owner: string, conversation: string) {
  return prefix + encodeURIComponent(owner) + "/" + conversation;
}
const fallback = new Map<string, PendingChatTurn[]>();
const listeners = new Set<() => void>();
let revision = 0;
export const chatTurnRevision = () => revision;
export function subscribeToChatTurns(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function notifyChatTurns() {
  revision += 1;
  listeners.forEach((listen) => listen());
}
export function readChatTurns(key: string): PendingChatTurn[] {
  if (fallback.has(key)) return fallback.get(key)!;
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    return Array.isArray(saved) ? saved.filter((t) =>
      t?.user?.role === "user" && typeof t.user.client_id === "string" &&
      typeof t.draft === "string" && typeof t.request?.question === "string",
    ) : [];
  } catch {
    return [];
  }
}
export function replaceChatTurn(key: string, id: string, turn?: PendingChatTurn) {
  const next = readChatTurns(key).filter((t) => t.user.client_id !== id);
  if (turn) next.push(turn);
  try {
    if (next.length) sessionStorage.setItem(key, JSON.stringify(next));
    else sessionStorage.removeItem(key);
    fallback.delete(key);
  } catch {
    fallback.set(key, next);
  }
  notifyChatTurns();
}

export function clearPendingChatTurns(owner: string) {
  const start = prefix + encodeURIComponent(owner) + "/";
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(start)) sessionStorage.removeItem(key);
    }
  } catch { /* Storage can be unavailable in a private tab. */ }
  for (const key of fallback.keys()) if (key.startsWith(start)) fallback.delete(key);
  notifyChatTurns();
}

export function clearPendingChatConversation(owner: string, conversation: string) {
  const key = chatTurnKey(owner, conversation);
  try { sessionStorage.removeItem(key); } catch { /* private window */ }
  fallback.delete(key);
  notifyChatTurns();
}
