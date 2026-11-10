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
export type OpenDetail = { parts?: { line: string; parts: SetupPart[] } };

let known: SetupRead | null = null;

export function knowSetup(read: SetupRead | null): void {
  known = read;
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

/** Words typed to Will by a host whose chat is set up: the parts open again
 *  when the backend reads them as a wish to edit it (FIRST-21). */
export async function sayToWill(said: string): Promise<boolean> {
  if (!known?.recipe) return false;
  const parts = await editSaid(said);
  if (!parts) return false;
  open({ parts });
  return true;
}

/** For tests: forget the read. */
export function forgetSetup(): void {
  known = null;
}
