import { bffFetch } from "@/lib/api/bffFetch";
import type { CoachDefinition } from "@/lib/willab/chatBuilder/types";

export type ChatLife = "active" | "archived" | "deleted";
export type Subchat = { id: string; title: string; question: string; archived: boolean };
type BuiltChatCopy = Pick<CoachDefinition["chat"], "spec" | "line" | "hello" | "questions" | "taps" | "send" | "who">;
export type PublishedChat = BuiltChatCopy & { name: string };
export type ChatStructure = {
  coach: ChatLife; builder: ChatLife; subchats: Subchat[];
  published_chat?: PublishedChat | null; main_chat_id?: string;
};
export type ChangeStructure =
  | { action: "publish"; chat: Omit<PublishedChat, "questions"> & { questions: string[] } }
  | { action: "add"; title: string; question: string }
  | { action: "archive" | "restore" | "delete"; section: string; projects?: string[] };
export type BuiltChatTurn = { client_id: string; question: string; answer: string };
export type CoachProject = { id: string; display_name: string };

const PATH = "/api/v2/chats/structure";

export async function fetchChatStructure(): Promise<ChatStructure | null> {
  const res = await bffFetch(PATH, { cache: "no-store" });
  return res.kind === "response" && res.ok ? res.body as ChatStructure : null;
}

export async function changeChatStructure(change: ChangeStructure): Promise<ChatStructure | null> {
  const res = await bffFetch(PATH, { method: "POST", json: change });
  return res.kind === "response" && res.ok ? res.body as ChatStructure : null;
}

export async function fetchCoachDeletionProjects(): Promise<CoachProject[] | null> {
  const res = await bffFetch(PATH + "/coach/projects", { cache: "no-store" });
  return res.kind === "response" && res.ok ? (res.body as { projects: CoachProject[] }).projects : null;
}

export async function fetchBuiltChatTurns(section: string): Promise<BuiltChatTurn[] | null> {
  const res = await bffFetch(`${PATH}/${encodeURIComponent(section)}/turns`, { cache: "no-store" });
  return res.kind === "response" && res.ok ? (res.body as { turns: BuiltChatTurn[] }).turns : null;
}

export async function keepBuiltChatTurn(section: string, turn: BuiltChatTurn): Promise<boolean> {
  const res = await bffFetch(`${PATH}/${encodeURIComponent(section)}/turns`, { method: "POST", json: turn });
  return res.kind === "response" && res.ok;
}
