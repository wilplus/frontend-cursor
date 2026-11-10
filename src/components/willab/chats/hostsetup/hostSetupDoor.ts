import { editSaid, type SetupPart, type SetupRead } from "@/services/api/hostSetup";

/* -------------------------------------------------------------------------- */
/*  The ways into the blank setup from outside it (backend N616, N618 item    */
/*  8): Will's row for the first person ever, "Set them" in the +'s note,     */
/*  and "I want to edit my chat" said in Will's chat. The list's setup rows   */
/*  (HostSetupRows) read the setup once and keep it here; until they have,   */
/*  and below the ring (the read is 404), every way in here does nothing and */
/*  makes no call, so Will's chat is as it was for everyone else.            */
/* -------------------------------------------------------------------------- */

export const OPEN_EVENT = "willab:host-setup-open";
/** What a way in opens over the list: the setup (or its parts), the drafted
 *  answers, the AI models (their list, or their teaching queue), or one
 *  model's check (Will's lines, backend N629). */
export type OpenDetail = {
  parts?: { line: string; parts: SetupPart[] };
  open?: "drafts" | "models" | "teach" | "check" | "parts";
  modelId?: string;
};

let known: SetupRead | null = null;

export function knowSetup(read: SetupRead | null): void {
  known = read;
}

export function openOverList(detail: OpenDetail): void {
  open(detail);
}

function open(detail: OpenDetail): void {
  window.dispatchEvent(new CustomEvent<OpenDetail>(OPEN_EVENT, { detail }));
}

/** Will's row: the first person ever (no other chat yet) who has not begun
 *  opens Will's "What do you do?" (FIRST-01, FIRST-02). True when it did. */
export function openSetupFromWill(otherChats: number): boolean {
  if (!known || known.recipe || otherChats > 0) return false;
  open({});
  return true;
}

/** "Set them": the setup, where its ring answers. True when it did. */
export function openSetupFromNote(): boolean {
  if (!known) return false;
  open({});
  return true;
}

/** Words that ask to change one's chat: "chat" and "edit" or "change" in
 *  them (the coordinator's rule until the founder decides otherwise). The
 *  edit route opens the parts for any words, so nothing else reaches it. */
export function asksToEditChat(said: string): boolean {
  const s = said.toLowerCase();
  return s.includes("chat") && (s.includes("edit") || s.includes("change"));
}

/** Words typed to Will by a host whose chat is set up: the parts open again
 *  when they ask to edit it (FIRST-21); every other message is sent to Will
 *  as before, with no call here. */
export async function sayToWill(said: string): Promise<boolean> {
  if (!known?.recipe || !asksToEditChat(said)) return false;
  const parts = await editSaid(said);
  if (!parts) return false;
  open({ parts });
  return true;
}

/** For tests: forget the read. */
export function forgetSetup(): void {
  known = null;
}
